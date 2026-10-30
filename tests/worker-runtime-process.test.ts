import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createServer } from "node:net";
import { resolve } from "node:path";

test("compiled worker rejects invalid configuration with a redacted nonzero exit", () => {
  const result = spawnSync(
    process.execPath,
    [resolve("apps/worker/dist/main.js")],
    {
      env: { ...process.env, REDIS_URL: "https://private-credential.invalid" },
      encoding: "utf8",
      timeout: 5000,
    },
  );
  assert.equal(result.error, undefined);
  assert.equal(result.status, 1);
  assert.equal(result.stdout, "");
  assert.deepEqual(JSON.parse(result.stderr), { event: "worker.start_failed" });
});

test(
  "compiled worker exits within startup plus shutdown deadlines when Redis cannot connect",
  { timeout: 22000 },
  async () => {
    // Reserve a local TCP port without responding as Redis. No real Redis keys or DB.
    const sockets = new Set<import("node:net").Socket>();
    const server = createServer((socket) => {
      sockets.add(socket);
      socket.on("error", () => {});
      socket.on("close", () => sockets.delete(socket));
    });
    await new Promise<void>((yes) => server.listen(0, "127.0.0.1", yes));
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    // An asynchronous child lets the TCP fixture accept connections during startup.
    const { spawn } = await import("node:child_process");
    const child = spawn(
      process.execPath,
      [resolve("apps/worker/dist/main.js")],
      {
        env: { ...process.env, REDIS_URL: `redis://127.0.0.1:${address.port}` },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    let stderr = "";
    let stdout = "";
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    const deadline = setTimeout(() => child.kill("SIGKILL"), 18000);
    try {
      const code = await new Promise<number | null>((yes, no) => {
        child.once("error", no);
        child.once("exit", yes);
      });
      assert.equal(code, 1);
      assert.equal(stdout, "");
      const events = stderr
        .trim()
        .split(/\r?\n/)
        .map((line) => JSON.parse(line));
      assert.ok(
        events.some((record) =>
          ["worker.start_failed", "worker.start_timeout"].includes(
            record.event,
          ),
        ),
      );
      assert.equal(
        events.some((record) => record.event === "worker.ready"),
        false,
      );
      assert.ok(
        events.every((record) => Object.keys(record).join() === "event"),
      );
    } finally {
      clearTimeout(deadline);
      if (child.exitCode === null) child.kill("SIGKILL");
      sockets.forEach((socket) => socket.destroy());
      await new Promise<void>((yes) => server.close(() => yes()));
    }
  },
);
