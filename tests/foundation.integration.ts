import { test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { fork } from "node:child_process";
import { once } from "node:events";
import { createServer, connect, type Socket } from "node:net";
import { setTimeout as delay } from "node:timers/promises";
import {
  createTestProbeController,
  createFoundationWorker,
  CAPACITY,
  ProbeAccessError,
  ProbeUnavailableError,
  ProbeCapacityError,
} from "../apps/worker/src/foundation";
process.env.NODE_ENV = "test";
const redis = process.env.REDIS_URL ?? "redis://127.0.0.1:6379";
const prefix = () => `nexos-test-d3-${randomBytes(8).toString("hex")}`;
const payload = () => ({
  version: 1,
  kind: "CONNECTIVITY_PROBE",
  requestId: randomUUID(),
  ownerId: randomUUID(),
});
async function until(check: () => Promise<boolean>, timeout = 12000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    if (await check()) return;
    await delay(25);
  }
  throw new Error("Probe condition timed out");
}
async function cleanup(
  controller: ReturnType<typeof createTestProbeController>,
) {
  // Only the suite's random, enforced test prefix. Never flush a Redis database.
  await controller.queue.obliterate({ force: true });
  await (
    await controller.queue.client
  ).del(controller.queue.toKey("d3-cancellations"));
  await controller.close();
}

test(
  "real Redis: unexpected consumption loop resolution or rejection notifies the supervisor",
  { timeout: 20000 },
  async () => {
    for (const rejects of [false, true]) {
      const key = prefix();
      const controller = createTestProbeController(redis, key);
      let notified = 0;
      const worker = createFoundationWorker(redis, {
        prefix: key,
        onFatal: () => {
          notified++;
        },
      });
      // Fault the loop boundary, leaving actual Redis readiness/cleanup intact.
      worker.worker.run = async () => {
        if (rejects) throw new Error("private-runtime-failure");
      };
      try {
        await controller.ready();
        await worker.ready();
        await until(async () => notified === 1);
        await worker.close();
        assert.equal(notified, 1);
        await assert.rejects(worker.ready(), ProbeUnavailableError);
      } finally {
        await worker.close();
        await cleanup(controller);
      }
    }
  },
);

test(
  "real Redis: atomic bounded admission, distributed dedup, ownership and two-worker concurrency",
  { timeout: 20000 },
  async () => {
    const key = prefix();
    const first = createTestProbeController(redis, key);
    const second = createTestProbeController(redis, key);
    const workers: ReturnType<typeof createFoundationWorker>[] = [];
    try {
      await first.ready();
      await second.ready();
      const input = payload();
      const repeated = await Promise.all(
        Array.from({ length: 20 }, (_, n) =>
          (n % 2 ? first : second).submit(input),
        ),
      );
      assert.equal(new Set(repeated.map((item) => item.id)).size, 1);
      await assert.rejects(
        first.status(repeated[0].id, input.requestId, randomUUID()),
        ProbeAccessError,
      );
      await assert.rejects(
        second.cancel(repeated[0].id, input.requestId, randomUUID()),
        ProbeAccessError,
      );
      const extra = await Promise.allSettled(
        Array.from({ length: 32 }, () => second.submit(payload())),
      );
      assert.equal(
        extra.filter((result) => result.status === "fulfilled").length,
        CAPACITY - 1,
      );
      assert.ok(
        extra
          .filter((result) => result.status === "rejected")
          .every((result) => result.reason instanceof ProbeCapacityError),
      );
      assert.equal(
        (await first.queue.getJobs(["wait", "active", "completed", "failed"]))
          .length,
        CAPACITY,
      );
      assert.equal(
        (await second.cancel(repeated[0].id, input.requestId, input.ownerId))
          .accepted,
        true,
      );
      let active = 0;
      let peak = 0;
      const hook = async () => {
        active++;
        peak = Math.max(peak, active);
        await delay(40);
        active--;
      };
      workers.push(
        createFoundationWorker(redis, {
          prefix: key,
          testHooks: { beforeProbe: hook },
        }),
        createFoundationWorker(redis, {
          prefix: key,
          testHooks: { beforeProbe: hook },
        }),
      );
      await Promise.all(workers.map((worker) => worker.ready()));
      await until(
        async () => (await first.queue.getCompletedCount()) === CAPACITY,
      );
      assert.equal(peak, 2);
      assert.equal(
        (await first.status(repeated[0].id, input.requestId, input.ownerId))
          .state,
        "canceled",
      );
      assert.equal(
        (await first.cancel(repeated[0].id, input.requestId, input.ownerId))
          .accepted,
        false,
      );
      assert.equal((await second.submit(input)).id, repeated[0].id);
    } finally {
      await Promise.all(workers.map((worker) => worker.close()));
      await second.close();
      await cleanup(first);
    }
  },
);

