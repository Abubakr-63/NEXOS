import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { resolve } from "node:path";
const {
  TARGET_QUERY,
  normalizeLoopback,
  assertLocalConnection,
  assertLocalMigrationTarget,
} = createRequire(resolve("apps/api/package.json"))(
  "./scripts/local-migration-target.cjs",
);
const connection = "postgresql://test:test@127.0.0.1:5433/nexos_development";
const row = {
  database: "nexos_development",
  address: "127.0.0.1",
  port: 5433,
  recovery: false,
};

test("local migration guard normalizes host text and exact local IPv4/IPv6 representations", () => {
  assert.match(TARGET_QUERY, /host\(inet_server_addr\(\)\)/);
  assert.match(TARGET_QUERY, /inet_server_port\(\)::integer/);
  for (const value of [
    "127.0.0.1",
    "127.0.0.1/32",
    "::ffff:127.0.0.1",
    "::ffff:7f00:1/128",
  ]) {
    assert.equal(normalizeLoopback(value), "127.0.0.1");
    assert.equal(
      assertLocalMigrationTarget(
        connection,
        { ...row, address: value },
        "development",
      ).address,
      "127.0.0.1",
    );
  }
  for (const value of ["::1", "0:0:0:0:0:0:0:1", "::1/128"]) {
    assert.equal(normalizeLoopback(value), "::1");
    assert.equal(
      assertLocalMigrationTarget(
        connection.replace("127.0.0.1", "[::1]"),
        { ...row, address: value },
        "development",
      ).address,
      "::1",
    );
  }
});

test("local migration guard rejects wrong identities, native/nullable types and ambiguous or remote endpoints", () => {
  for (const change of [
    { database: "production" },
    { database: null },
    { port: 5432 },
    { port: "5433" },
    { port: null },
    { recovery: true },
    { recovery: null },
    { address: null },
    { address: undefined },
    { address: {} },
    { address: "192.168.1.1" },
    { address: "127.0.0.2" },
    { address: "0.0.0.0" },
    { address: "::" },
    { address: "::2" },
    { address: "::1" },
    { address: "::ffff:192.168.1.1" },
    { address: "127.0.0.1/24" },
    { address: "::1/64" },
    { address: "::1%lo0" },
  ])
    assert.throws(() =>
      assertLocalMigrationTarget(
        connection,
        { ...row, ...change },
        "development",
      ),
    );
  for (const host of [
    "localhost",
    "127.1",
    "2130706433",
    "0x7f000001",
    "127.000.0.1",
    "example.com",
    "192.168.1.1",
  ]) {
    assert.throws(() =>
      assertLocalConnection(
        connection.replace("127.0.0.1", host),
        "development",
      ),
    );
  }
  for (const value of [
    connection.replace(":5433", ":5432"),
    connection.replace(":5433", ""),
    connection.replace("nexos_development", "nexos_test"),
    connection + "/",
    connection + "#x",
    connection + "?host=remote",
    connection + "?options=-c%20search_path=other",
    connection + "?schema=other",
    connection + "?schema=public&schema=public",
    connection.replace("nexos_development", "%6eexos_development"),
  ])
    assert.throws(() => assertLocalConnection(value, "development"));
  assert.throws(() => assertLocalConnection(connection, "production"));
  assert.equal(
    assertLocalConnection(connection + "?schema=public", "development"),
    "127.0.0.1",
  );
});
