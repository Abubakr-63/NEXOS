import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import * as contracts from "../packages/contracts/src";
import type { z } from "../packages/contracts/node_modules/zod";

const api = createRequire(resolve("apps/api/package.json"));
const corpus = JSON.parse(
  readFileSync(resolve("tests/fixtures/zod3-contract-baseline.json"), "utf8"),
);
const schemas: Record<string, z.ZodType> = {
  registrationSchema: contracts.registrationSchema,
  loginSchema: contracts.loginSchema,
  catalogQuerySchema: contracts.catalogQuerySchema,
  deviceQuerySchema: contracts.deviceQuerySchema,
  romConfigurationSchema: contracts.romConfigurationSchema,
  saveConfigurationSchema: contracts.saveConfigurationSchema,
  projectMetadataSchema: contracts.projectMetadataSchema,
};

test("Zod 4 preserves the Zod 3 schema corpus and ordinary public error messages", () => {
  const differences: string[] = [];
  for (const sample of corpus.cases) {
    const result = schemas[sample.schema].safeParse(sample.input);
    const actual = result.success
      ? { success: true, data: result.data }
      : {
          success: false,
          issues: result.error.issues.map((i) => ({
            path: i.path,
            message: i.message,
          })),
        };
    if (["config-apps-8", "config-apps-9"].includes(sample.id)) {
      // Security change: one size error, no unbounded per-element errors/refinement scan.
      assert.equal(result.success, false, sample.id);
      if (!result.success) {
        assert.equal(result.error.issues.length, 1, sample.id);
        assert.equal(
          result.error.issues[0].message,
          sample.expected.issues[0].message,
          sample.id,
        );
      }
    } else if (JSON.stringify(actual) !== JSON.stringify(sample.expected)) {
      differences.push(sample.id);
    }
  }
  // Print case identifiers only, never credential payloads/normalized passwords.
  assert.deepEqual(differences, []);
});

test("API and compiled contracts share patched ZodError and keep output/input types", () => {
  assert.equal(api("zod/package.json").version, "4.6.6");
  const runtime = api("@rom-hub/contracts");
  const bad = runtime.registrationSchema.safeParse({});
  assert.equal(bad.success, false);
  assert.ok(bad.error instanceof api("zod").ZodError);
  const input: z.input<typeof contracts.romConfigurationSchema> = {
    ...contracts.defaultConfiguration,
    description: undefined,
  };
  const output: contracts.ROMConfiguration =
    contracts.romConfigurationSchema.parse(input);
  const description: string = output.description;
  const apps: ("browser" | "calendar" | "files" | "terminal")[] = output.apps;
  assert.equal(description, "");
  assert.deepEqual(apps, ["browser", "files"]);
  assert.deepEqual(
    JSON.parse(JSON.stringify(output)),
    contracts.defaultConfiguration,
  );
  assert.equal(
    contracts.romConfigurationSchema.safeParse({ ...input, description: null })
      .success,
    false,
  );
});

test("oversized arrays are rejected before reading items or running duplicate scans", () => {
  const apps = new Array(10000);
  Object.defineProperty(apps, 0, {
    get() {
      throw new Error("oversized elements must not be visited");
    },
  });
  const result = contracts.romConfigurationSchema.safeParse({
    ...contracts.defaultConfiguration,
    apps,
  });
  assert.equal(result.success, false);
  if (!result.success) {
    assert.equal(result.error.issues.length, 1);
    assert.equal(
      result.error.issues[0].message,
      "Array must contain at most 4 element(s)",
    );
  }
  assert.equal(
    contracts.romConfigurationSchema.safeParse({
      ...contracts.defaultConfiguration,
      apps: ["browser", "browser"],
    }).success,
    false,
  );
});

test("malicious collection input fails within a bounded child heap and keeps issue output bounded", () => {
  const entry = api.resolve("@rom-hub/contracts");
  const script = `const c=require(${JSON.stringify(entry)});const r=c.romConfigurationSchema.safeParse({...c.defaultConfiguration,apps:Array(100000).fill('invalid')});if(r.success||r.error.issues.length!==1)process.exit(1);process.stdout.write('bounded');`;
  const result = spawnSync(
    process.execPath,
    ["--max-old-space-size=64", "-e", script],
    { encoding: "utf8", timeout: 5000, maxBuffer: 4096 },
  );
  assert.equal(
    result.status,
    0,
    "bounded collection child must complete successfully",
  );
  assert.equal(result.signal, null);
  assert.equal(result.stdout, "bounded");
});