test(
  "real Redis: controlled retry, malformed/build rejection, cooperative cancellation and graceful close",
  { timeout: 20000 },
  async () => {
    const key = prefix();
    const controller = createTestProbeController(redis, key);
    let worker: ReturnType<typeof createFoundationWorker> | undefined;
    let release: (() => void) | undefined;
    try {
      await controller.ready();
      const input = payload();
      const retry = await controller.submit(input);
      let calls = 0;
      const events: unknown[] = [];
      worker = createFoundationWorker(redis, {
        prefix: key,
        log: (event) => events.push(event),
        testHooks: {
          beforeProbe: async () => {
            if (++calls === 1) throw new Error("private-probe-marker");
          },
        },
      });
      await worker.ready();
      await until(
        async () =>
          (await controller.status(retry.id, input.requestId, input.ownerId))
            .state === "completed",
      );
      assert.equal(calls, 2);
      assert.equal(
        (await controller.status(retry.id, input.requestId, input.ownerId))
          .attemptsMade,
        2,
      );
      await worker.close();
      worker = undefined;
      const waiting = payload();
      const item = await controller.submit(waiting);
      let entered = false;
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      worker = createFoundationWorker(redis, {
        prefix: key,
        log: (event) => events.push(event),
        testHooks: {
          beforeProbe: async () => {
            entered = true;
            await gate;
          },
        },
      });
      await worker.ready();
      await until(async () => entered);
      assert.equal(
        (await controller.cancel(item.id, waiting.requestId, waiting.ownerId))
          .accepted,
        true,
      );
      let closed = false;
      const closing = worker.close().then(() => {
        closed = true;
      });
      await delay(60);
      assert.equal(closed, false);
      release!();
      await closing;
      worker = undefined;
      const canceled = await controller.status(
        item.id,
        waiting.requestId,
        waiting.ownerId,
      );
      assert.equal(canceled.state, "canceled");
      assert.equal(canceled.compiled, false);
      const used = new Set(
        (await controller.queue.getJobs(["completed"])).map((job) => job.id),
      );
      const id = Array.from({ length: CAPACITY }, (_, n) => `probe-${n}`).find(
        (value) => !used.has(value),
      )!;
      await controller.queue.add(
        "ANDROID_BUILD",
        { ...payload(), kind: "ANDROID_BUILD" } as never,
        { jobId: id, attempts: 5 },
      );
      worker = createFoundationWorker(redis, {
        prefix: key,
        log: (event) => events.push(event),
      });
      await worker.ready();
      await until(
        async () =>
          (await controller.queue.getJob(id))
            ?.getState()
            .then((state) => state === "failed") ?? false,
      );
      const rejected = await controller.queue.getJob(id);
      assert.equal(rejected?.attemptsMade, 1);
      assert.equal(rejected?.failedReason, "Unsupported foundation job");
      assert.equal(
        JSON.stringify(events).includes("private-probe-marker"),
        false,
      );
      assert.ok(
        events.every((event) => Object.keys(event as object).length === 1),
      );
    } finally {
      release?.();
      await worker?.close();
      await cleanup(controller);
    }
  },
);

