import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  foundationJobSchema,
  probeResultSchema,
  canTransitionProbe,
} from "../packages/contracts/src";
import {
  redisConnection,
  createTestProbeController,
  createFoundationWorker,
} from "../apps/worker/src/foundation";
import {
  assessCuttlefishCandidate,
  getCuttlefishCandidate,
} from "../apps/api/src/build-targets/cuttlefish";

test("probe lifecycle has explicit terminal states and bounded retry transition", () => {
  assert.equal(canTransitionProbe("queued", "running"), true);
  assert.equal(canTransitionProbe("running", "queued"), true);
  assert.equal(canTransitionProbe("running", "completed"), true);
  for (const terminal of ["completed", "failed", "canceled"] as const)
    for (const state of [
      "queued",
      "running",
      "completed",
      "failed",
      "canceled",
    ] as const)
      assert.equal(canTransitionProbe(terminal, state), false);
  assert.equal(canTransitionProbe("queued", "completed"), false);
});
test("job schemas reject build requests, secrets, arbitrary scripts and forged compiled results", () => {
  const input = {
    version: 1,
    kind: "CONNECTIVITY_PROBE",
    requestId: randomUUID(),
    ownerId: randomUUID(),
  };
  assert.equal(foundationJobSchema.safeParse(input).success, true);
  for (const change of [
    { kind: "ANDROID_BUILD" },
    { script: "arbitrary" },
    { password: "private-marker" },
    { requestId: "not-an-id" },
    { version: 2 },
  ])
    assert.equal(
      foundationJobSchema.safeParse({ ...input, ...change }).success,
      false,
    );
  assert.equal(
    probeResultSchema.safeParse({
      kind: "CONNECTIVITY_PROBE",
      compiled: true,
      status: "checked",
    }).success,
    false,
  );
  assert.equal(
    probeResultSchema.safeParse({
      kind: "CONNECTIVITY_PROBE",
      compiled: false,
      status: "checked",
      artifact: "fake",
    }).success,
    false,
  );
  assert.equal(
    assessCuttlefishCandidate(getCuttlefishCandidate().selection).buildEligible,
    false,
  );
});
test("Redis URL options honor database, encoded credentials and certificate verification", () => {
  const options = redisConnection(
    "rediss://test%40user:sample%3Avalue@example.com:6380/2",
  );
  assert.equal(options.db, 2);
  assert.equal(options.username, "test@user");
  assert.equal(options.password, "sample:value");
  assert.equal(options.tls?.rejectUnauthorized, true);
  for (const url of [
    "https://localhost",
    "redis://localhost/abc",
    "redis://localhost/16",
    "redis://localhost/0?unsafe=1",
  ])
    assert.throws(() => redisConnection(url));
});
test("test producer and injected processors cannot be enabled in production", () => {
  const prior = process.env.NODE_ENV;
  try {
    process.env.NODE_ENV = "production";
    assert.throws(() =>
      createTestProbeController(
        "redis://localhost",
        "nexos-test-d3-1234567890abcdef",
      ),
    );
    assert.throws(() =>
      createFoundationWorker("redis://localhost", {
        prefix: "nexos-test-d3-1234567890abcdef",
        testHooks: {},
      }),
    );
    process.env.NODE_ENV = "test";
    assert.throws(() => createTestProbeController("redis://localhost", "bull"));
  } finally {
    if (prior === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = prior;
  }
});
