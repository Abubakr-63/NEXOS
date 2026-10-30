import { test } from "node:test";
import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";
import { superviseWorker } from "../apps/worker/src/runtime";

function deferred() {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
function harness() {
  const listeners = new Map<string, () => void>();
  const events: { event: string }[] = [];
  const exits: number[] = [];
  const exited = deferred();
  return {
    listeners,
    events,
    exits,
    exited: exited.promise,
    host: {
      subscribe(signal: "SIGINT" | "SIGTERM", listener: () => void) {
        listeners.set(signal, listener);
        return () => {
          listeners.delete(signal);
        };
      },
      exit(code: number) {
        exits.push(code);
        exited.resolve();
      },
      log(record: { event: string }) {
        events.push(record);
      },
    },
  };
}

test(
  "worker signals close once, drain active work and remove signal handlers",
  { timeout: 2000 },
  async () => {
    const h = harness();
    const drain = deferred();
    let closes = 0;
    const runtime = superviseWorker(
      () => ({
        ready: async () => {},
        close: () => {
          closes++;
          return drain.promise;
        },
      }),
      h.host,
    );
    await delay(0);
    assert.deepEqual(h.events, [{ event: "worker.ready" }]);
    h.listeners.get("SIGTERM")!();
    h.listeners.get("SIGINT")!();
    runtime.stop();
    await delay(0);
    assert.equal(closes, 1);
    assert.deepEqual(h.exits, []);
    drain.resolve();
    await h.exited;
    assert.deepEqual(h.exits, [0]);
    assert.equal(h.listeners.size, 0);
  },
);

test(
  "worker construction and readiness errors fail closed without leaking exceptions",
  { timeout: 2000 },
  async () => {
    for (const construction of [false, true]) {
      const h = harness();
      let closes = 0;
      superviseWorker(() => {
        if (construction) throw new Error("private-redis-credential");
        return {
          ready: async () => {
            throw new Error("private-redis-credential");
          },
          close: async () => {
            closes++;
          },
        };
      }, h.host);
      await h.exited;
      assert.deepEqual(h.exits, [1]);
      assert.equal(closes, construction ? 0 : 1);
      assert.deepEqual(h.events, [{ event: "worker.start_failed" }]);
    }
  },
);

test(
  "fatal consumption failure drains and exits nonzero even during requested shutdown",
  { timeout: 2000 },
  async () => {
    const h = harness();
    const drain = deferred();
    let fatal!: () => void;
    const runtime = superviseWorker((callback) => {
      fatal = callback;
      return { ready: async () => {}, close: () => drain.promise };
    }, h.host);
    await delay(0);
    runtime.stop();
    fatal();
    drain.resolve();
    await h.exited;
    assert.deepEqual(h.exits, [1]);
    assert.equal(h.events.at(-1)?.event, "worker.run_failed");
    fatal();
    assert.equal(h.exits.length, 1);
  },
);

test(
  "startup deadline closes service and late readiness never reports healthy",
  { timeout: 2000 },
  async () => {
    const h = harness();
    const ready = deferred();
    let closes = 0;
    superviseWorker(
      () => ({
        ready: () => ready.promise,
        close: async () => {
          closes++;
        },
      }),
      h.host,
      { startupMs: 10, shutdownMs: 100 },
    );
    await h.exited;
    ready.resolve();
    await delay(0);
    assert.equal(closes, 1);
    assert.deepEqual(h.exits, [1]);
    assert.deepEqual(h.events, [{ event: "worker.start_timeout" }]);
  },
);

test(
  "shutdown deadline terminates hung cleanup once",
  { timeout: 2000 },
  async () => {
    const h = harness();
    const drain = deferred();
    const runtime = superviseWorker(
      () => ({
        ready: async () => {},
        close: () => drain.promise,
      }),
      h.host,
      { startupMs: 100, shutdownMs: 10 },
    );
    await delay(0);
    runtime.stop();
    await h.exited;
    assert.deepEqual(h.exits, [1]);
    assert.equal(h.events.at(-1)?.event, "worker.shutdown_timeout");
    drain.resolve();
    await delay(0);
    assert.equal(h.exits.length, 1);
    assert.equal(h.listeners.size, 0);
  },
);

test(
  "shutdown rejection is redacted and exits nonzero",
  { timeout: 2000 },
  async () => {
    const h = harness();
    const runtime = superviseWorker(
      () => ({
        ready: async () => {},
        close: async () => {
          throw new Error("private-job-payload");
        },
      }),
      h.host,
    );
    await delay(0);
    runtime.stop();
    await h.exited;
    assert.deepEqual(h.exits, [1]);
    assert.equal(h.events.at(-1)?.event, "worker.shutdown_failed");
    assert.equal(
      JSON.stringify(h.events).includes("private-job-payload"),
      false,
    );
  },
);

test(
  "signal during startup suppresses late readiness rejection",
  { timeout: 2000 },
  async () => {
    const h = harness();
    const ready = deferred();
    superviseWorker(
      () => ({ ready: () => ready.promise, close: async () => {} }),
      h.host,
    );
    await delay(0);
    h.listeners.get("SIGINT")!();
    await h.exited;
    ready.reject(new Error("private-startup-error"));
    await delay(0);
    assert.deepEqual(h.exits, [0]);
    assert.deepEqual(h.events, []);
  },
);
