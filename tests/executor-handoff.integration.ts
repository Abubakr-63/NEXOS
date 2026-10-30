import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID, randomBytes } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { redisConnection } from "../apps/worker/src/foundation";
import {
  createTestAttemptStore,
  HandoffError,
  type CheckRecord,
  type Grant,
} from "../apps/worker/src/executor/attempt-store";
import {
  runPreflight,
  recoverPreflight,
  type PreflightTransport,
} from "../apps/worker/src/executor/coordinator";
import { CUTTLEFISH } from "../apps/worker/src/executor/policy";
const { Queue } = createRequire(resolve("apps/worker/package.json"))(
  "bullmq",
) as {
  Queue: new (
    name: string,
    options: object,
  ) => Parameters<typeof createTestAttemptStore>[0];
};
process.env.NODE_ENV = "test";
const redis = process.env.REDIS_URL ?? "redis://127.0.0.1:6379";
const owner = "test-owner";
const request = () => ({
  requestId: randomUUID(),
  revisionId: "reviewed-revision",
});
const authorize = async (actorId: string, revisionId: string) => ({
  ownerId: actorId,
  revisionId,
  snapshotDigest: "b".repeat(64),
  target: CUTTLEFISH,
});
const grant = (record: CheckRecord): Grant => ({
  slot: record.slot,
  requestId: record.requestId,
  attemptId: record.attemptId!,
  fence: record.fence,
  deadline: record.deadline,
});
async function fixture(timings = { leaseMs: 600, timeoutMs: 2000 }) {
  const prefix = `nexos-test-d4-${randomBytes(8).toString("hex")}`;
  const queue = new Queue("romhub-executor-handoff", {
    prefix,
    connection: redisConnection(redis),
  });
  queue.on("error", () => {});
  await queue.waitUntilReady();
  const store = createTestAttemptStore(queue, timings);
  return {
    queue,
    store,
    async close() {
      await (await queue.client).del(queue.toKey("d4-ledger"));
      await queue.obliterate({ force: true });
      const client = await queue.client;
      await queue.close();
      client.disconnect();
    },
  };
}
const checkedTransport = (): PreflightTransport => ({
  async execute(_grant, progress) {
    await progress("ISOLATED");
    await progress("PREFLIGHT_RUNNING");
  },
  async terminate() {
    return true;
  },
});
test(
  "real Redis handoff: loss of attempt authority aborts work and prevents stale progress/publication",
  { timeout: 15000 },
  async () => {
    const f = await fixture();
    try {
      const item = await f.store.admit(owner, request(), authorize);
      let entered!: () => void;
      const started = new Promise<void>((yes) => {
        entered = yes;
      });
      let lateProgress!: (stage: "PREFLIGHT_RUNNING") => Promise<void>;
      let terminated = 0;
      const running = runPreflight(f.store, item, {
        async execute(_grant, progress, signal) {
          lateProgress = progress;
          entered();
          await new Promise<void>((yes) =>
            signal.addEventListener("abort", () => yes(), { once: true }),
          );
        },
        async terminate() {
          terminated++;
          return true;
        },
      });
      await started;
      const old = grant(await f.store.read(owner, item));
      await f.store.quarantine(old);
      assert.equal((await running).state, "RECOVERY_REQUIRED");
      assert.equal(terminated, 1);
      await assert.rejects(lateProgress("PREFLIGHT_RUNNING"));
      assert.equal(
        (await f.store.read(owner, item)).state,
        "RECOVERY_REQUIRED",
      );
      await recoverPreflight(f.store, item, checkedTransport());
      assert.equal(
        (await runPreflight(f.store, item, checkedTransport())).state,
        "CHECKED",
      );
      await assert.rejects(f.store.finish(old, "CHECKED", true), {
        code: "FENCED",
      });
    } finally {
      await f.close();
    }
  },
);
test(
  "real Redis handoff: ownership, strict requests, immutable idempotency and bounded admission",
  { timeout: 15000 },
  async () => {
    const f = await fixture();
    try {
      const input = request();
      const same = await Promise.all(
        Array.from({ length: 20 }, () =>
          f.store.admit(owner, input, authorize),
        ),
      );
      assert.equal(new Set(same.map((r) => r.slot)).size, 1);
      await assert.rejects(f.store.read("other-owner", same[0]), {
        code: "NOT_FOUND",
      });
      await assert.rejects(f.store.cancel("other-owner", same[0]), {
        code: "NOT_FOUND",
      });
      await assert.rejects(
        f.store.admit(owner, input, async () => null),
        { code: "NOT_FOUND" },
      );
      await assert.rejects(
        f.store.admit(owner, input, async () => {
          throw new Error("private-authority-secret");
        }),
        { code: "AUTHORITY_UNAVAILABLE" },
      );
      await assert.rejects(
        f.store.admit(owner, input, async () => ({
          ...(await authorize(owner, input.revisionId)),
          ownerId: "other-owner",
        })),
        { code: "NOT_FOUND" },
      );
      await assert.rejects(
        f.store.admit(
          owner,
          { ...input, revisionId: "changed-revision" },
          authorize,
        ),
        { code: "CONFLICT" },
      );
      for (const extra of [
        { command: "make" },
        { shell: "sh" },
        { env: {} },
        { artifactPath: "/tmp/out.zip" },
        { ownerId: owner },
      ])
        await assert.rejects(
          f.store.admit(owner, { ...request(), ...extra }, authorize),
          { code: "INVALID_REQUEST" },
        );
      await assert.rejects(
        f.store.admit(owner, request(), async (o, r) => ({
          ...(await authorize(o, r)),
          target: { ...CUTTLEFISH, product: "unknown" },
        })),
      );
      for (let n = 1; n < 16; n++)
        await f.store.admit(owner, request(), authorize);
      await assert.rejects(f.store.admit(owner, request(), authorize), {
        code: "CAPACITY",
      });
      assert.equal(
        Object.keys(
          await (await f.queue.client).hgetall(f.queue.toKey("d4-ledger")),
        ).length,
        16,
      );
      await (
        await f.queue.client
      ).hset(f.queue.toKey("d4-ledger"), {
        [String(same[0].slot)]: JSON.stringify({ ...same[0], compiled: true }),
      });
      await assert.rejects(f.store.read(owner, same[0]), {
        code: "INVALID_STATE",
      });
    } finally {
      await f.close();
    }
  },
);
test(
  "real Redis handoff: single reservation, legal progress, terminal cancellation and no compiled success",
  { timeout: 15000 },
  async () => {
    const f = await fixture();
    try {
      const first = await f.store.admit(owner, request(), authorize);
      const second = await f.store.admit(owner, request(), authorize);
      const active = grant(await f.store.claim(first));
      await assert.rejects(f.store.claim(second), { code: "BUSY" });
      await assert.rejects(f.store.progress(active, "PREFLIGHT_RUNNING"), {
        code: "TRANSITION",
      });
      await assert.rejects(f.store.finish(active, "CHECKED", true), {
        code: "TRANSITION",
      });
      for (const stage of [
        "ALLOCATED",
        "ISOLATED",
        "PREFLIGHT_RUNNING",
      ] as const)
        await f.store.progress(active, stage);
      await assert.rejects(f.store.finish(active, "CHECKED", false), {
        code: "CLEANUP_REQUIRED",
      });
      await f.store.cancel(owner, first);
      const canceled = await f.store.finish(active, "CHECKED", true);
      assert.equal(canceled.state, "CANCELLED");
      assert.equal(canceled.compiled, false);
      await assert.rejects(f.store.progress(active, "ALLOCATED"), {
        code: "FENCED",
      });
      const progress: unknown[] = [];
      const result = await runPreflight(f.store, second, checkedTransport(), {
        progress: (record) => progress.push(record),
      });
      assert.equal(result.state, "CHECKED");
      assert.equal(result.compiled, false);
      assert.equal(progress.length, 3);
      assert.equal(JSON.stringify(result).includes("artifact"), false);
      const waiting = await f.store.admit(owner, request(), authorize);
      await f.store.cancel(owner, waiting);
      await assert.rejects(runPreflight(f.store, waiting, checkedTransport()), {
        code: "NOT_QUEUED",
      });
    } finally {
      await f.close();
    }
  },
);
test(
  "real Redis handoff: expired/crashed attempt is fenced, cleanup gates restart and retries are bounded",
  { timeout: 15000 },
  async () => {
    const f = await fixture({ leaseMs: 100, timeoutMs: 1000 });
    try {
      const item = await f.store.admit(owner, request(), authorize);
      const old = grant(await f.store.claim(item));
      await delay(140);
      await assert.rejects(f.store.renew(old), { code: "FENCED" });
      assert.equal((await f.store.recover(item)).state, "RECOVERY_REQUIRED");
      await assert.rejects(f.store.recovered(old, false), {
        code: "CLEANUP_REQUIRED",
      });
      const restarted = createTestAttemptStore(f.queue, f.store.timings);
      assert.equal(
        (await restarted.read(owner, item)).state,
        "RECOVERY_REQUIRED",
      );
      await assert.rejects(
        recoverPreflight(restarted, item, {
          ...checkedTransport(),
          terminate: async () => false,
        }),
        { code: "CLEANUP_REQUIRED" },
      );
      assert.equal(
        (await recoverPreflight(restarted, item, checkedTransport())).state,
        "QUEUED",
      );
      const replacement = grant(await restarted.claim(item));
      assert.ok(replacement.fence > old.fence);
      assert.notEqual(replacement.attemptId, old.attemptId);
      await assert.rejects(restarted.finish(old, "FAILED", true), {
        code: "FENCED",
      });
      await delay(140);
      await restarted.recover(item);
      assert.equal(
        (await recoverPreflight(restarted, item, checkedTransport())).state,
        "FAILED",
      );
      await assert.rejects(restarted.claim(item), { code: "NOT_QUEUED" });
    } finally {
      await f.close();
    }
  },
);
test(
  "real Redis handoff: timeouts, active cancellation, worker faults and unconfirmed cleanup fail closed",
  { timeout: 15000 },
  async () => {
    const f = await fixture({ leaseMs: 150, timeoutMs: 650 });
    try {
      const timeout = await f.store.admit(owner, request(), authorize);
      const hung: PreflightTransport = {
        execute: async () => new Promise(() => {}),
        terminate: async () => true,
      };
      const timed = await runPreflight(f.store, timeout, hung);
      assert.equal(timed.state, "FAILED");
      assert.equal((await f.store.read(owner, timeout)).failure, "TIMEOUT");
      const cancel = await f.store.admit(owner, request(), authorize);
      let entered!: () => void;
      const started = new Promise<void>((yes) => {
        entered = yes;
      });
      const running = runPreflight(f.store, cancel, {
        ...hung,
        execute: async () => {
          entered();
          await new Promise(() => {});
        },
      });
      await started;
      await f.store.cancel(owner, cancel);
      assert.equal((await running).state, "CANCELLED");
      const fault = await f.store.admit(owner, request(), authorize);
      const failed = await runPreflight(f.store, fault, {
        ...hung,
        execute: async () => {
          throw new Error("private-command-or-secret");
        },
      });
      assert.equal(failed.state, "FAILED");
      assert.equal(
        (await f.store.read(owner, fault)).failure,
        "EXECUTOR_FAILED",
      );
      const orphan = await f.store.admit(owner, request(), authorize);
      const quarantined = await runPreflight(
        f.store,
        orphan,
        { ...checkedTransport(), terminate: async () => new Promise(() => {}) },
        { cleanupMs: 20 },
      );
      assert.equal(quarantined.state, "RECOVERY_REQUIRED");
      assert.equal(
        (await f.store.read(owner, orphan)).state,
        "RECOVERY_REQUIRED",
      );
      const other = await f.store.admit(owner, request(), authorize);
      await assert.rejects(f.store.claim(other), { code: "BUSY" });
      const raw = await (
        await f.queue.client
      ).hgetall(f.queue.toKey("d4-ledger"));
      assert.equal(
        JSON.stringify(raw).includes("private-command-or-secret"),
        false,
      );
    } finally {
      await f.close();
    }
  },
);
