import type { INestApplication } from "@nestjs/common";
import {
  SwaggerModule,
  DocumentBuilder,
  type OpenAPIObject,
} from "@nestjs/swagger";
import type {
  SchemaObject,
  OperationObject,
  ParameterObject,
} from "@nestjs/swagger/dist/interfaces/open-api-spec.interface";
import { z } from "zod";
import * as c from "@rom-hub/contracts";

// Descriptive metadata lives here; runtime validators remain in shared contracts.
export const schemaSources = {
  RegistrationInput: { schema: c.registrationSchema, io: "input" },
  LoginInput: { schema: c.loginSchema, io: "input" },
  ROMConfigurationInput: { schema: c.romConfigurationSchema, io: "input" },
  SaveConfigurationInput: { schema: c.saveConfigurationSchema, io: "input" },
  ROMConfiguration: { schema: c.romConfigurationSchema, io: "output" },
  AuthenticationResponse: {
    schema: c.authenticationResponseSchema,
    io: "output",
  },
  PublicUser: { schema: c.publicUserSchema, io: "output" },
  Session: { schema: c.sessionSchema, io: "output" },
  SessionsResponse: { schema: c.sessionsResponseSchema, io: "output" },
  PaginatedSessionsResponse: {
    schema: c.paginatedSessionsResponseSchema,
    io: "output",
  },
  SuccessResponse: { schema: c.successResponseSchema, io: "output" },
  ManufacturersResponse: {
    schema: c.manufacturersResponseSchema,
    io: "output",
  },
  Manufacturer: { schema: c.manufacturerSchema, io: "output" },
  Device: { schema: c.deviceSchema, io: "output" },
  DeviceVariant: { schema: c.deviceVariantSchema, io: "output" },
  CatalogDevice: { schema: c.catalogDeviceSchema, io: "output" },
  DevicesResponse: { schema: c.devicesResponseSchema, io: "output" },
  AndroidBase: { schema: c.androidBaseOptionSchema, io: "output" },
  AndroidBasesResponse: { schema: c.androidBasesResponseSchema, io: "output" },
  RawROMProject: { schema: c.rawROMProjectSchema, io: "output" },
  ProjectsResponse: { schema: c.projectsResponseSchema, io: "output" },
  PaginatedProjectsResponse: {
    schema: c.paginatedProjectsResponseSchema,
    io: "output",
  },
  ProjectWriteResponse: { schema: c.projectWriteResponseSchema, io: "output" },
  ProjectDetailResponse: {
    schema: c.projectDetailResponseSchema,
    io: "output",
  },
  RevisionsResponse: { schema: c.revisionsResponseSchema, io: "output" },
  PaginatedRevisionsResponse: {
    schema: c.paginatedRevisionsResponseSchema,
    io: "output",
  },
  CompatibilityResponse: {
    schema: c.compatibilityResponseSchema,
    io: "output",
  },
  AuditResponse: { schema: c.auditResponseSchema, io: "output" },
  PaginatedAuditResponse: {
    schema: c.paginatedAuditResponseSchema,
    io: "output",
  },
  LegacyProjectsResponse: {
    schema: c.legacyProjectsResponseSchema,
    io: "output",
  },
  LegacyProjectResponse: {
    schema: c.legacyProjectResponseSchema,
    io: "output",
  },
  HealthResponse: { schema: c.healthResponseSchema, io: "output" },
  ReadyResponse: { schema: c.readyResponseSchema, io: "output" },
  APIError: { schema: c.apiErrorSchema, io: "output" },
  RouterError: { schema: c.routerErrorSchema, io: "output" },
  BadRequestError: { schema: c.apiErrorsByStatus[400], io: "output" },
  UnauthenticatedError: { schema: c.apiErrorsByStatus[401], io: "output" },
  ForbiddenError: { schema: c.apiErrorsByStatus[403], io: "output" },
  NotFoundError: { schema: c.apiErrorsByStatus[404], io: "output" },
  ConflictError: { schema: c.apiErrorsByStatus[409], io: "output" },
  RateLimitError: { schema: c.apiErrorsByStatus[429], io: "output" },
  InternalServerError: { schema: c.apiErrorsByStatus[500], io: "output" },
  ServiceUnavailableError: { schema: c.apiErrorsByStatus[503], io: "output" },
} as const;

