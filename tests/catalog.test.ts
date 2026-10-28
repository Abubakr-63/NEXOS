import { test } from "node:test";
import assert from "node:assert/strict";
import {
  curatedDevices,
  curatedAndroidBases,
} from "../packages/database/prisma/catalog-data";

test("curated variants have unique exact identities and primary evidence", () => {
  const variants = curatedDevices.flatMap((device) => device.variants);
  assert.equal(variants.length, 11);
  assert.equal(
    new Set(variants.map((variant) => variant.id)).size,
    variants.length,
  );
  for (const variant of variants) {
    assert.ok(variant.modelNumber);
    assert.ok(variant.hardwareVariant);
    assert.ok(variant.evidenceUrls.length);
    for (const link of [
      variant.officialSourceUrl,
      variant.sourceCodeUrl,
      ...variant.evidenceUrls,
    ])
      assert.equal(new URL(link).protocol, "https:");
  }
  assert.deepEqual(
    curatedDevices
      .find((device) => device.codename === "mojito")
      ?.variants.map((variant) => variant.modelNumber),
    ["M2101K7AG"],
  );
  assert.equal(
    curatedDevices.find((device) => device.codename === "mojito")?.variants[0]
      ?.sourceStatus,
    "UNREVIEWED",
  );
});

test("base versions have source references, not device compatibility lists", () => {
  assert.deepEqual(
    curatedAndroidBases.map((base) => base.androidVersion),
    ["16", "16"],
  );
  for (const base of curatedAndroidBases) {
    assert.ok(base.sourceRef);
    assert.ok(base.evidenceUrls.length >= 2);
    assert.equal("supportedDevices" in base, false);
    assert.equal("buildSupported" in base, false);
  }
});
