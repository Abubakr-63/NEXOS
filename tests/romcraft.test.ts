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
