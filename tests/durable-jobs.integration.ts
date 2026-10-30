import { test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { fork } from "node:child_process";
import { once } from "node:events";
import { setTimeout as delay } from "node:timers/promises";
import { createServer, connect, type Socket } from "node:net";
import {
  DurableJobs,
  PrismaClient,
  type ReadinessPolicy,
} from "../apps/worker/src/durable/jobs";
import {
  OutboxDispatcher,
  deliveryId,
} from "../apps/worker/src/durable/outbox";
import {
  createDurableQueue,
  createDurableWorker,
  recoverExpiredJobs,
} from "../apps/worker/src/durable/queue";
import { CUTTLEFISH, targetDigest } from "../apps/worker/src/executor/policy";
import { type Grant } from "../apps/worker/src/executor/attempt-store";
import {
  runPreflight,
  type PreflightTransport,
} from "../apps/worker/src/executor/coordinator";
import { defaultConfiguration } from "../packages/contracts/src";

process.env.NODE_ENV = "test";
const database = new URL(process.env.DATABASE_URL ?? "invalid:");
const redis = process.env.REDIS_URL ?? "";
if (
  !/^\/nexos_d5_test_[a-f0-9]{8}$/.test(database.pathname) ||
  !["127.0.0.1", "localhost"].includes(database.hostname) ||
  new URL(redis).port !== "6381"
)
  throw new Error(
    "Dedicated disposable D5 database and separate Redis 6381 required; live database tests refused",
  );
const ready: ReadinessPolicy = ({ configurationDigest, now }) => ({
  kind: "ISOLATION_PREFLIGHT",
  eligible: true,
  configurationDigest,
  targetDigest: targetDigest(CUTTLEFISH),
  evidenceDigest: "e".repeat(64),
  validUntil: new Date(now.getTime() + 60000),
});
const checked = (): PreflightTransport => ({
  async execute(_grant, progress) {
    await progress("ISOLATED");
    await progress("PREFLIGHT_RUNNING");
  },
  async terminate() {
    return true;
  },
});
test(
  "D5 real PostgreSQL: an actual outbox SQL failure rolls back job and audit writes",
  { timeout: 30000 },
  async () => {
    const f = await fixture();
    try {
      await f.db
        .$executeRaw`CREATE FUNCTION d5_outbox_failure() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN RAISE EXCEPTION 'D5_TEST_OUTBOX_REJECTED'; END;$$`;
      await f.db
        .$executeRaw`CREATE TRIGGER d5_outbox_failure BEFORE INSERT ON "DurableBuildOutbox" FOR EACH ROW EXECUTE FUNCTION d5_outbox_failure()`;
      try {
        await assert.rejects(f.jobs.admit(f.owner.id, f.request()), {
          code: "DATABASE_UNAVAILABLE",
        });
        assert.equal(
          await f.db.durableBuildJob.count({ where: { ownerId: f.owner.id } }),
          0,
        );
        assert.equal(
          await f.db.auditLog.count({ where: { actorId: f.owner.id } }),
          0,
        );
        assert.equal(
          await f.db.durableBuildOutbox.count({
            where: { job: { ownerId: f.owner.id } },
          }),
          0,
        );
      } finally {
        await f.db
          .$executeRaw`DROP TRIGGER d5_outbox_failure ON "DurableBuildOutbox"`;
        await f.db.$executeRaw`DROP FUNCTION d5_outbox_failure()`;
      }
    } finally {
      await f.close();
    }
  },
);
async function until(check: () => Promise<boolean>, timeout = 12000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    if (await check()) return;
    await delay(25);
  }
  throw new Error("Durable condition timed out");
}
const grantFor = (record: {
  requestId: string;
  attemptId: string | null;
  fence: number;
  deadline: number;
}): Grant => ({
  slot: 0,
  requestId: record.requestId,
  attemptId: record.attemptId!,
  fence: record.fence,
  deadline: record.deadline,
});
async function fixture() {
  const db = new PrismaClient();
  const current = await db.$queryRaw<
    { name: string }[]
  >`SELECT current_database() AS name`;
  assert.equal("/" + current[0].name, database.pathname);
  const suffix = randomBytes(6).toString("hex");
  const owner = await db.user.create({
    data: { email: `d5_${suffix}@example.com`, username: `d5_${suffix}` },
  });
  const foreign = await db.user.create({
    data: {
      email: `d5_other_${suffix}@example.com`,
      username: `d5other_${suffix}`,
    },
  });
  const project = await db.rOMProject.create({
    data: {
      ownerId: owner.id,
      configuration: defaultConfiguration,
      revisions: { create: { number: 1, configuration: defaultConfiguration } },
    },
    include: { revisions: true },
  });
  const jobs = new DurableJobs(db, ready);
  const request = () => ({
    projectId: project.id,
    revisionId: project.revisions[0].id,
    targetId: CUTTLEFISH.candidateId,
    idempotencyKey: randomUUID(),
  });
  const broker = createDurableQueue(
    redis,
    `nexos-d5-test-${randomBytes(8).toString("hex")}`,
  );
  await broker.ready();
  const dispatcher = new OutboxDispatcher(db, broker.port);
  const workers: ReturnType<typeof createDurableWorker>[] = [];
  return {
    db,
    owner,
    foreign,
    project,
    jobs,
    request,
    broker,
    dispatcher,
    worker(
      transport = checked(),
      testHooks?: Parameters<typeof createDurableWorker>[5],
    ) {
      const worker = createDurableWorker(
        broker,
        jobs,
        transport,
        undefined,
        undefined,
        testHooks,
      );
      workers.push(worker);
      return worker;
    },
    async close() {
      await Promise.all(workers.map((worker) => worker.close()));
      await broker.queue.obliterate({ force: true });
      await broker.close();
      await db.durableBuildJob.updateMany({
        where: { ownerId: { in: [owner.id, foreign.id] } },
        data: { currentAttemptId: null },
      });
      await db.durableBuildJob.deleteMany({
        where: { ownerId: { in: [owner.id, foreign.id] } },
      });
      await db.auditLog.deleteMany({
        where: { actorId: { in: [owner.id, foreign.id] } },
      });
      await db.user.deleteMany({
        where: { id: { in: [owner.id, foreign.id] } },
      });
      await db.$disconnect();
    },
  };
}
test(
  "D5 real PostgreSQL: readiness/ownership, atomic admission, unique idempotency, constraints and rollback",
  { timeout: 30000 },
  async () => {
    const f = await fixture();
    try {
      await assert.rejects(
        new DurableJobs(f.db).admit(f.owner.id, f.request()),
        { code: "BUILD_UNAVAILABLE" },
      );
      for (const invalid of [
        (input: Parameters<ReadinessPolicy>[0]) => ({
          ...ready(input)!,
          configurationDigest: "0".repeat(64),
        }),
        (input: Parameters<ReadinessPolicy>[0]) => ({
          ...ready(input)!,
          validUntil: new Date(0),
        }),
      ])
        await assert.rejects(
          new DurableJobs(f.db, invalid).admit(f.owner.id, f.request()),
          { code: "BUILD_UNAVAILABLE" },
        );
      await assert.rejects(f.jobs.admit(f.foreign.id, f.request()), {
        code: "NOT_FOUND",
      });
      for (const extra of [
        { command: "arbitrary" },
        { ownerId: f.owner.id },
        { kind: "ANDROID_BUILD" },
        { environment: {} },
      ])
        await assert.rejects(
          f.jobs.admit(f.owner.id, { ...f.request(), ...extra }),
          { code: "INVALID_REQUEST" },
        );
      const input = f.request();
      const results = await Promise.all(
        Array.from({ length: 12 }, () => f.jobs.admit(f.owner.id, input)),
      );
      assert.equal(new Set(results.map((job) => job.id)).size, 1);
      const job = results[0];
      assert.equal(
        await f.db.durableBuildOutbox.count({ where: { jobId: job.id } }),
        1,
      );
      assert.equal(
        await f.db.auditLog.count({
          where: { actorId: f.owner.id, targetId: job.id },
        }),
        1,
      );
      await assert.rejects(f.jobs.owned(f.foreign.id, job.id), {
        code: "NOT_FOUND",
      });
      await assert.rejects(f.jobs.cancel(f.foreign.id, job.id), {
        code: "NOT_FOUND",
      });
      const revision = await f.db.configurationRevision.create({
        data: {
          projectId: f.project.id,
          number: 2,
          configuration: { ...defaultConfiguration, name: "Changed snapshot" },
        },
      });
      await assert.rejects(
        f.jobs.admit(f.owner.id, { ...input, revisionId: revision.id }),
        { code: "CONFLICT" },
      );
      const broken = new DurableJobs(f.db, ready, {
        afterJobCreated: async () => {
          throw new Error("private-transaction-fault");
        },
      });
      const before = await f.db.durableBuildJob.count({
        where: { ownerId: f.owner.id },
      });
      await assert.rejects(broken.admit(f.owner.id, f.request()), {
        code: "DATABASE_UNAVAILABLE",
      });
      assert.equal(
        await f.db.durableBuildJob.count({ where: { ownerId: f.owner.id } }),
        before,
      );
      assert.equal(
        await f.db.durableBuildOutbox.count({
          where: { job: { ownerId: f.owner.id } },
        }),
        1,
      );
      await assert.rejects(
        f.db.durableBuildJob.update({
          where: { id: job.id },
          data: { compiled: true },
        }),
      );
      assert.equal((await f.jobs.owned(f.owner.id, job.id)).compiled, false);
      // Admission never needs Redis: the job/event already exist before dispatch.
      assert.equal(
        await f.broker.queue.getJob(deliveryId(job.id, 0)),
        undefined,
      );
      for (let n = 0; n < 3; n++) await f.jobs.admit(f.owner.id, f.request());
      await assert.rejects(f.jobs.admit(f.owner.id, f.request()), {
        code: "CAPACITY",
      });
    } finally {
      await f.close();
    }
  },
);
test(
  "D5 real PostgreSQL/Redis: concurrent dispatch, duplicate delivery and authoritative consumer outcome",
  { timeout: 30000 },
  async () => {
    const f = await fixture();
    try {
      const job = await f.jobs.admit(f.owner.id, f.request());
      const peer = new OutboxDispatcher(f.db, f.broker.port);
      const secondJob = await f.jobs.admit(f.owner.id, f.request());
      await Promise.all(
        Array.from({ length: 8 }, (_, n) =>
          (n % 2 ? peer : f.dispatcher).dispatchOnce(),
        ),
      );
      assert.equal(
        await f.db.durableBuildOutbox.count({
          where: { jobId: job.id, state: "SENT" },
        }),
        1,
      );
      let calls = 0;
      let active = 0;
      let peak = 0;
      const transport: PreflightTransport = {
        ...checked(),
        async execute(g, p, s) {
          calls++;
          active++;
          peak = Math.max(peak, active);
          await delay(50);
          await checked().execute(g, p, s);
          active--;
        },
      };
      const worker = f.worker(transport);
      await worker.ready();
      await f.worker(transport).ready();
      await until(
        async () =>
          (await f.jobs.owned(f.owner.id, job.id)).state === "CHECKED",
      );
      await until(
        async () =>
          (await f.jobs.owned(f.owner.id, secondJob.id)).state === "CHECKED",
      );
      await f.broker.port.add(deliveryId(job.id, 0), {
        version: 1,
        kind: "ISOLATION_PREFLIGHT",
        jobId: job.id,
        generation: 0,
      });
      await delay(100);
      assert.equal(calls, 2);
      assert.equal(peak, 1);
      const final = await f.jobs.owned(f.owner.id, job.id);
      assert.equal(final.compiled, false);
      assert.equal(final.attemptCount, 1);
      assert.equal(
        await f.db.durableBuildAttempt.count({ where: { jobId: job.id } }),
        1,
      );
      await f.jobs.cancel(f.owner.id, job.id);
      assert.equal((await f.jobs.owned(f.owner.id, job.id)).state, "CHECKED");
    } finally {
      await f.close();
    }
  },
);
test(
  "D5 real PostgreSQL/Redis: committed intent survives unavailable broker and dispatcher crash/restart",
  { timeout: 30000 },
  async () => {
    const f = await fixture();
    const sockets = new Set<Socket>();
    const source = new URL(redis);
    const proxy = createServer((socket) => {
      const remote = connect(Number(source.port), source.hostname);
      sockets.add(socket);
      sockets.add(remote);
      socket.pipe(remote).pipe(socket);
      socket.on("error", () => remote.destroy());
      remote.on("error", () => socket.destroy());
      socket.on("close", () => {
        sockets.delete(socket);
        remote.destroy();
      });
      remote.on("close", () => sockets.delete(remote));
    });
    await new Promise<void>((yes) => proxy.listen(0, "127.0.0.1", yes));
    const address = proxy.address();
    assert.ok(address && typeof address !== "string");
    const proxied = new URL(redis);
    proxied.port = String(address.port);
    const flaky = createDurableQueue(proxied.href, f.broker.prefix);
    try {
      await flaky.ready();
      const job = await f.jobs.admit(f.owner.id, f.request());
      const stopped = new Promise<void>((yes) => proxy.close(() => yes()));
      sockets.forEach((socket) => socket.destroy());
      await stopped;
      const dispatcher = new OutboxDispatcher(f.db, flaky.port);
      await dispatcher.dispatchOnce();
      const failed = await f.db.durableBuildOutbox.findFirstOrThrow({
        where: { jobId: job.id },
      });
      assert.equal(failed.state, "PENDING");
      assert.equal(failed.failureCode, "REDIS_UNAVAILABLE");
      assert.ok(
        failed.lastAttemptAt &&
          failed.nextAttemptAt.getTime() - failed.lastAttemptAt.getTime() >=
            250,
      );
      assert.equal((await f.jobs.owned(f.owner.id, job.id)).state, "QUEUED");
      await f.db.durableBuildOutbox.update({
        where: { id: failed.id },
        data: { nextAttemptAt: new Date(0) },
      });
      // Publish, then emulate dispatcher death before database acknowledgement.
      const old = await f.dispatcher.claim();
      assert.ok(old);
      await f.broker.port.add(deliveryId(job.id, 0), {
        version: 1,
        kind: "ISOLATION_PREFLIGHT",
        jobId: job.id,
        generation: 0,
      });
      await f.db.durableBuildOutbox.update({
        where: { id: old.id },
        data: { dispatchLeaseUntil: new Date(0) },
      });
      const restarted = new OutboxDispatcher(f.db, f.broker.port);
      await restarted.dispatchOnce();
      assert.equal(await f.dispatcher.acknowledge(old, true), false);
      assert.equal(
        (
          await f.db.durableBuildOutbox.findUniqueOrThrow({
            where: { id: old.id },
          })
        ).state,
        "SENT",
      );
      assert.equal((await f.broker.queue.getJobs(["wait"])).length, 1);
    } finally {
      sockets.forEach((socket) => socket.destroy());
      if (proxy.listening)
        await new Promise<void>((yes) => proxy.close(() => yes()));
      await flaky.close();
      await f.close();
    }
  },
);
test(
  "D5 real PostgreSQL: killed worker, expired lease, cleanup gate, fresh attempt fence and durable retry event",
  { timeout: 30000 },
  async () => {
    const f = await fixture();
    let child: ReturnType<typeof fork> | undefined;
    try {
      const job = await f.jobs.admit(f.owner.id, f.request());
      child = fork("tests/helpers/durable-crash.cjs", [f.broker.prefix], {
        env: process.env,
        stdio: ["ignore", "ignore", "ignore", "ipc"],
      });
      await new Promise<void>((yes, no) => {
        const listener = (message: unknown) => {
          if ((message as { ready?: boolean }).ready) {
            child!.off("message", listener);
            yes();
          } else if ((message as { error?: boolean }).error)
            no(new Error("Crash fixture startup failed"));
        };
        child!.on("message", listener);
        child!.once("error", no);
      });
      const claimed = new Promise<{ attemptId: string; fence: number }>(
        (yes, no) => {
          child!.once("message", (message) => {
            if ((message as { error?: boolean }).error)
              no(new Error("Crash fixture claim failed"));
            else yes(message as { attemptId: string; fence: number });
          });
          child!.once("error", no);
        },
      );
      await f.dispatcher.dispatchOnce();
      const message = await claimed;
      const exited = once(child, "exit");
      child.kill("SIGKILL");
      await exited;
      const old = (await f.jobs.owned(f.owner.id, job.id)).currentAttempt!;
      assert.equal(old.id, message.attemptId);
      const oldGrant: Grant = {
        slot: 0,
        requestId: job.id,
        attemptId: old.id,
        fence: old.fence,
        deadline: old.deadline.getTime(),
      };
      await assert.rejects(
        f.jobs.authority(job.id, 0, "another-worker").renew(oldGrant),
        { code: "FENCED" },
      );
      await until(
        async () =>
          (
            await f.db.durableBuildAttempt.findUniqueOrThrow({
              where: { id: old.id },
            })
          ).leaseUntil.getTime() <= Date.now(),
        6000,
      );
      await assert.rejects(
        f.jobs.authority(job.id, 0, old.workerId).renew(oldGrant),
        { code: "FENCED" },
      );
      assert.equal(
        (
          await recoverExpiredJobs(f.jobs, {
            ...checked(),
            terminate: async () => false,
          })
        ).recovered,
        0,
      );
      assert.equal(
        (await f.jobs.owned(f.owner.id, job.id)).state,
        "RECOVERY_REQUIRED",
      );
      assert.equal(
        (await recoverExpiredJobs(new DurableJobs(f.db, ready), checked()))
          .recovered,
        1,
      );
      const recovered = await f.jobs.owned(f.owner.id, job.id);
      assert.equal(recovered.state, "QUEUED");
      assert.equal(recovered.deliveryGeneration, 1);
      await f.dispatcher.dispatchOnce();
      const replacement = f.worker(checked(), {
        lockDuration: 500,
        stalledInterval: 500,
      });
      await replacement.ready();
      await until(
        async () =>
          (await f.jobs.owned(f.owner.id, job.id)).state === "CHECKED",
      );
      const final = await f.jobs.owned(f.owner.id, job.id);
      assert.equal(final.fence, 2);
      assert.notEqual(final.currentAttemptId, old.id);
      await assert.rejects(
        f.jobs
          .authority(job.id, 0, old.workerId)
          .finish(oldGrant, "CHECKED", true),
        { code: "FENCED" },
      );
      assert.equal(
        await f.db.durableBuildAttempt.count({ where: { jobId: job.id } }),
        2,
      );
      assert.equal(
        await f.db.durableBuildOutbox.count({ where: { jobId: job.id } }),
        2,
      );
    } finally {
      if (child && child.exitCode === null) child.kill("SIGKILL");
      await f.close();
    }
  },
);
test(
  "D5 real PostgreSQL: cancellation/completion race, readiness expiry and immutable terminal states",
  { timeout: 30000 },
  async () => {
    const f = await fixture();
    try {
      const job = await f.jobs.admit(f.owner.id, f.request());
      const authority = f.jobs.authority(job.id, 0, "race-worker");
      const grant = grantFor(
        await authority.claim({ slot: 0, requestId: job.id }),
      );
      for (const stage of [
        "ALLOCATED",
        "ISOLATED",
        "PREFLIGHT_RUNNING",
      ] as const)
        await authority.progress(grant, stage);
      await Promise.all([
        f.jobs.cancel(f.owner.id, job.id),
        authority.finish(grant, "CHECKED", true),
      ]);
      const state = (await f.jobs.owned(f.owner.id, job.id)).state;
      assert.ok(["CHECKED", "CANCELLED"].includes(state));
      await assert.rejects(authority.finish(grant, "FAILED", true), {
        code: "FENCED",
      });
      await f.jobs.cancel(f.owner.id, job.id);
      assert.equal((await f.jobs.owned(f.owner.id, job.id)).state, state);
      const queued = await f.jobs.admit(f.owner.id, f.request());
      await f.jobs.cancel(f.owner.id, queued.id);
      await assert.rejects(
        f.jobs
          .authority(queued.id, 0, "race-worker")
          .claim({ slot: 0, requestId: queued.id }),
        { code: "NOT_QUEUED" },
      );
      const expired = await f.jobs.admit(f.owner.id, f.request());
      await f.db.durableBuildJob.update({
        where: { id: expired.id },
        data: { readinessValidUntil: new Date(0) },
      });
      await assert.rejects(
        f.jobs
          .authority(expired.id, 0, "race-worker")
          .claim({ slot: 0, requestId: expired.id }),
        { code: "NOT_QUEUED" },
      );
      assert.equal(
        (await f.jobs.owned(f.owner.id, expired.id)).failureCode,
        "READINESS_EXPIRED",
      );
      assert.equal(
        await f.db.durableBuildAttempt.count({ where: { jobId: expired.id } }),
        0,
      );
      const short = new DurableJobs(f.db, (input) => ({
        ...ready(input)!,
        validUntil: new Date(input.now.getTime() + 500),
      }));
      const bounded = await short.admit(f.owner.id, f.request());
      const timed = await runPreflight(
        short.authority(bounded.id, 0, "bounded-worker"),
        { slot: 0, requestId: bounded.id },
        {
          execute: async () => new Promise(() => {}),
          terminate: async () => true,
        },
      );
      assert.equal(timed.state, "FAILED");
      assert.equal(
        (await short.owned(f.owner.id, bounded.id)).failureCode,
        "TIMEOUT",
      );
    } finally {
      await f.close();
    }
  },
);
test(
  "D5 real PostgreSQL/Redis: lost delivery reconciliation and bounded dead letters preserve outcomes",
  { timeout: 30000 },
  async () => {
    const f = await fixture();
    try {
      const job = await f.jobs.admit(f.owner.id, f.request());
      await f.dispatcher.dispatchOnce();
      await (await f.broker.queue.getJob(deliveryId(job.id, 0)))!.remove();
      const repairs = await Promise.all([
        f.dispatcher.repairDelivery(job.id),
        new OutboxDispatcher(f.db, f.broker.port).repairDelivery(job.id),
      ]);
      assert.deepEqual(repairs.sort(), [false, true]);
      assert.equal(await f.dispatcher.repairDelivery(job.id), false);
      assert.equal(
        (await f.jobs.owned(f.owner.id, job.id)).deliveryGeneration,
        1,
      );
      await f.dispatcher.dispatchOnce();
      const worker = f.worker();
      await worker.ready();
      await until(
        async () =>
          (await f.jobs.owned(f.owner.id, job.id)).state === "CHECKED",
      );
      assert.equal(await f.dispatcher.repairDelivery(job.id), false);
      const dead = await f.jobs.admit(f.owner.id, f.request());
      const event = await f.db.durableBuildOutbox.findFirstOrThrow({
        where: { jobId: dead.id },
      });
      await f.db.durableBuildOutbox.update({
        where: { id: event.id },
        data: { attempts: 7 },
      });
      const broken = new OutboxDispatcher(f.db, {
        add: async () => {
          throw new Error("private-broker-error");
        },
        state: async () => null,
      });
      await broken.dispatchOnce();
      const letter = await f.db.durableBuildOutbox.findUniqueOrThrow({
        where: { id: event.id },
      });
      assert.equal(letter.state, "DEAD");
      assert.equal(letter.attempts, 8);
      assert.equal(letter.failureCode, "DELIVERY_EXHAUSTED");
      assert.equal((await f.jobs.owned(f.owner.id, dead.id)).state, "FAILED");
      await f.broker.port.add(deliveryId(dead.id, 0), {
        version: 1,
        kind: "ISOLATION_PREFLIGHT",
        jobId: dead.id,
        generation: 0,
      });
      await delay(100);
      assert.equal((await f.jobs.owned(f.owner.id, dead.id)).state, "FAILED");
      const monitoring = await broken.monitor();
      assert.ok(monitoring.dead.some((row) => row.id === event.id));
      assert.equal(
        JSON.stringify(monitoring).includes("private-broker-error"),
        false,
      );
    } finally {
      await f.close();
    }
  },
);
