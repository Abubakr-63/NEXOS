import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  parseDelivery,
  createDurableWorker,
} from "../apps/worker/src/durable/queue";
import { backoffMs, deliveryId } from "../apps/worker/src/durable/outbox";
import { DurableJobs, transaction } from "../apps/worker/src/durable/jobs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
const { Prisma } = createRequire(resolve("apps/worker/package.json"))(
  "@prisma/client",
);

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

test("raw PostgreSQL serialization/deadlock failures retry the whole transaction with a finite budget", async () => {
  const failure = (code: string) =>
    new Prisma.PrismaClientKnownRequestError("private database diagnostic", {
      code: "P2010",
      clientVersion: "6.19.0",
      meta: { code },
    });
  for (const sqlState of ["40001", "40P01"]) {
    let calls = 0;
    const db = {
      $transaction: async () => {
        if (++calls === 1) throw failure(sqlState);
        return "committed";
      },
    };
    assert.equal(
      await transaction(db as never, async () => "unused"),
      "committed",
    );
    assert.equal(calls, 2);
  }
  let calls = 0;
  await assert.rejects(
    transaction(
      {
        $transaction: async () => {
          calls++;
          throw failure("40001");
        },
      } as never,
      async () => undefined,
    ),
    { code: "DATABASE_UNAVAILABLE" },
  );
  assert.equal(calls, 4);
  calls = 0;
  await assert.rejects(
    transaction(
      {
        $transaction: async () => {
          calls++;
          throw failure("XX000");
        },
      } as never,
      async () => undefined,
    ),
    { code: "DATABASE_UNAVAILABLE" },
  );
  assert.equal(calls, 1);
});