type JSONSchema = Record<string, unknown>;
const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
function replace(target: JSONSchema, value: JSONSchema) {
  for (const key of Object.keys(target)) delete target[key];
  Object.assign(target, value);
}
function generated(
  schema: z.ZodType,
  io: "input" | "output",
  name?: string,
): JSONSchema {
  const config = c.romConfigurationSchema.shape;
  const trimmed = new Set<z.ZodType>([
    config.name,
    config.description,
    config.base,
    c.catalogQuerySchema.shape.q,
  ]);
  const noNul = new Set<z.ZodType>([
    ...trimmed,
    config.variantId,
    c.deviceQuerySchema.shape.manufacturerId,
  ]);
  const common = new Map<z.ZodType, string>(
    Object.entries(schemaSources)
      .filter(([, source]) => source.io === io)
      .map(([key, source]) => [source.schema, key]),
  );
  const result = z.toJSONSchema(schema, {
    target: "draft-2020-12",
    io,
    override: (ctx) => {
      const node = ctx.jsonSchema as JSONSchema;
      const source = ctx.zodSchema as unknown as z.ZodType;
      const shared = common.get(source);
      if (ctx.path.length && shared) {
        replace(node, ref(shared));
        return;
      }
      // Native conversion cannot infer these named runtime refinements.
      if (source === config.apps) node.uniqueItems = true;
      if (
        source === c.saveConfigurationSchema.shape.revision ||
        source === c.catalogQuerySchema.shape.page ||
        source === c.catalogQuerySchema.shape.limit
      )
        node.type = "integer";
      if (source === c.registrationSchema.shape.password) node.writeOnly = true;
      if (source === c.registrationSchema.shape.email) {
        // The authoritative email regex has /i; JSON Schema patterns have no flags field.
        if (typeof node.pattern === "string")
          node.pattern = node.pattern.replaceAll("A-Z", "a-zA-Z");
        node.description = "Validated before lowercasing; not trimmed.";
        node["x-nexos-normalization"] = "lowercase";
      }
      if (source === c.registrationSchema.shape.username)
        node["x-nexos-normalization"] = "lowercase";
      const constraints: JSONSchema[] = [];
      if (trimmed.has(source)) {
        node["x-nexos-normalization"] = "trim";
        node["x-nexos-length-unit"] = "UTF-16 code units";
        if (io === "input") {
          const minimum = Number(node.minLength ?? 0),
            maximum = Number(node.maxLength);
          // Bounds apply after trim. Keep valid surrounding whitespace representable.
          if (Number.isFinite(maximum)) {
            delete node.minLength;
            delete node.maxLength;
            constraints.push({
              pattern: `^\\s*(?:\\S(?:[\\s\\S]{0,${maximum - 2}}\\S)?)${minimum === 0 ? "?" : ""}\\s*$`,
            });
            node["x-nexos-trimmed-minLength"] = minimum;
            node["x-nexos-trimmed-maxLength"] = maximum;
          }
        }
      }
      if (noNul.has(source)) constraints.push({ pattern: "^[^\\u0000]*$" });
      if (constraints.length)
        node.allOf = [
          ...(Array.isArray(node.allOf) ? node.allOf : []),
          ...constraints,
        ];
    },
  }) as JSONSchema;
  delete result.$schema;
  // Zod's recursive JSON definitions are local to a component, not the document root.
  function rebase(value: unknown) {
    if (!value || typeof value !== "object") return;
    for (const [key, child] of Object.entries(value)) {
      if (
        key === "$ref" &&
        typeof child === "string" &&
        child.startsWith("#/$defs/") &&
        name
      )
        (value as JSONSchema)[key] =
          `#/components/schemas/${name}/${child.slice(2)}`;
      else rebase(child);
    }
  }
  rebase(result);
  return result;
}
export function buildSchemas() {
  return Object.fromEntries(
    Object.entries(schemaSources).map(([name, source]) => [
      name,
      generated(source.schema, source.io, name),
    ]),
  );
}

