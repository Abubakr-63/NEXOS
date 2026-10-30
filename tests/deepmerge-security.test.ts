import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";

const database = createRequire(resolve("packages/database/package.json"));
const prisma = createRequire(database.resolve("prisma/package.json"));
const configuration = createRequire(prisma.resolve("@prisma/config"));
const fixed = configuration("deepmerge-ts");
const loader = prisma("@prisma/config");

async function loadFixture(source: string) {
  const directory = await mkdtemp(resolve(tmpdir(), "nexos-deepmerge-"));
  const previous = process.env.NODE_ENV;
  process.env.NODE_ENV = "test";
  try {
    const configFile = resolve(directory, "prisma.config.cjs");
    // c12 can read non-enumerable environment metadata, while Prisma's strict
    // final schema must not receive the $test control property itself.
    await writeFile(
      configFile,
      `${source}
if (Object.hasOwn(module.exports, "$test")) Object.defineProperty(module.exports, "$test", {enumerable: false});
`,
    );
    const result = await loader.loadConfigFromFile({
      configFile,
      configRoot: directory,
    });
    return { result, directory };
  } finally {
    if (previous === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previous;
    await rm(directory, { recursive: true, force: true });
  }
}

test("Prisma resolves fixed deepmerge; cycles and prototype payloads remain safe", async () => {
  const metadata = JSON.parse(
    await readFile(
      resolve(
        dirname(configuration.resolve("deepmerge-ts")),
        "../package.json",
      ),
      "utf8",
    ),
  );
  assert.equal(metadata.version, "8.0.2");
  const left: Record<string, unknown> = { left: true };
  const right: Record<string, unknown> = { right: true };
  left.self = left;
  right.self = right;
  const merged = fixed.deepmerge(left, right);
  assert.equal(merged.self, merged);
  assert.equal(merged.left, true);
  assert.equal(merged.right, true);
  assert.equal(left.self, left);
  assert.equal(right.self, right);
  const target: Record<string, unknown> = {};
  target.self = target;
  fixed.deepmergeInto(target, right);
  assert.equal(target.self, target);
  const payload = JSON.parse(
    '{"__proto__":{"nexosMergePolluted":true},"constructor":{"prototype":{"nexosMergePolluted":true}}}',
  );
  assert.equal(({} as Record<string, unknown>).nexosMergePolluted, undefined);
  fixed.deepmerge({}, payload);
  fixed.deepmergeInto({}, payload);
  assert.equal(({} as Record<string, unknown>).nexosMergePolluted, undefined);
  const base = { nested: { base: 1 }, list: [1] };
  assert.deepEqual(fixed.deepmerge(base, { nested: { extra: 2 }, list: [2] }), {
    nested: { base: 1, extra: 2 },
    list: [1, 2],
  });
  assert.deepEqual(base, { nested: { base: 1 }, list: [1] });
});

test("actual Prisma/c12 loading preserves legacy records, arrays, Maps, Sets and null/undefined", async () => {
  const { result, directory } = await loadFixture(`
    class Fixture { constructor() { this.value = 'original'; } }
    const instance = new Fixture();
    module.exports = {
      schema: './schema.prisma',
      experimental: { extensions: true, externalTables: true },
      migrations: { path: './migrations', seed: 'node ./seed.cjs' },
      tables: { external: ['base'] },
      extensions: {
        nested: { base: 1 }, list: ['base'],
        map: new Map([['shared', {base: 1}], ['baseOnly', 1], ['undefined', undefined], ['null', null], ['reference', instance]]),
        set: new Set([1]), nullable: null, optional: undefined,
        instance, originalInstance: () => instance,
      },
      $test: {
        tables: { external: ['environment'] },
        extensions: {
          nested: { environment: 2 }, list: ['environment'],
          map: new Map([['shared', {environment: 2}], ['envOnly', 2], ['undefined', 3], ['null', 4]]),
          set: new Set([2]), nullable: 'environment', optional: 'retained',
        }
      }
    };
  `);
  assert.equal(result.error?._tag, undefined);
  assert.equal(result.config.schema, resolve(directory, "schema.prisma"));
  assert.equal(result.config.migrations.path, resolve(directory, "migrations"));
  assert.equal(result.config.migrations.seed, "node ./seed.cjs");
  assert.deepEqual(result.config.tables.external, ["environment", "base"]);
  const value = result.config.extensions;
  assert.deepEqual(value.nested, { environment: 2, base: 1 });
  assert.deepEqual(value.list, ["environment", "base"]);
  // c12 invokes this configured merger with environment first, main config last.
  // Keep shallow Map values: v8's default would combine the two shared records.
  assert.deepEqual(value.map.get("shared"), { base: 1 });
  assert.equal(value.map.get("envOnly"), 2);
  assert.equal(value.map.get("baseOnly"), 1);
  assert.equal(value.map.has("undefined"), true);
  assert.equal(value.map.get("undefined"), undefined);
  assert.equal(value.map.get("null"), null);
  assert.equal(value.map.get("reference"), value.originalInstance());
  assert.deepEqual([...value.set].sort(), [1, 2]);
  assert.equal(value.nullable, null);
  assert.equal(value.optional, "retained");
  assert.equal(value.instance, value.originalInstance());
  assert.equal(value.instance.value, "original");
});

test("actual Prisma loader retains adapter factory behavior without opening a database", async () => {
  const { result } = await loadFixture(`
    const factory = {
      provider: 'postgres', adapterName: 'fixture',
      connect: async () => { throw new Error('fixture must never connect'); },
      connectToShadowDb: async () => { throw new Error('fixture must never connect'); },
    };
    module.exports = {
      schema: './schema.prisma', experimental: {adapter: true, extensions: true},
      engine: 'js', adapter: async () => factory,
      extensions: { originalFactory: () => factory },
    };
  `);
  assert.equal(result.error?._tag, undefined);
  const bound = await result.config.adapter();
  assert.equal(bound.provider, "postgres");
  assert.equal(bound.adapterName, "fixture");
  assert.equal(typeof bound.connect, "function");
  assert.equal(
    typeof result.config.extensions.originalFactory().connect,
    "function",
  );
});

test("actual Prisma/c12 path handles cycles/prototype payloads and rejects throwing getters safely", async () => {
  const { result } = await loadFixture(`
    const base = {base: 1}; base.self = base;
    const environment = {environment: 2}; environment.self = environment;
    const payload = JSON.parse('{"__proto__":{"nexosMergePolluted":true},"constructor":{"prototype":{"nexosMergePolluted":true}}}');
    module.exports = {
      schema: './schema.prisma', experimental: {extensions: true},
      extensions: {cycle: base, payload},
      $test: {extensions: {cycle: environment, payload: {safe: true}}},
    };
  `);
  assert.equal(result.error?._tag, undefined);
  assert.equal(
    result.config.extensions.cycle.self,
    result.config.extensions.cycle,
  );
  assert.equal(result.config.extensions.cycle.base, 1);
  assert.equal(result.config.extensions.cycle.environment, 2);
  assert.equal(({} as Record<string, unknown>).nexosMergePolluted, undefined);
  const failed = await loadFixture(`
    const extensions = {};
    Object.defineProperty(extensions, 'throws', {enumerable: true, get() {throw new Error('bounded fixture getter');}});
    module.exports = {schema: './schema.prisma', experimental: {extensions: true}, extensions,
      $test: {extensions: {throws: {safe: true}}}};
  `);
  assert.ok(failed.result.error);
  assert.equal(({} as Record<string, unknown>).nexosMergePolluted, undefined);
});
