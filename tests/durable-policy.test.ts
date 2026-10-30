import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  parseDelivery,
  createDurableWorker,
} from "../apps/worker/src/durable/queue";
import { backoffMs, deliveryId } from "../apps/worker/src/durable/outbox";
import { DurableJobs } from "../apps/worker/src/durable/jobs";

test("durable delivery admits identity only and cannot carry commands, secrets or forged compilation", () => {
  const input = {
    version: 1,
    kind: "ISOLATION_PREFLIGHT",
    jobId: randomUUID(),
    generation: 0,
  };
  assert.deepEqual(parseDelivery(input), input);
  assert.equal(deliveryId(input.jobId, 0), `${input.jobId}-g0`);
  for (const change of [
    { command: "make" },
    { environment: { secret: "private" } },
    { kind: "ANDROID_BUILD" },
    { compiled: true },
    { generation: 9 },
    { generation: -1 },
    { version: 2 },
    { jobId: "../invalid" },
  ])
    assert.throws(() => parseDelivery({ ...input, ...change }));
});
test("outbox backoff increases with a finite ceiling and test fault injection cannot activate in production", () => {
  assert.deepEqual(
    Array.from({ length: 8 }, (_, n) => backoffMs(n + 1)),
    [250, 500, 1000, 2000, 4000, 8000, 16000, 30000],
  );
  assert.equal(backoffMs(100000), 30000);
  const old = process.env.NODE_ENV;
  try {
    process.env.NODE_ENV = "production";
    assert.throws(
      () => new DurableJobs({} as never, undefined, {}),
      /TEST_ISOLATION_REQUIRED/,
    );
    assert.throws(
      () =>
        createDurableWorker(
          { prefix: "bull" } as never,
          {} as never,
          {} as never,
          undefined,
          undefined,
          { lockDuration: 500, stalledInterval: 500 },
        ),
      /TEST_ISOLATION_REQUIRED/,
    );
  } finally {
    if (old === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = old;
  }
});