type Method = "get" | "post" | "patch" | "delete";
type Route = {
  method: Method;
  path: string;
  id: string;
  tag: string;
  summary: string;
  description: string;
  access?: "session" | "owner" | "admin";
  mutation?: boolean;
  body?: string;
  success?: string | [string, string];
  code?: number;
  errors?: number[];
  query?:
    "devices" | "catalog" | "projects" | "sessions" | "revisions" | "audit";
};
export const operationContracts: Route[] = [
  {
    method: "post",
    path: "/auth/register",
    id: "registerAccount",
    tag: "Accounts",
    summary: "Register an account and initial session",
    description:
      "User, initial session, presented-token rotation and audit write commit atomically. Cookie emitted after commit. Email verification remains pending.",
    mutation: true,
    body: "RegistrationInput",
    success: "AuthenticationResponse",
    code: 201,
    errors: [400, 403, 409],
  },
  {
    method: "post",
    path: "/auth/login",
    id: "loginAccount",
    tag: "Accounts",
    summary: "Authenticate and rotate the presented session",
    description:
      "Email login; generic credential failure. Distributed IP and independent account-aware protections. Successful legacy password upgrade does not change the wire contract.",
    mutation: true,
    body: "LoginInput",
    success: "AuthenticationResponse",
    code: 201,
    errors: [400, 401, 403],
  },
  {
    method: "get",
    path: "/auth/me",
    id: "getCurrentUser",
    tag: "Accounts",
    summary: "Read the current public user",
    description:
      "Valid unexpired session required. No email, password or token fields returned.",
    access: "session",
    success: "AuthenticationResponse",
  },
  {
    method: "post",
    path: "/auth/logout",
    id: "logoutAccount",
    tag: "Accounts",
    summary: "Revoke the presented session and clear its cookie",
    description:
      "Idempotent even without a valid session. Origin/JSON checks still apply. Other sessions are unchanged.",
    mutation: true,
    body: "ignored",
    success: "SuccessResponse",
    code: 201,
    errors: [400, 403],
  },
  {
    method: "get",
    path: "/auth/sessions",
    id: "listSessions",
    tag: "Accounts",
    summary: "List the current user's active sessions",
    description:
      "Legacy list returns all active sessions and remains unbounded. No session token/digest is returned.",
    access: "session",
    success: ["SessionsResponse", "PaginatedSessionsResponse"],
    query: "sessions",
  },
  {
    method: "delete",
    path: "/auth/sessions/{id}",
    id: "revokeSession",
    tag: "Accounts",
    summary: "Revoke one owned session",
    description:
      "Origin and authentication precede identifier checks. Unknown/foreign valid IDs still return success, avoiding existence disclosure.",
    access: "session",
    mutation: true,
    body: "ignored",
    success: "SuccessResponse",
    errors: [400],
  },
  {
    method: "get",
    path: "/health",
    id: "getLiveness",
    tag: "Catalog",
    summary: "Check API liveness",
    description:
      "Does not test PostgreSQL or Redis. Existing throttling can still return429.",
    success: "HealthResponse",
  },
  {
    method: "get",
    path: "/ready",
    id: "getReadiness",
    tag: "Catalog",
    summary: "Check PostgreSQL and authentication-store readiness",
    description: "Returns a generic503 if required service checks fail.",
    success: "ReadyResponse",
  },
  {
    method: "get",
    path: "/manufacturers",
    id: "listManufacturers",
    tag: "Catalog",
    summary: "List manufacturers with active catalog devices",
    description:
      "Unpaged id/name projection; name ascending. Excludes manufacturers without an active non-demo device.",
    success: "ManufacturersResponse",
  },
  {
    method: "get",
    path: "/android-bases",
    id: "listAndroidBases",
    tag: "Catalog",
    summary: "List source-available Android bases",
    description:
      "Unpaged source catalog; name/version/id ascending. Source availability does not imply compatibility or a verified build.",
    success: "AndroidBasesResponse",
  },
  {
    method: "get",
    path: "/devices",
    id: "listDevices",
    tag: "Catalog",
    summary: "Search active real-device catalog entries",
    description:
      "Non-demo/non-deprecated devices; searches names, codenames, manufacturer, model number and region. ID ascending offset pagination with existing total; no concurrent snapshot guarantee. All builds remain NOT_VERIFIED.",
    success: "DevicesResponse",
    query: "devices",
    errors: [400],
  },
  {
    method: "get",
    path: "/legacy/catalog-projects",
    id: "listLegacyCatalogProjects",
    tag: "Catalog",
    summary: "Search the public legacy project catalog",
    description:
      "Distinct from private ROM projects. Name/kind filtering; no status/demo publication filter. ID ascending offset pages; existing item/count transaction is not a cross-request snapshot.",
    success: "LegacyProjectsResponse",
    query: "catalog",
    errors: [400],
  },
  {
    method: "get",
    path: "/legacy/catalog-projects/{slug}",
    id: "getLegacyCatalogProject",
    tag: "Catalog",
    summary: "Read a public legacy catalog project",
    description:
      "Includes PUBLISHED releases and device links only; nested lists remain unpaged. No artifact/mirror expansion.",
    success: "LegacyProjectResponse",
    errors: [400, 404],
  },
  {
    method: "get",
    path: "/admin/audit",
    id: "listAuditEvents",
    tag: "Catalog",
    summary: "List audit events for an administrator",
    description:
      "Role ADMIN required on every request. Legacy latest50, createdAt/id descending.",
    access: "admin",
    success: ["AuditResponse", "PaginatedAuditResponse"],
    query: "audit",
  },
  {
    method: "get",
    path: "/projects",
    id: "listOwnedProjects",
    tag: "ROM projects",
    summary: "List owned ROM drafts",
    description:
      "Legacy latest100, updatedAt/id descending. Configuration JSON remains raw; it is not normalized by this list.",
    access: "session",
    success: ["ProjectsResponse", "PaginatedProjectsResponse"],
    query: "projects",
  },
  {
    method: "post",
    path: "/projects",
    id: "createOwnedProject",
    tag: "ROM projects",
    summary: "Create a draft with revision1",
    description:
      "Owner assigned from session. New selections must reference active device/base records; unselected/unconfigured drafts allowed. Returns plain project without enriched detail relations.",
    access: "session",
    mutation: true,
    body: "ROMConfigurationInput",
    success: "ProjectWriteResponse",
    code: 201,
    errors: [400, 409],
  },
  {
    method: "get",
    path: "/projects/{id}",
    id: "getOwnedProject",
    tag: "ROM projects",
    summary: "Read an owned project and source details",
    description:
      "Foreign/missing IDs return404. Normalizes configuration and returns nullable variant/base relations plus UNKNOWN compatibility. Invalid persisted configuration is a sanitized500.",
    access: "owner",
    success: "ProjectDetailResponse",
    errors: [400, 404],
  },
  {
    method: "patch",
    path: "/projects/{id}",
    id: "updateOwnedProject",
    tag: "ROM projects",
    summary: "Save configuration with revision compare-and-swap",
    description:
      "Atomic update and new snapshot; stale revision409. Unchanged legacy selections remain editable. Plain project reply; no enriched relations. Existing revision input has no PostgreSQL Int upper bound; extreme storage failures remain sanitized server errors.",
    access: "owner",
    mutation: true,
    body: "SaveConfigurationInput",
    success: "ProjectWriteResponse",
    errors: [400, 404, 409],
  },
  {
    method: "get",
    path: "/projects/{id}/revisions",
    id: "listOwnedProjectRevisions",
    tag: "ROM projects",
    summary: "List owned configuration snapshots",
    description:
      "Legacy latest50, number/id descending. Snapshots retain raw stored JSON. Ownership checked before query/cursor validation.",
    access: "owner",
    success: ["RevisionsResponse", "PaginatedRevisionsResponse"],
    query: "revisions",
    errors: [400, 404],
  },
  {
    method: "post",
    path: "/projects/{id}/validate",
    id: "validateOwnedProject",
    tag: "ROM projects",
    summary: "Evaluate an owned persisted configuration",
    description:
      "Returns UNKNOWN/foundation-1, not build support. Uses persisted configuration; request payload ignored. Invalid persisted data500.",
    access: "owner",
    mutation: true,
    body: "ignored",
    success: "CompatibilityResponse",
    code: 201,
    errors: [400, 404],
  },
  {
    method: "post",
    path: "/projects/{id}/builds",
    id: "requestUnavailableBuild",
    tag: "ROM projects",
    summary: "Report unavailable compilation after owned-config checks",
    description:
      "No successful build response exists. Valid owned drafts return503: no verified manifest/isolated Android worker. No job is enqueued.",
    access: "owner",
    mutation: true,
    body: "ignored",
    errors: [400, 404],
  },
];