test(
  "real Redis: killed worker lock expires and a replacement recovers the probe",
  { timeout: 20000 },
  async () => {
    const key = prefix();
    const controller = createTestProbeController(redis, key);
    let replacement: ReturnType<typeof createFoundationWorker> | undefined;
    const child = fork("tests/helpers/foundation-crash.cjs", [key], {
      env: { ...process.env, REDIS_URL: redis },
      stdio: ["ignore", "ignore", "ignore", "ipc"],
    });
    try {
      await controller.ready();
      const ready = new Promise<void>((resolve, reject) => {
        child.on("message", (message) => {
          if (message === "ready") resolve();
        });
        child.once("exit", () =>
          reject(new Error("Crash fixture exited early")),
        );
      });
      await ready;
      const claimed = new Promise<void>((resolve) =>
        child.on("message", (message) => {
          if (message === "claimed") resolve();
        }),
      );
      const input = payload();
      const job = await controller.submit(input);
      await claimed;
      const exited = once(child, "exit");
      child.kill("SIGKILL");
      await exited;
      replacement = createFoundationWorker(redis, {
        prefix: key,
        testHooks: { lockDuration: 500, stalledInterval: 500 },
      });
      await replacement.ready();
      await until(
        async () =>
          (await controller.status(job.id, input.requestId, input.ownerId))
            .state === "completed",
      );
      assert.equal(
        (await controller.status(job.id, input.requestId, input.ownerId))
          .compiled,
        false,
      );
    } finally {
      if (child.exitCode === null && child.signalCode === null)
        child.kill("SIGKILL");
      await replacement?.close();
      await cleanup(controller);
    }
  },
);

test(
  "real Redis via isolated TCP proxy: fail closed on outage and deduplicate after restoration",
  { timeout: 20000 },
  async () => {
    const upstream = new URL(redis);
    const sockets = new Set<Socket>();
    const server = createServer((socket) => {
      sockets.add(socket);
      const remote = connect(
        Number(upstream.port || 6379),
        upstream.hostname.replace(/^\[|\]$/g, ""),
      );
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
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const port = address.port;
    const proxyURL = new URL(redis);
    proxyURL.hostname = "127.0.0.1";
    proxyURL.port = String(port);
    const key = prefix();
    const controller = createTestProbeController(proxyURL.toString(), key);
    let release: (() => void) | undefined;
    let entered = false;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const worker = createFoundationWorker(proxyURL.toString(), {
      prefix: key,
      testHooks: {
        beforeProbe: async () => {
          entered = true;
          await gate;
        },
      },
    });
    let live = true;
    try {
      await controller.ready();
      const input = payload();
      await worker.ready();
      const first = await controller.submit(input);
      await until(async () => entered);
      const closed = new Promise<void>((resolve) =>
        server.close(() => resolve()),
      );
      sockets.forEach((socket) => socket.destroy());
      await closed;
      live = false;
      await assert.rejects(controller.submit(payload()), ProbeUnavailableError);
      await assert.rejects(
        controller.status(first.id, input.requestId, input.ownerId),
        ProbeUnavailableError,
      );
      await new Promise<void>((resolve) =>
        server.listen(port, "127.0.0.1", resolve),
      );
      live = true;
      await controller.ready();
      assert.equal((await controller.submit(input)).id, first.id);
      await worker.ready();
      release!();
      await until(
        async () =>
          (await controller.status(first.id, input.requestId, input.ownerId))
            .state === "completed",
      );
      assert.equal(
        (await controller.status(first.id, input.requestId, input.ownerId))
          .compiled,
        false,
      );
      assert.equal(
        (
          await controller.queue.getJobs([
            "wait",
            "active",
            "completed",
            "failed",
          ])
        ).length,
        1,
      );
      await worker.close();
      await cleanup(controller);
    } finally {
      release?.();
      await worker.close();
      await controller.close().catch(() => {});
      if (live) {
        const done = new Promise<void>((resolve) =>
          server.close(() => resolve()),
        );
        sockets.forEach((socket) => socket.destroy());
        await done;
      }
    }
  },
);
