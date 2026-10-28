import { test } from "node:test";
import assert from "node:assert/strict";
import {
  defaultConfiguration,
  romConfigurationSchema,
  validateConfiguration,
} from "../packages/contracts/src/index";
test("configuration rejects unknown fields, unsafe colors and duplicate apps", () => {
  for (const patch of [
    { ownerId: "someone" },
    { accent: "url(javascript:x)" },
    { apps: ["files", "files"] },
    { kernel: "arbitrary-kernel" },
    { schemaVersion: 2 },
  ])
    assert.equal(
      romConfigurationSchema.safeParse({ ...defaultConfiguration, ...patch })
        .success,
      false,
    );
});
test("unknown variants and absent manifests fail closed", () => {
  for (const exists of [true, false]) {
    const result = validateConfiguration(defaultConfiguration, exists);
    assert.equal(result.status, "UNKNOWN");
    assert.ok(result.blockingIssues.length >= 2);
    assert.deepEqual(result.evidence, []);
  }
});

test("metadata is bounded and legacy configurations still parse", () => {
  const { description: _description, ...legacy } = defaultConfiguration;
  assert.equal(romConfigurationSchema.parse(legacy).description, "");
  assert.equal(
    romConfigurationSchema.safeParse({
      ...legacy,
      description: "x".repeat(2001),
    }).success,
    false,
  );
  assert.equal(
    romConfigurationSchema.safeParse({ ...legacy, name: "   " }).success,
    false,
  );
});