const cursorDescription =
  "Opt in with pagination=cursor. Legacy requests omit metadata; bare limit/cursor are ignored without the mode. Live keyset traversal, not a snapshot: unchanged sort keys do not repeat; deleted/expired rows disappear; new rows before a boundary require restarting. Opaque cursors are endpoint/user/project scoped and expire15 minutes from first issuance without renewal. Invalid/expired/tampered/wrong-scope cursors400 after authentication/ownership. End: hasMore=false,nextCursor=null. No total/count.";
const queries = {
  projects: c.projectListQuerySchema,
  sessions: c.sessionListQuerySchema,
  revisions: c.revisionListQuerySchema,
  audit: c.auditListQuerySchema,
};
function queryParameters(kind: NonNullable<Route["query"]>): ParameterObject[] {
  if (kind === "devices" || kind === "catalog") {
    const shape = generated(
      kind === "devices" ? c.deviceQuerySchema : c.catalogQuerySchema,
      "input",
    ).properties as Record<string, SchemaObject>;
    return Object.entries(shape).map(([name, schema]) => ({
      name,
      in: "query",
      required: false,
      schema,
      description:
        name === "kind" && kind === "devices"
          ? "Validated but currently ignored by the device filter (legacy behavior)."
          : name === "page" || name === "limit"
            ? "Parsed with legacy Number coercion, then integer/bound checks; noncanonical numeric strings can normalize. Repeated arrays are not supported."
            : name === "q"
              ? "Trimmed search text; NUL rejected. Unknown query keys are stripped."
              : "Exact untrimmed manufacturer identifier; NUL rejected.",
    }));
  }
  const option = queries[kind].options[1];
  const output = generated(option, "output").properties as Record<
    string,
    JSONSchema
  >;
  const limit = output.limit;
  const maximum = Number(limit.maximum),
    minimum = Number(limit.minimum);
  return [
    {
      name: "pagination",
      in: "query",
      required: false,
      schema: { type: "string", enum: ["cursor"] },
      description: cursorDescription,
    },
    {
      name: "limit",
      in: "query",
      required: false,
      schema: {
        type: "string",
        default: String(limit.default),
        pattern: `^\\s*(?:${Array.from({ length: maximum - minimum + 1 }, (_, i) => String(i + minimum)).join("|")})\\s*$`,
      },
      description: `Only in cursor mode. Trimmed decimal string, parsed integer ${minimum}–${maximum}; default ${limit.default}. No hex/exponent/fraction/leading zeros.`,
    },
    {
      name: "cursor",
      in: "query",
      required: false,
      schema: output.cursor as SchemaObject,
      description:
        "Opaque continuation token from the previous page; do not construct, inspect or modify it. Optional on first page.",
    },
  ];
}
const errorNames: Record<number, string> = {
  400: "BadRequestError",
  401: "UnauthenticatedError",
  403: "ForbiddenError",
  404: "NotFoundError",
  409: "ConflictError",
  429: "RateLimitError",
  500: "InternalServerError",
  503: "ServiceUnavailableError",
};
const errorDescriptions: Record<number, string> = {
  400: "Invalid request, parameter or cursor. Early malformed URI errors retain the native RouterError shape.",
  401: "Missing, invalid, expired or revoked session; login uses generic invalid-credential errors.",
  403: "Invalid Origin/JSON or production HTTPS requirement, or insufficient administrator role.",
  404: "Missing or foreign owned resource, or absent public legacy slug.",
  409: "Duplicate account/resource or stale project revision.",
  429: "Rate limited; existing message/envelope retained.",
  500: "Sanitized unexpected/internal or stored-data failure. No stack, database or token details.",
  503: "Required service unavailable, auth protection unavailable/capacity, database initialization failure, or build deliberately unavailable.",
};
const retryAfter = {
  description:
    "Seconds until retry may be appropriate. Does not authorize automatic retries of writes. Present on authentication limiter429 and protection503; other503 causes need not include it.",
  schema: { type: "integer" as const, minimum: 1 },
};
function operation(route: Route): OperationObject {
  const parameters: ParameterObject[] = [];
  for (const match of route.path.matchAll(/\{([^}]+)\}/g)) {
    const name = match[1];
    const project = route.path.startsWith("/projects/");
    parameters.push({
      name,
      in: "path",
      required: true,
      schema: {
        type: "string",
        minLength: 1,
        pattern: project ? "^[^\\u0000-\\u001f\\u007f]+$" : "^[^\\u0000]+$",
      },
      description: project
        ? "Opaque project ID; control characters rejected after authentication; foreign/missing404."
        : "Opaque decoded identifier; NUL rejected. No UUID/CUID-only restriction.",
    });
  }
  if (route.query) parameters.push(...queryParameters(route.query));
  if (route.mutation)
    parameters.push({
      name: "Origin",
      in: "header",
      required: true,
      schema: { type: "string" },
      description:
        "Must exactly equal the configured WEB_ORIGIN. JSON Content-Type and trusted HTTPS in production are required; forwarding headers alone do not establish trust.",
    });
  const codes = new Set([
    429,
    500,
    ...(route.id === "getLiveness" ? [] : [503]),
    ...(route.errors ?? []),
    ...(route.access ? [401, 403] : []),
    ...(route.query ? [400] : []),
    ...(route.mutation ? [400, 403, 413, 415] : []),
  ]);
  const responses: NonNullable<OperationObject["responses"]> = {};
  for (const code of [...codes].sort((a, b) => a - b))
    responses[code] = {
      description:
        errorDescriptions[code] ??
        "Framework request parsing/body error; existing error envelope retained.",
      content: {
        "application/json": {
          schema:
            code === 400
              ? { oneOf: [ref("BadRequestError"), ref("RouterError")] }
              : ref(errorNames[code] ?? "APIError"),
        },
      },
      ...(code === 429 ||
      (code === 503 && ["loginAccount", "registerAccount"].includes(route.id))
        ? { headers: { "Retry-After": retryAfter } }
        : {}),
    };
  if (route.success)
    responses[route.code ?? 200] = {
      description: Array.isArray(route.success)
        ? "Legacy items envelope, or the separate pagination variant only when pagination=cursor."
        : "Existing successful JSON response; no global wrapper.",
      content: {
        "application/json": {
          schema: Array.isArray(route.success)
            ? { oneOf: route.success.map(ref) }
            : ref(route.success),
        },
      },
      ...(["loginAccount", "registerAccount", "logoutAccount"].includes(
        route.id,
      )
        ? {
            headers: {
              "Set-Cookie": {
                description:
                  "romhub_session; HttpOnly, SameSite=Lax, Path=/, no Domain; Secure in production. Registration/login:7-day max-age. Logout clears using matching attributes/expiration.",
                schema: { type: "string" },
              },
            },
          }
        : {}),
    };
  return {
    operationId: route.id,
    tags: [route.tag],
    summary: route.summary,
    description:
      route.description +
      (route.access
        ? " Valid unexpired cookie required; production authenticated operations require trusted HTTPS."
        : "") +
      (route.query && route.query in queries
        ? " " +
          cursorDescription +
          ` Cursor order: ${route.query === "revisions" ? "number DESC,id DESC" : "createdAt DESC,id DESC"}.`
        : ""),
    security: route.access ? [{ cookie: [] }] : [],
    parameters,
    responses,
    ...(route.body
      ? {
          requestBody: {
            required: true,
            description:
              route.body === "ignored"
                ? "Payload ignored; send valid JSON (conventionally {}). Origin and JSON Content-Type still required."
                : "Validated by the shared Zod input contract. Unknown properties rejected.",
            content: {
              "application/json": {
                schema: route.body === "ignored" ? {} : ref(route.body),
                ...(route.body === "ROMConfigurationInput"
                  ? { example: c.defaultConfiguration }
                  : {}),
              },
            },
          },
        }
      : {}),
  };
}
export function createOpenAPIDocument(app: INestApplication): OpenAPIObject {
  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle("NEXOS API")
      .setVersion("1.0")
      .setOpenAPIVersion("3.1.0")
      .setDescription(
        "Existing NEXOS v1 API. Phase C documentation is not production deployment approval. Cookies/Origin/trusted HTTPS requirements remain authoritative. Default list caps and raw JSON are retained. JSON Schema cannot execute arbitrary normalization/refinements: named adapters document them without changing validators. Length checks use runtime UTF-16 semantics; generic JSON Schema Unicode length validation can differ.",
      )
      .addCookieAuth("romhub_session")
      .build(),
  );
  const actual = Object.entries(document.paths)
    .flatMap(([path, item]) =>
      Object.keys(item)
        .filter((method) =>
          ["get", "post", "patch", "delete", "put", "head", "options"].includes(
            method,
          ),
        )
        .map((method) => `${method} ${path}`),
    )
    .sort();
  const expected = operationContracts
    .map((route) => `${route.method} /api/v1${route.path}`)
    .sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected))
    throw new Error(
      "OpenAPI operation inventory differs from registered Nest controllers",
    );
  for (const route of operationContracts)
    document.paths[`/api/v1${route.path}`][route.method] = operation(route);
  document.components = {
    ...document.components,
    schemas: buildSchemas() as Record<string, SchemaObject>,
  };
  return document;
}
