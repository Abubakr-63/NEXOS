import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { HandoffQueue } from "../apps/worker/src/executor/attempt-store";
import {
  CUTTLEFISH,
  approvedTarget,
  targetDigest,
} from "../apps/worker/src/executor/policy";
import { preflightPlan } from "../apps/worker/src/executor/linux-plan";
import { createLinuxPreflightTransport } from "../apps/worker/src/executor/linux-transport";
import { createTestAttemptStore } from "../apps/worker/src/executor/attempt-store";
import {
  getCuttlefishCandidate,
  assessCuttlefishCandidate,
} from "../apps/api/src/build-targets/cuttlefish";

const qualification = () => ({
  kind: "LINUX_PREFLIGHT_V1" as const,
  qualifiedAt: new Date().toISOString(),
  image: `nexos/isolation-preflight@sha256:${"a".repeat(64)}`,
  cgroupV2: true as const,
  rootless: true as const,
  resourceEnforcementVerified: true as const,
  externalReaperVerified: true as const,
});
const grant = () => ({
  slot: 0,
  requestId: randomUUID(),
  attemptId: randomUUID(),
  fence: 1,
  deadline: Date.now() + 30000,
});
test("executor target allowlist agrees with D2 without promoting build or flash eligibility", () => {
  assert.deepEqual(
    approvedTarget(CUTTLEFISH),
    getCuttlefishCandidate().selection,
  );
  assert.equal(assessCuttlefishCandidate(CUTTLEFISH).buildEligible, false);
  assert.equal(targetDigest(CUTTLEFISH).length, 64);
  for (const change of [
    { product: "shiba" },
    { sourceRef: "main" },
    { architecture: "arm64" },
    { command: "make" },
    { environment: {} },
    { mounts: ["/"] },
  ])
    assert.throws(() => approvedTarget({ ...CUTTLEFISH, ...change }));
});
test("Linux plan has fixed identity, bounded resources and no host mounts, network or inherited commands", () => {
  const q = qualification();
  const g = grant();
  const plan = preflightPlan(q, g);
  assert.equal(plan.compiled, false);
  assert.equal(plan.executable, "/usr/bin/docker");
  for (const option of [
    "--pull=never",
    "--network=none",
    "--read-only",
    "--cap-drop=ALL",
    "--security-opt=no-new-privileges=true",
    "--user=10001:10001",
    "--memory=512m",
    "--memory-swap=512m",
    "--cpus=1",
    "--pids-limit=64",
    "--log-driver=none",
    "--init",
  ])
    assert.ok(plan.args.includes(option));
  assert.equal(plan.args.at(-1), q.image);
  assert.ok(plan.args.includes("--entrypoint=/usr/local/bin/nexos-preflight"));
  assert.ok(plan.args.includes(`--name=nexos-d4-${g.attemptId}`));
  assert.ok(
    plan.args.some(
      (arg) =>
        arg.startsWith("--tmpfs=/artifacts:") && arg.includes("size=16m"),
    ),
  );
  assert.equal(
    plan.args.some((arg) =>
      /^(--volume|--mount|--env|--privileged|--device)/.test(arg),
    ),
    false,
  );
  assert.equal(Object.isFrozen(plan.args), true);
});
test("missing, stale or incomplete qualification, mutable images and injected options fail closed", () => {
  for (const q of [
    undefined,
    {},
    { ...qualification(), externalReaperVerified: false },
    { ...qualification(), resourceEnforcementVerified: false },
    { ...qualification(), image: "nexos/isolation-preflight:latest" },
    { ...qualification(), command: "arbitrary" },
    { ...qualification(), qualifiedAt: "2020-01-01T00:00:00.000Z" },
    {
      ...qualification(),
      qualifiedAt: new Date(Date.now() + 60000).toISOString(),
    },
  ])
    assert.throws(() => preflightPlan(q, grant()));
  assert.throws(() =>
    preflightPlan(qualification(), { ...grant(), attemptId: "../../other" }),
  );
  assert.throws(() => preflightPlan(qualification(), { ...grant(), fence: 0 }));
  assert.throws(() =>
    preflightPlan(qualification(), { ...grant(), deadline: Date.now() - 1 }),
  );
  assert.throws(() =>
    preflightPlan(qualification(), {
      ...grant(),
      deadline: Date.now() + 60000,
    }),
  );
});
test("native executor cannot activate on Windows and unqualified hosts cannot spawn Docker", async () => {
  await assert.rejects(createLinuxPreflightTransport(undefined as never));
  if (process.platform === "win32")
    await assert.rejects(
      createLinuxPreflightTransport(qualification()),
      /LINUX_EXECUTOR_REQUIRED/,
    );
});
test("internal handoff harness cannot be enabled in production or a shared queue namespace", () => {
  const old = process.env.NODE_ENV;
  try {
    process.env.NODE_ENV = "production";
    assert.throws(() =>
      createTestAttemptStore({
        opts: { prefix: "nexos-test-d4-0123456789abcdef" },
      } as HandoffQueue),
    );
    process.env.NODE_ENV = "test";
    assert.throws(() =>
      createTestAttemptStore({ opts: { prefix: "bull" } } as HandoffQueue),
    );
  } finally {
    if (old === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = old;
  }
});
