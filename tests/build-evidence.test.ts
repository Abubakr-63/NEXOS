import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import {
  assessPhysicalDraft,
  assessVirtualTarget,
  defaultConfiguration,
  immutableAndroidRefSchema,
  validateConfiguration,
} from "../packages/contracts/src";
import {
  getCuttlefishCandidate,
  assessCuttlefishCandidate,
} from "../apps/api/src/build-targets/cuttlefish";
const now = new Date("2026-10-29T12:00:00.000Z");

test("reviewed Cuttlefish source declarations verify without enabling compilation or flashing", () => {
  const candidate = getCuttlefishCandidate();
  const result = assessCuttlefishCandidate(candidate.selection, now);
  assert.equal(result.configurationSupported, true);
  assert.equal(result.sourceTargetVerified, true);
  assert.equal(result.compilerStatus, "UNAVAILABLE");
  assert.equal(result.deviceROMStatus, "NOT_APPLICABLE");
  assert.equal(result.buildEligible, false);
  assert.equal(result.flashEligible, false);
  assert.ok(result.missingPrerequisites.includes("LUNCH_PREFLIGHT"));
  candidate.state = "REVOKED";
  assert.equal(
    assessCuttlefishCandidate(candidate.selection, now).sourceTargetVerified,
    true,
  );
});
test("offline upstream observations retain their SHA256 and Git blob identities and source facts", () => {
  for (const item of getCuttlefishCandidate().observations) {
    const bytes = readFileSync(
      `tests/fixtures/android-source/aosp16-r4/${item.file}`,
    );
    assert.equal(createHash("sha256").update(bytes).digest("hex"), item.sha256);
    assert.equal(
      createHash("sha1")
        .update(`blob ${bytes.length}\0`)
        .update(bytes)
        .digest("hex"),
      item.gitBlob,
    );
  }
  const file = (name: string) =>
    readFileSync(`tests/fixtures/android-source/aosp16-r4/${name}`, "utf8");
  assert.match(
    file("AndroidProducts.mk"),
    /aosp_cf_x86_64_only_phone:.*vsoc_x86_64_only\/phone\/aosp_cf.mk/,
  );
  assert.match(file("aosp_cf.mk"), /PRODUCT_NAME := aosp_cf_x86_64_only_phone/);
  assert.match(file("BoardConfig.mk"), /TARGET_ARCH := x86_64/);
  assert.match(
    file("release_config_map.textproto"),
    /name: "aosp_current"\s+target: "bp4a"/,
  );
  assert.match(file("envsetup.sh"), /TARGET_BUILD_VARIANT/);
  assert.match(
    file("manifest.xml"),
    /revision="refs\/tags\/android-16.0.0_r4"/,
  );
});
test("invalid references, unsupported branches, products, releases, variants and architectures fail closed", () => {
  const candidate = getCuttlefishCandidate();
  for (const ref of [
    "main",
    "refs/heads/android-latest-release",
    "latest",
    "../foo",
    "a".repeat(39),
  ])
    assert.equal(immutableAndroidRefSchema.safeParse(ref).success, false);
  for (const change of [
    { sourceRef: "refs/tags/android-15.0.0_r1" },
    { product: "aosp_panther" },
    { releaseConfig: "trunk_staging" },
    { architecture: "arm64" },
    { buildVariant: "user" },
    { candidateId: "unknown" },
  ]) {
    const result = assessCuttlefishCandidate(
      { ...candidate.selection, ...change },
      now,
    );
    assert.equal(result.sourceTargetVerified, false);
    assert.equal(result.buildEligible, false);
  }
});
test("missing, revoked, malformed and stale evidence cannot assert source verification", () => {
  const candidate = getCuttlefishCandidate();
  for (const evidence of [
    null,
    { ...candidate, observations: [] },
    { ...candidate, state: "REVOKED" },
    { ...candidate, checkedAt: "2025-01-01T00:00:00.000Z" },
    {
      ...candidate,
      observations: candidate.observations.map((o) => ({
        ...o,
        repository: "http://insecure.example",
      })),
    },
  ])
    assert.equal(
      assessVirtualTarget(candidate.selection, evidence, now)
        .sourceTargetVerified,
      false,
    );
  assert.equal(
    assessVirtualTarget(candidate.selection, candidate, new Date("invalid"))
      .sourceTargetVerified,
    false,
  );
  assert.equal(
    assessVirtualTarget(candidate.selection, candidate, new Date("2026-10-28"))
      .sourceTargetVerified,
    false,
  );
});
test("known phone identity never confers build support; unknown or mismatched hardware fails closed", () => {
  const identity = {
    manufacturerId: "google",
    deviceId: "pixel-7",
    variantId: "panther",
    modelNumber: "GVU6C",
    region: "Global",
    codename: "panther",
    hardwareVariant: null,
    deprecated: false,
    isDemo: false,
  };
  const config = { ...defaultConfiguration, variantId: identity.variantId };
  assert.equal(
    assessPhysicalDraft(config, identity).identityState,
    "CATALOGED",
  );
  for (const claim of [
    { ...identity, codename: "shiba" },
    { ...identity, variantId: "other" },
    { ...identity, manufacturerId: "other" },
  ])
    assert.equal(
      assessPhysicalDraft(config, identity, claim).identityState,
      "INCONSISTENT_OR_DEPRECATED",
    );
  for (const device of [
    identity,
    null,
    { ...identity, deprecated: true },
    { ...identity, isDemo: true },
  ]) {
    const result = assessPhysicalDraft(config, device);
    assert.equal(result.sourceTargetVerified, false);
    assert.equal(result.configurationSupported, false);
    assert.equal(result.buildEligible, false);
    assert.equal(result.deviceROMStatus, "UNVERIFIED");
  }
});
test("existing draft validation and response contract remain unchanged", () => {
  const result = validateConfiguration(defaultConfiguration, false);
  assert.equal(result.status, "UNKNOWN");
  assert.equal(result.ruleVersion, "foundation-1");
});
