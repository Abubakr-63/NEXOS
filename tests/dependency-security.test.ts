import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { resolve } from "node:path";

// Resolve the exact copy Swagger uses, rather than an unrelated workspace copy.
const requireApi = createRequire(resolve("apps/api/package.json"));
const requireSwagger = createRequire(
  requireApi.resolve("@nestjs/swagger/package.json"),
);

test("Swagger's patched YAML dependency bounds empty merge sources", () => {
  const yaml = requireSwagger("js-yaml");
  assert.equal(requireSwagger("js-yaml/package.json").version, "5.4.1");
  // Tiny regression case; never execute the advisory's large denial-of-service payload.
  assert.throws(
    () =>
      yaml.load("empty: &e {}\nmerged:\n  <<: [*e, *e, *e]\n", {
        schema: yaml.YAML11_SCHEMA,
        maxTotalMergeKeys: 2,
      }),
    /maxTotalMergeKeys/,
  );
});

// The adapter pins Fastify independently of the direct API dependency.
test("API and Nest adapter resolve the same patched Fastify", async () => {
  const adapter = createRequire(
    requireApi.resolve("@nestjs/platform-fastify/package.json"),
  );
  assert.equal(requireApi("fastify/package.json").version, "5.12.6");
  assert.equal(adapter("fastify/package.json").version, "5.12.6");
  assert.equal(adapter.resolve("fastify"), requireApi.resolve("fastify"));
  const server = adapter("fastify")();
  try {
    server.get(
      "/headers",
      {
        schema: {
          headers: {
            type: "object",
            propertyNames: { not: { enum: ["X-Debug-Override"] } },
          },
        },
      },
      async () => "ok",
    );
    server.post("/denied", { schema: { body: false } }, async () => "unsafe");
    server.post(
      "/object",
      {
        schema: {
          body: {
            type: "object",
            required: ["name"],
            properties: { name: { type: "string" } },
          },
        },
      },
      async () => "ok",
    );
    assert.equal(
      (
        await server.inject({
          url: "/headers",
          headers: { "X-Debug-Override": "true" },
        })
      ).statusCode,
      400,
    );
    assert.equal((await server.inject({ url: "/headers" })).statusCode, 200);
    assert.equal(
      (await server.inject({ method: "POST", url: "/denied", payload: {} }))
        .statusCode,
      400,
    );
    assert.equal(
      (await server.inject({ method: "POST", url: "/object", payload: {} }))
        .statusCode,
      400,
    );
    assert.equal(
      (
        await server.inject({
          method: "POST",
          url: "/object",
          payload: { name: "valid" },
        })
      ).statusCode,
      200,
    );
    assert.equal((await server.inject({ url: "/%E0%A4%A" })).statusCode, 400);
  } finally {
    await server.close();
  }
});

test("Prisma config uses patched Effect and still loads valid configuration", async () => {
  const { mkdtemp, writeFile, rm } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const prisma = createRequire(resolve("packages/database/package.json"));
  const prismaCli = createRequire(prisma.resolve("prisma/package.json"));
  const configRequire = createRequire(prismaCli.resolve("@prisma/config"));
  assert.equal(configRequire("effect/package.json").version, "3.20.0");
  const config = prismaCli("@prisma/config");
  const directory = await mkdtemp(resolve(tmpdir(), "nexos-prisma-config-"));
  try {
    const configFile = resolve(directory, "prisma.config.js");
    await writeFile(
      configFile,
      'module.exports = { schema: "./schema.prisma" };\n',
    );
    const result = await config.loadConfigFromFile({
      configFile,
      configRoot: directory,
    });
    assert.equal(result.error, undefined);
    assert.equal(result.config.schema, resolve(directory, "schema.prisma"));
    const invalidFile = resolve(directory, "invalid.config.js");
    await writeFile(invalidFile, "module.exports = { schema: 42 };\n");
    const invalid = await config.loadConfigFromFile({
      configFile: invalidFile,
      configRoot: directory,
    });
    assert.ok(invalid.error);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
