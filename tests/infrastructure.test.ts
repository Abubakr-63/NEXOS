import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import {
  StartupConfigurationError,
  validateEnvironment,
  redisSettings,
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
    AUTH_ACCOUNT_HMAC_KEY: process.env.AUTH_ACCOUNT_HMAC_KEY,
  };
  try {
    process.env.NODE_ENV = "test";
    process.env.AUTH_ACCOUNT_HMAC_KEY = "ab".repeat(32);
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

test("Redis settings reject unsafe URLs and namespaces without leaking credentials", () => {
  const keys = ["NODE_ENV", "REDIS_URL", "RATE_LIMIT_NAMESPACE"];
  const previous = Object.fromEntries(
    keys.map((key) => [key, process.env[key]]),
  );
  try {
    process.env.NODE_ENV = "production";
    delete process.env.REDIS_URL;
    assert.throws(redisSettings, StartupConfigurationError);
    for (const value of [
      "http://localhost:6379",
      "redis://localhost/not-a-db",
      "redis://localhost/0?password=secret",
      "redis://%ZZ:secret@localhost/0",
    ]) {
      process.env.REDIS_URL = value;
      assert.throws(
        redisSettings,
        (error: unknown) =>
          error instanceof StartupConfigurationError &&
          !error.message.includes("secret"),
      );
    }
    process.env.REDIS_URL = "rediss://localhost:6379/2";
    process.env.RATE_LIMIT_NAMESPACE = "unsafe{namespace}";
    assert.throws(redisSettings, /RATE_LIMIT_NAMESPACE/);
    process.env.RATE_LIMIT_NAMESPACE = "nexos:test:valid";
    assert.equal(redisSettings().namespace, "nexos:test:valid");
  } finally {
    for (const key of keys) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  }
});
