import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { readFileSync } from "node:fs";

const api = createRequire(resolve("apps/api/package.json"));
const compiler = createRequire(api.resolve("@fastify/ajv-compiler"));
const Ajv2020 = compiler("ajv/dist/2020").default;
const addFormats = compiler("ajv-formats");
type Document = {
  openapi: string;
  paths: Record<string, Record<string, unknown>>;
  components: { schemas: Record<string, unknown> };
};
function pointer(root: unknown, path: string): unknown {
  let value = root;
  for (const segment of path.replace(/^#?\//, "").split("/")) {
    const key = segment.replace(/~1/g, "/").replace(/~0/g, "~");
    assert.ok(
      value && typeof value === "object" && key in value,
      `Unresolved OpenAPI pointer: ${path}`,
    );
    value = (value as Record<string, unknown>)[key];
  }
  return value;
}
export function validateSpecification(document: unknown) {
  const doc = document as Document;
  const ajv = new Ajv2020({
    strict: false,
    allErrors: true,
    validateFormats: true,
  });
  addFormats(ajv);
  const meta = JSON.parse(
    readFileSync(resolve("tests/fixtures/openapi-3.1-schema.json"), "utf8"),
  );
  // Ajv's dynamicRef fallback assumes a root anchor. The OAI default anchor is
  // under $defs/schema. Resolve that local default statically (no dialect override)
  // and separately validate/compile every payload against JSON Schema2020-12.
  assert.equal(
    "jsonSchemaDialect" in doc,
    false,
    "Review the validator before adding an alternate schema dialect",
  );
  const compatibleMeta = structuredClone(meta);
  function staticAnchor(value: unknown) {
    if (!value || typeof value !== "object") return;
    const node = value as Record<string, unknown>;
    if (node.$dynamicRef === "#meta") {
      node.$ref = "#/$defs/schema";
      delete node.$dynamicRef;
    }
    for (const child of Object.values(node)) staticAnchor(child);
  }
  staticAnchor(compatibleMeta);
  ajv.addFormat(
    "media-range",
    /^[\w!#$%&'*+.^`|~-]+\/[\w!#$%&'*+.^`|~-]+(?:\s*;[^\r\n]*)?$/,
  );
  const validateDocument = ajv.compile(compatibleMeta);
  assert.equal(
    validateDocument(doc),
    true,
    `OpenAPI structural validation: ${JSON.stringify(validateDocument.errors?.slice(0, 8))}`,
  );
  const ids: string[] = [];
  const methods = new Set([
    "get",
    "post",
    "put",
    "patch",
    "delete",
    "head",
    "options",
  ]);
  for (const [path, item] of Object.entries(doc.paths))
    for (const [method, value] of Object.entries(item)) {
      if (!methods.has(method)) continue;
      const operation = value as {
        operationId: string;
        responses: Record<string, unknown>;
        parameters?: { name: string; in: string; required?: boolean }[];
      };
      assert.ok(operation.operationId, `${method} ${path} operationId missing`);
      ids.push(operation.operationId);
      assert.ok(Object.keys(operation.responses).length);
      const keys = (operation.parameters ?? []).map((p) => `${p.in}:${p.name}`);
      assert.equal(new Set(keys).size, keys.length, "Duplicate parameters");
      for (const match of path.matchAll(/\{([^}]+)\}/g))
        assert.ok(
          operation.parameters?.some(
            (p) => p.name === match[1] && p.in === "path" && p.required,
          ),
        );
    }
  assert.equal(ids.length, new Set(ids).size, "Duplicate operation IDs");
  function walk(value: unknown) {
    if (!value || typeof value !== "object") return;
    for (const [key, child] of Object.entries(value)) {
      if (key === "$ref") {
        assert.equal(typeof child, "string");
        assert.ok(
          (child as string).startsWith("#/"),
          "No unresolved external payload references",
        );
        pointer(doc, child as string);
      } else walk(child);
    }
  }
  walk(doc);
  const uri = "https://nexos.invalid/openapi-contracts.json";
  ajv.addSchema({ ...doc, $id: uri }, uri);
  const escape = (key: string) => key.replace(/~/g, "~0").replace(/\//g, "~1");
  function validator(path: string) {
    return ajv.compile({ $ref: uri + path });
  }
  for (const [name, schema] of Object.entries(doc.components.schemas)) {
    assert.equal(
      ajv.validateSchema(schema),
      true,
      `Invalid JSON Schema component ${name}: ${JSON.stringify(ajv.errors)}`,
    );
    validator("#/components/schemas/" + escape(name));
  }
  function check(path: string, payload: unknown, label: string) {
    const validate = validator(path);
    assert.equal(
      validate(payload),
      true,
      `${label}: ${JSON.stringify(validate.errors)}`,
    );
  }
  return {
    component: (name: string, payload: unknown) =>
      check("#/components/schemas/" + escape(name), payload, name),
    response: (
      method: string,
      path: string,
      status: number,
      payload: unknown,
    ) =>
      check(
        `#/paths/${escape(path)}/${method.toLowerCase()}/responses/${status}/content/application~1json/schema`,
        payload,
        `${method} ${path} ${status}`,
      ),
    request: (method: string, path: string, payload: unknown) =>
      check(
        `#/paths/${escape(path)}/${method.toLowerCase()}/requestBody/content/application~1json/schema`,
        payload,
        `${method} ${path} request`,
      ),
    acceptsComponent: (name: string, payload: unknown) =>
      Boolean(validator("#/components/schemas/" + escape(name))(payload)),
    acceptsParameter: (
      method: string,
      path: string,
      name: string,
      payload: unknown,
    ) => {
      const parameters = pointer(
        doc,
        `#/paths/${escape(path)}/${method.toLowerCase()}/parameters`,
      ) as { name: string; schema: unknown }[];
      const index = parameters.findIndex(
        (parameter) => parameter.name === name,
      );
      assert.ok(index >= 0, `Missing documented parameter ${name}`);
      return Boolean(
        validator(
          `#/paths/${escape(path)}/${method.toLowerCase()}/parameters/${index}/schema`,
        )(payload),
      );
    },
    operationCount: ids.length,
  };
}
