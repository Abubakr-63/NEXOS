import { test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
const api = createRequire(resolve("apps/api/package.json"));
const { generateOpenAPI, stableJSON } = api(
  "./dist/export-openapi.js",
) as {generateOpenAPI:()=>Promise<unknown>;stableJSON:(value:unknown)=>string};
const { schemaSources, operationContracts } = api(
  "./dist/openapi.js",
) as typeof import("../apps/api/src/openapi");
const { Database } = api("./dist/app.js");
const { RedisAuthLimiter } = api("./dist/rate-limit.js");
import { validateSpecification } from "./helpers/openapi-validation";

process.env.AUTH_ACCOUNT_HMAC_KEY ??= randomBytes(32).toString("hex");
const artifact = JSON.parse(readFileSync("docs/api/openapi.json", "utf8"));

test("OpenAPI validates offline, compiles every schema/reference, and exports deterministically without initializing services", async (context) => {
  const database = context.mock.method(
    Database.prototype,
    "onModuleInit",
    async () => {
      throw new Error("Database initialization must not run");
    },
  );
  const redis = context.mock.method(
    RedisAuthLimiter.prototype,
    "onModuleInit",
    async () => {
      throw new Error("Redis initialization must not run");
    },
  );
  const generated = await generateOpenAPI();
  assert.equal(validateSpecification(generated).operationCount, 21);
  assert.equal(
    stableJSON(generated),
    readFileSync("docs/api/openapi.json", "utf8"),
    "Regenerate with pnpm openapi:export",
  );
  assert.equal(stableJSON(await generateOpenAPI()), stableJSON(generated));
  assert.equal(database.mock.calls.length, 0);
  assert.equal(redis.mock.calls.length, 0);
});

test("OpenAPI input adapters preserve ordinary shared-Zod acceptance including transforms/refinements", () => {
  const validation = validateSpecification(artifact);
  const corpus = JSON.parse(
    readFileSync("tests/fixtures/zod3-contract-baseline.json", "utf8"),
  );
  const names: Record<string, keyof typeof schemaSources> = {
    registrationSchema: "RegistrationInput",
    loginSchema: "LoginInput",
    romConfigurationSchema: "ROMConfigurationInput",
    saveConfigurationSchema: "SaveConfigurationInput",
  };
  for (const sample of corpus.cases as {
    id: string;
    schema: string;
    input: unknown;
  }[]) {
    const name = names[sample.schema];
    if (!name) continue;
    const expected = schemaSources[name].schema.safeParse(sample.input).success;
    assert.equal(
      validation.acceptsComponent(name, sample.input),
      expected,
      `Schema compatibility case ${sample.id}`,
    );
  }
  const schema = artifact.components.schemas.ROMConfigurationInput;
  assert.equal(schema.required.includes("description"), false);
  assert.equal(
    artifact.components.schemas.ROMConfiguration.required.includes(
      "description",
    ),
    true,
  );
  assert.equal(
    artifact.components.schemas.RegistrationInput.properties.password.writeOnly,
    true,
  );
});

test("OpenAPI documents security, every parameter, error status, response variant and unavailable builds without server secrets", () => {
  const ids = new Set<string>();
  for (const route of operationContracts) {
    const operation = artifact.paths[`/api/v1${route.path}`][route.method];
    assert.equal(operation.operationId, route.id);
    assert.equal(ids.has(route.id), false);
    ids.add(route.id);
    assert.deepEqual(operation.security, route.access ? [{ cookie: [] }] : []);
    for (const status of [429, 500]) assert.ok(operation.responses[status]);
    if (route.access) {
      assert.ok(operation.responses[401]);
      assert.ok(operation.responses[403]);
    }
    if (route.mutation)
      assert.ok(
        operation.parameters.some(
          (p: { name: string; in: string; required: boolean }) =>
            p.name === "Origin" && p.in === "header" && p.required,
        ),
      );
    if (route.body)
      assert.ok(operation.requestBody.content["application/json"].schema);
    if (
      route.query &&
      ["projects", "sessions", "revisions", "audit"].includes(route.query)
    ) {
      assert.deepEqual(
        operation.parameters
          .filter((p: { in: string }) => p.in === "query")
          .map((p: { name: string }) => p.name),
        ["pagination", "limit", "cursor"],
      );
      assert.equal(
        operation.responses[200].content["application/json"].schema.oneOf
          .length,
        2,
      );
    }
  }
  const login = artifact.paths["/api/v1/auth/login"].post;
  assert.ok(login.responses[429].headers["Retry-After"]);
  assert.ok(login.responses[503].headers["Retry-After"]);
  assert.ok(login.responses[201].headers["Set-Cookie"]);
  const build = artifact.paths["/api/v1/projects/{id}/builds"].post;
  assert.equal(
    Object.keys(build.responses).some((code) => code.startsWith("2")),
    false,
  );
  assert.ok(build.responses[503]);
  function walk(value: unknown) {
    if (!value || typeof value !== "object") return;
    for (const [key, child] of Object.entries(value)) {
      if (key === "properties")
        for (const field of Object.keys(child as object))
          assert.equal(
            [
              "passwordHash",
              "tokenHash",
              "AUTH_ACCOUNT_HMAC_KEY",
              "DATABASE_URL",
            ].includes(field),
            false,
          );
      walk(child);
    }
  }
  walk(artifact.components.schemas);
});

test("documented query constraints derive from shared schemas without changing legacy coercion or opt-in behavior", () => {
  const specification = validateSpecification(artifact);
  const contracts = api(
    "@rom-hub/contracts",
  ) as typeof import("../packages/contracts/src");
  for (const [path, schema] of [
    ["/api/v1/projects", contracts.projectListQuerySchema],
    ["/api/v1/auth/sessions", contracts.sessionListQuerySchema],
    ["/api/v1/projects/{id}/revisions", contracts.revisionListQuerySchema],
    ["/api/v1/admin/audit", contracts.auditListQuerySchema],
  ] as const) {
    const defaults = schema.parse({ pagination: "cursor" });
    assert.equal(defaults.pagination, "cursor");
    const parameter = artifact.paths[path].get.parameters.find(
      (p: { name: string }) => p.name === "limit",
    );
    if (defaults.pagination === "cursor")
      assert.equal(parameter.schema.default, String(defaults.limit));
    for (const limit of [
      "1",
      " 2 ",
      "50",
      "51",
      "100",
      "101",
      "0",
      "01",
      "",
      "1e2",
      "0x10",
      "1.5",
    ])
      assert.equal(
        specification.acceptsParameter("get", path, "limit", limit),
        schema.safeParse({ pagination: "cursor", limit }).success,
        `${path} limit contract`,
      );
  }
  for (const q of ["", " pixel ", "\u0000", "a".repeat(100), "a".repeat(101)])
    assert.equal(
      specification.acceptsParameter("get", "/api/v1/devices", "q", q),
      contracts.deviceQuerySchema.safeParse({ q }).success,
    );
  for (const page of ["1", "0x10", "1e2", " 2 "]) {
    const normalized = contracts.catalogQuerySchema.parse({ page });
    assert.equal(
      specification.acceptsParameter(
        "get",
        "/api/v1/devices",
        "page",
        normalized.page,
      ),
      true,
    );
  }
  assert.equal(
    specification.acceptsParameter(
      "get",
      "/api/v1/devices",
      "manufacturerId",
      "\u0000",
    ),
    false,
  );
});

test("OpenAPI validation rejects missing response descriptions, broken references and invalid payload schema types", () => {
  const missing = structuredClone(artifact);
  delete missing.paths["/api/v1/health"].get.responses[200].description;
  assert.throws(() => validateSpecification(missing));
  const broken = structuredClone(artifact);
  broken.paths["/api/v1/health"].get.responses[200].content[
    "application/json"
  ].schema = { $ref: "#/components/schemas/DoesNotExist" };
  assert.throws(() => validateSpecification(broken));
  const invalid = structuredClone(artifact);
  invalid.components.schemas.PublicUser.type = "not-a-type";
  assert.throws(() => validateSpecification(invalid));
});
