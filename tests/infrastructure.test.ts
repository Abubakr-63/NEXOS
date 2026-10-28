import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import {
  StartupConfigurationError,
  validateEnvironment,
} from "../apps/api/src/config";

test("workspace runner loads app environment and preserves explicit shell overrides", () => {
  const directory = mkdtempSync(resolve(tmpdir(), "romcraft-env-"));
  try {
    writeFileSync(
      resolve(directory, ".env"),
      "ROMCRAFT_ENV_TEST=app-file\nROMCRAFT_ENV_OVERRIDE=file\n",
    );
    const result = spawnSync(
      process.execPath,
      [
        resolve("scripts/with-env.mjs"),
        process.execPath,
        "-e",
        "process.stdout.write(JSON.stringify([process.env.ROMCRAFT_ENV_TEST,process.env.ROMCRAFT_ENV_OVERRIDE]))",
      ],
      {
        cwd: directory,
        env: { ...process.env, ROMCRAFT_ENV_OVERRIDE: "shell" },
        encoding: "utf8",
      },
    );
    assert.equal(result.status, 0);
    assert.deepEqual(JSON.parse(result.stdout), ["app-file", "shell"]);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("API validates missing database settings and exact browser origins without leaking values", () => {
  const old = {
    DATABASE_URL: process.env.DATABASE_URL,
    WEB_ORIGIN: process.env.WEB_ORIGIN,
    PORT: process.env.PORT,
    NODE_ENV: process.env.NODE_ENV,
    TRUSTED_PROXY_IPS: process.env.TRUSTED_PROXY_IPS,
  };
  try {
    process.env.NODE_ENV = "test";
    delete process.env.TRUSTED_PROXY_IPS;
    delete process.env.DATABASE_URL;
    assert.throws(validateEnvironment, /DATABASE_URL is missing/);
    process.env.DATABASE_URL = "not-a-postgres-url";
    assert.throws(validateEnvironment, StartupConfigurationError);
    for (const url of ["postgresql://localhost", "postgresql://localhost/"]) {
      process.env.DATABASE_URL = url;
      assert.throws(validateEnvironment, StartupConfigurationError);
    }
    process.env.DATABASE_URL = "postgresql://localhost/romcraft";
    process.env.WEB_ORIGIN = "http://localhost:3000/path";
    assert.throws(validateEnvironment, /exact browser origin/);
    process.env.WEB_ORIGIN = "http://localhost:3000";
    process.env.PORT = "0";
    assert.throws(validateEnvironment, /PORT must/);
    process.env.PORT = "4000";
    assert.deepEqual(validateEnvironment(), {
      origin: "http://localhost:3000",
      port: 4000,
      trustProxy: false,
    });
  } finally {
    for (const [key, value] of Object.entries(old)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
