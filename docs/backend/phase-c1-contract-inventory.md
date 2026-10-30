# Phase C1 — API contract inventory and input boundaries

Reviewed 2026-10-29 (Asia/Dushanbe). Scope: existing working tree, `apps/api/src/{app,main,config,rate-limit,account-protection}.ts`, shared contracts, Prisma schema, web consumers, `docs/api/README.md`, architecture documentation, Final Security Gate and B6.6 report. This is local contract verification, not production certification.

## Outcome

The three reproduced decoded-NUL failures now return controlled **400** errors before the affected database lookup. Session revocation retains Origin/authentication-first behavior. Valid opaque identifiers remain accepted; infrastructure failures are not recategorized as input errors. No response envelope, schema, cookie, limiter, secret, dependency or frontend component was changed.

There are **21 controller operations on 19 paths** under `/api/v1`, plus automatically registered HEAD/OPTIONS and Swagger assets. The inventory below describes implementation, including omissions; it does not imply runtime response-schema enforcement. Phase C2 is ready **for approval**, not implemented. Public production remains **NO-GO** under the Final Security Gate's deployment requirements.

## 1. Common HTTP, authentication and error contracts

All table paths are relative to `/api/v1`. `—` means no declared parameter/body schema. Undeclared query fields on non-query handlers are ignored. Bodyless mutation handlers do not validate an empty-object schema; clients conventionally send `{}`. A route's table-specific errors are additional to common framework/infrastructure errors below.

| Marker | Contract |
| --- | --- |
| Public | No session requirement. CORS is not authorization. |
| S | Valid, unexpired `romhub_session` cookie. Database stores only token digest. User projection excludes email/password hash. Missing/invalid/expired cookie: 401. Production transport must be HTTPS: 403 otherwise. |
| M | Exact configured `Origin`, `Content-Type` beginning `application/json`, production HTTPS. Failure: 403. Evaluated before controller session/ownership checks on mutations. |
| O | S plus `ROMProject.id` AND `ownerId = current user`; missing/foreign project: indistinguishable 404. Auth precedes project identifier validation. |
| A | S plus database role ADMIN; other roles: 403. Request-supplied roles are ignored. |
| G | Generic failure surface: 500 sanitized unexpected error; Prisma initialization failure 503; P2002 uniqueness conflict 409. These are mappings, not a promise all database failures are classified 503. |
| R | 429 possible on every controller operation. Login/register share distributed IP admission (60 requests/60 seconds; block policy retained). Login additionally uses HMAC-account admission. Other handlers retain process-local Nest throttling (60/60 seconds per handler/IP), not a new distributed public-route guarantee. Auth Redis failures fail closed with controlled 503/Retry-After. |

Controller/Nest error envelope: `{error:{status:number,message:string|string[],requestId:string}}`. Zod issues become a string array, each `path.join('.') + ': ' + issue.message`; root issues start `': '`. Explicit HTTP errors produce a string. Unknown errors do not expose exception messages; server error events retain request correlation and exception class only. Auth 429 includes Retry-After; account recovery/capacity/Redis failure behavior remains B6.3's policy, not a new contract.

Framework distinctions matter: a live malformed encoded URL `/projects/%E0%A4%A` returned native Fastify 400 `{error:'Bad Request',code:'FST_ERR_BAD_URL',message:...,statusCode:400}` without the NEXOS envelope/requestId field. Unknown routes use the NEXOS 404 envelope. Existing malformed JSON/body-size/media-type tests remain in the suite; early router errors are not covered by a universal envelope guarantee. No normalization was added in C1.

Cookie creation: HttpOnly, SameSite=Lax, Path=/, no Domain, seven-day maxAge; Secure in production, local HTTP development supported. Clearing uses matching scope/security attributes and expiration. Trusted proxy configuration is exact-IP, not arbitrary forwarded-header trust. Browser calls use the existing Next `/api/v1/:path*` proxy; credentials are retained. Production mutation/identity transport checks do not imply every public read forces HTTPS in application code; edge enforcement is a deployment requirement.

## 2. Complete controller inventory and authorization matrix

Request schema details are in section 3; response aliases are fully expanded in section 4. **For every operation below, current OpenAPI coverage is route/tag/default success description only: no request body schema, parameter declarations, response schema, error responses or operation security declaration.** No route should be considered contract-documented merely because it appears in Swagger.

### Accounts (6 operations)

| Method/path | Access/ownership | Path; query; body | Actual success and response | Additional errors | Pagination / frontend consumers |
| --- | --- | --- | --- | --- | --- |
| POST `/auth/register` | M; public registration | —; —; `registrationSchema` | **201** `{user:PublicUser}`, Set-Cookie after commit | 400 validation; 409 duplicate email/username; R/G; 403 M | None. `components/account.tsx` AccountForm. User/session/rotation/audit one transaction. |
| POST `/auth/login` | M; public login | —; —; `loginSchema` | **201** `{user:PublicUser}`, rotated session cookie | 400; 401 generic invalid credentials; 403 M; R/G | None. AccountForm. Lowercase email; IP plus account admission; successful legacy rehash is CAS guarded. |
| GET `/auth/me` | S | —; —; — | **200** `{user:PublicUser}` | 401/403; R/G | None. Account settings; project-creation auth gate. |
| POST `/auth/logout` | M; idempotent even without valid session | —; —; ignored body | **201** `{success:true}`, cleared cookie | 403; R/G | None. Account settings. Deletes presented token's digest if present. |
| GET `/auth/sessions` | S; current user only | —; —; — | **200** `{items:SessionView[]}` | 401/403; R/G | All active sessions, createdAt descending; no limit/page. Account settings. |
| DELETE `/auth/sessions/:id` | M then S; deleteMany constrained by id AND current userId | opaque decoded `id`, C1 NUL check; —; ignored body | **200** `{success:true}` even unknown/foreign id | 400 NUL after auth; 401/403; R/G | None. Account settings revoke action. Does not reveal another user's session existence. |

### Catalog and operations (8 operations)

| Method/path | Access/ownership | Path; query; body | Actual success and response | Additional errors | Pagination / frontend consumers |
| --- | --- | --- | --- | --- | --- |
| GET `/health` | Public | —; —; — | **200** `{status:'ok',service:'rom-hub-api'}` | R; no DB dependency in handler | None. Operators/tests; no UI fetch found. Technical service identifier intentionally preserved. |
| GET `/ready` | Public | —; —; — | **200** `{status:'ready'}` | **503** `Required service unavailable` for PG/Redis check failure; R | None. Operators/tests; no UI fetch found. Executes SELECT 1 and limiter readiness. |
| GET `/manufacturers` | Public | —; —; — | **200** `{items:{id:string,name:string}[]}` | R/G | Unpaged, name ascending; only manufacturers with active non-demo devices. Project creation. |
| GET `/android-bases` | Public | —; —; — | **200** `{items:BaseView[],explanation:string}` | R/G | Unpaged SOURCE_AVAILABLE only, name/androidVersion ascending. Project creation. |
| GET `/devices` | Public | —; `deviceQuerySchema` plus C1 manufacturerId NUL check; — | **200** `{items:DeviceView[],total:number,page:number,limit:number}` | 400 validation/NUL; R/G | Offset page; id ascending. Project creation searches/paginates. Studio loads default first page only. |
| GET `/legacy/catalog-projects` | Public; legacy catalog, not private ROM projects | —; `catalogQuerySchema`; — | **200** `{items:LegacyProject[],total:number,page:number,limit:number}` | 400; R/G | Offset page, id ascending. No current frontend API consumer found; tests/API clients. Filters kind/name, **not status/isDemo**. |
| GET `/legacy/catalog-projects/:slug` | Public | opaque decoded `slug`, C1 NUL check; —; — | **200** `{project:LegacyDetail}` | 400 NUL; 404 absent; R/G | None. No current frontend API consumer found. Only PUBLISHED releases included. |
| GET `/admin/audit` | A; global audit visibility explicitly admin-only | —; —; — | **200** `{items:AuditLog[]}` | 401/403; R/G | Latest 50 createdAt descending, no pagination metadata. No current frontend fetch found. |

### Private ROM projects (7 operations)

All path `id` values pass existing auth-first guard: reject empty/control U+0000–001F or U+007F with 400; preserve opaque identifiers. Foreign/missing id returns 404. Mutations additionally require M.

| Method/path | Access/ownership | Path; query; body | Actual success and response | Additional errors | Pagination / frontend consumers |
| --- | --- | --- | --- | --- | --- |
| GET `/projects` | S; ownerId filter | —; —; — | **200** `{items:ROMProject[]}` | 401/403; R/G | Latest 100 updatedAt descending; no metadata/tie-breaker. Studio file's projects list. |
| POST `/projects` | M + S; ownerId assigned server-side | —; —; `romConfigurationSchema` | **201** `ROMProject` (direct object) | 400 schema/unavailable selection; 401/403; R/G | None. Project creation and Studio. Initial revision row created atomically by nested create; **not included in response**. |
| GET `/projects/:id` | O | id guard; —; — | **200** `ROMDetail` | 400 id/config parse; 401/403/404; R/G | None. Project details and Studio. Config normalized by shared schema. |
| PATCH `/projects/:id` | M + O; revision CAS | id guard; —; `saveConfigurationSchema` | **200** `ROMProject` direct object | 400 id/schema/selections; 401/403/404; **409** stale revision; R/G | None. Project details/Studio. Update and new revision snapshot in same transaction. No enriched relations in reply. |
| GET `/projects/:id/revisions` | O | id guard; —; — | **200** `{items:Revision[]}` | 400 id; 401/403/404; R/G | Latest 50 number descending. No current frontend fetch found. |
| POST `/projects/:id/validate` | M + O | id guard; —; ignored body | **201** `CompatibilityView` | 400 id/config; 401/403/404; R/G | None. Studio validates after save. Does not declare build support. |
| POST `/projects/:id/builds` | M + O, via validate | id guard; —; ignored body | **No successful result implemented** | Valid owned draft returns **503** build unavailable; also 400/401/403/404 and R/G | None. No current frontend request found. Studio's action saves/validates rather than calling this endpoint. Swagger's default 201 is misleading. No compilation/queue producer implemented. |

### Automatically registered HTTP surface

Fastify's actual route tree includes HEAD for all GET routes above (same access/handler logic; response body omitted), and wildcard OPTIONS for CORS preflight. An injected HEAD health returned 200 with empty body; allowed-origin OPTIONS devices returned 204 with empty body. These are not independent product contracts or represented as Swagger operations.

Swagger is registered **outside** the global prefix: GET/HEAD `/api/docs`, `/api/docs/`, `/api/docs-json`, `/api/docs-yaml`; UI assets include `/api/docs/swagger-ui-init.js`, `/api/docs/docs/swagger-ui-init.js`, `/api/docs/index.html`, `/api/docs/LICENSE` and `/api/docs/*` static GET/HEAD. They have no application session/ownership requirement; JSON/YAML describe the API, static requests may 404. The Next rewrite proxies only `/api/v1`, so docs are accessed directly on the API origin, not automatically through the frontend. No additional user-directory, device-detail, preset, kernel, artifact or build-configuration HTTP controller was found; configuration persistence is inside ROM projects. Worker has no HTTP API.

## 3. Shared request validators (Zod 4.6.6)

Source: `packages/contracts/src/index.ts`, schema-local compatibility errors in `validation-errors.ts`. API parses shared schemas directly; Swagger does not consume these validators. API/contracts resolve the same Zod error class. No global locale or Zod/OpenAPI integration is configured.

| Schema | Accepted/normalized contract |
| --- | --- |
| `registrationSchema` | Strict object: email string legacy-compatible email regex/max254, lowercased; username 3–30 ASCII `[a-zA-Z0-9_]+`, lowercased; password string 12–128 unchanged. No trim transform on email/password/username. Unknown properties rejected. |
| `loginSchema` | Strict pick of email/password with identical validation/normalization. Login accepts email, not username. |
| `catalogQuerySchema` | Object strips unknown keys. `q`: string trim/max100/default empty. `kind`: optional ROM/RECOVERY/KERNEL. `page`: number coercion, Number.isInteger, 1–10000/default1. `limit`: same coercion/integer, 1–50/default12. Repeated query values/arrays are not an advertised alternate representation. |
| `deviceQuerySchema` | Extends catalog query; optional untrimmed manufacturerId string length1–100. Actual device handler ignores inherited `kind` after validating it. C1 adds decoded-NUL rejection at the handler before Prisma, not a shared-schema behavioral expansion. |
| `romConfigurationSchema` | Strict object: required schemaVersion literal1; name trim1–60; description trim/max2000/default empty; variantId untrimmed1–100; base trim1–100; preset enum below; accent `#` plus six hex digits; darkMode boolean; apps array max4, distinct enum entries; kernel literal `unconfigured`. No nullable field. description is optional input but required output. No string-to-boolean coercion. |
| `saveConfigurationSchema` | Strict `{configuration:romConfigurationSchema,revision:number}`; noncoerced integer >=1. No PostgreSQL Int upper bound declared. |
| `projectMetadataSchema` | Strict pick of configuration name/description; exported but no active HTTP route consumes it. |
| `validateConfiguration` | Parses config, returns current UNKNOWN/foundation-1 result. `CompatibilityResult` is a type union SUPPORTED/UNSUPPORTED/CONDITIONAL/UNKNOWN, not runtime response validation. |

Preset values: Balanced, Gaming, Battery Saver, Performance, Camera Focus, Ultra Lite, Privacy, Beautiful UI, Developer, Fully Custom. App values: browser, calendar, files, terminal. Oversized arrays reject early under patched Zod; duplicate refinement skips redundant work on already oversized arrays. Ordinary message/path compatibility is covered by the B6.6 98-case corpus.

Sentinels `unselected` variant and `unconfigured` base allow drafts. New selections must reference active, non-demo device variants and SOURCE_AVAILABLE bases. Unchanged legacy/deprecated selections remain editable; they are not silently reassigned. There is no implication of device/base compatibility or verified builds.

## 4. Response structures and serialization

These are **observed/source-derived wire descriptions**, not newly introduced runtime schemas. Prisma Dates serialize to ISO strings; nullable database fields remain explicit null. Relation fields appear only where explicitly included. IDs are strings; no general UUID/CUID-only public contract exists. `JSON` below means persisted JSON, not automatically validated output. Arrays are ordinary arrays; no implicit pagination wrapper beyond the tables.

- `PublicUser`: `{id,username,role,emailVerifiedAt}`; id/username strings, role USER/DEVELOPER/MODERATOR/ADMIN, timestamp ISO-or-null. No email, password hash or token.
- `SessionView`: `{id,createdAt,expiresAt}` strings/ISO; no userId or tokenHash.
- `Manufacturer`: `{id,name,slug}` strings. Manufacturer endpoint deliberately returns id/name only.
- `Device`: `{id,manufacturerId,name,slug,codename,chipset,architecture,isDemo,deprecatedAt}`; strings except chipset/architecture nullable strings, isDemo boolean, deprecatedAt nullable ISO.
- `Variant`: `{id,deviceId,modelNumber,region,bootloaderNotes,androidVersions,hardwareVariant,officialSourceUrl,evidenceUrls,sourceCodeUrl,catalogStatus,sourceStatus,buildSupportStatus,reviewedAt,notes}`. IDs/model/region strings; notes/bootloaderNotes/hardwareVariant/source URLs nullable strings; androidVersions/evidenceUrls string arrays; reviewedAt nullable ISO. catalogStatus UNVERIFIED/CATALOGED; sourceStatus UNREVIEWED/SOURCE_AVAILABLE; buildSupportStatus NOT_VERIFIED.
- `DeviceView`: Device plus `manufacturer:Manufacturer`, `variants:Variant[]`, `supportStatus:'UNKNOWN'`, `buildSupportStatus:'NOT_VERIFIED'`, `catalogStatus:'CATALOGED'|'UNVERIFIED'` (CATALOGED only if at least one variant and all cataloged). Active non-demo only.
- `AndroidBase`: `{id,name,androidVersion,sourceRepository,sourceRef,documentationUrl,evidenceUrls,availability,buildSupportStatus,reviewedAt}`. Strings, evidenceUrls string array, availability SOURCE_AVAILABLE/DEPRECATED, buildSupportStatus NOT_VERIFIED, reviewedAt ISO. `BaseView` adds `supportStatus:'UNKNOWN',buildSupported:false`.
- `ROMProject`: `{id,ownerId,configuration:JSON,revision:number,createdAt,updatedAt}`. POST/PATCH return this direct shape without relations. List returns stored JSON directly; new writes use normalized configuration.
- `ROMDetail`: ROMProject with normalized configuration, `deviceVariant:null | (Variant & {device:Device & {manufacturer:Manufacturer}})`, `androidBase:null|BaseView`, `compatibility:CompatibilityView`. Nested device **does not** include variants or the top-level catalog's derived support flags.
- `Revision`: `{id,projectId,number,configuration:JSON,createdAt}`; raw snapshots, not parse-normalized by list handler.
- `CompatibilityView`: `{status:'UNKNOWN',ruleVersion:'foundation-1',explanation:string,blockingIssues:string[],warnings:string[],requiredActions:string[],evidence:string[],configuration:ROMConfiguration}`. Evidence currently empty; mandatory blockers identify missing verified manifest/integration and isolated compilation worker, plus missing variant where applicable. No supported-build flag is inferred.
- `LegacyProject`: `{id,slug,name,kind,description,androidBase,sourceUrl,status,isDemo,organizationId}`; kind ROM/RECOVERY/KERNEL, nullable string androidBase/sourceUrl/organizationId, boolean isDemo, remaining strings. No date fields in this model.
- `LegacyDetail`: LegacyProject plus `releases:Release[]` filtered PUBLISHED and `devices:{projectId,deviceId,device:Device}[]`. `Release`: `{id,projectId,version,channel,status,changelog,createdAt,publishedAt}`; channel STABLE/BETA/NIGHTLY; status filtered PUBLISHED (model also supports DRAFT/QUARANTINED/VERIFYING/READY/REJECTED); publishedAt nullable ISO. No artifact/mirror objects included.
- `AuditLog`: `{id,actorId,action,targetId,createdAt}`; actorId/targetId nullable strings; others strings/ISO. Returned only to admin.

## 5. Consumers, duplication and observed contract differences

| Location | Existing responsibility / gap |
| --- | --- |
| `apps/web/components/account.tsx` | Own request helper/User type, login/register form constraints duplicated in HTML, settings me/sessions/logout/revoke. No shared runtime response parsing. |
| `apps/web/lib/project-api.ts` | Shared web fetch helper and local CatalogDevice/Variant/AndroidBaseOption/SavedProject declarations. Responses are TypeScript casts. SavedProject assumes enriched GET shape even for raw POST/PATCH replies; its nested device type requires catalog fields not actually returned in ROMDetail. Current UI reads the available subset. |
| `components/project-creation.tsx` | Shared configuration schema, auth/catalog fetches and POST save through projectAPI. Device search paginates. |
| `components/project-details.tsx` | Shared configuration/save behavior; GET and PATCH via projectAPI. Merges raw PATCH reply into existing enriched local state. |
| `components/studio.tsx` | Third fetch helper and local Device/Project shapes; shared config parsing/import/defaults; devices/project/list/save/validate consumers. Default device list sees first12 only. |
| `packages/contracts` | Request schemas/config type/helper shared with API/web. No response/error/session/path runtime schemas. |
| `apps/api/src/app.ts` + Prisma | Inline public-user projection, ad-hoc list/direct/error envelopes and ORM-derived response shapes. No response serializer/validator layer. |
| `apps/worker`, other packages | No additional Zod-backed HTTP contracts or frontend consumers identified. Model presence is not an HTTP contract. |

Account/project fetch helpers join error arrays with `. `; Studio's coercion can display comma-separated arrays. Network fallbacks and local types differ. Consolidation is proposed, not done here.

Important compatibility gaps:

1. Requests are runtime-validated; responses are not. POST create is raw ROMProject, GET enriched, PATCH raw; one SavedProject cast does not establish equivalent wire shapes.
2. description defaults during parse, so old stored snapshots/list JSON may omit it while detail GET supplies empty string. Revision snapshots remain raw. Optional input versus required normalized output must be represented separately.
3. Devices accepts/validates `kind` but ignores its meaning. Other unknown query keys are stripped/ignored. No silent semantic change was made.
4. Projects/revisions/audit are truncated; sessions unbounded; no continuation or total. Device/legacy offset totals use a transaction but no explicit repeatable-read snapshot isolation; concurrent updates need not provide immutable paging snapshots. No compound ordering for equal timestamps on truncated lists.
5. Legacy catalog list does not enforce publication/status/demo filtering, while detail filters releases only. This is distinct from owner-scoped private ROM projects; future publication policy needs explicit review, not an invented auth change.
6. Revision accepts integers beyond PostgreSQL Int storage; catalog references live in JSON rather than FK relations. Stored configuration parse errors can currently produce a 400 on a GET with valid request input. These are existing classification/integrity limitations, not newly fixed in C1.
7. Native router errors differ from application errors. Automatic POST 201 applies to login/logout/validate, and Swagger advertises a nonexistent successful build response. Preserve actual contracts until explicit standardization approval.
8. C1 guards only three identified decoded-NUL boundaries. It does not certify every database-bound string or impose a global control-character policy. Broader identifier/config/query policy belongs in evidence-based C2 work.

## 6. OpenAPI evidence

Actual `SwaggerModule.createDocument` JSON, not just source documentation, contains **19 paths / 21 operations; zero component schemas, zero request bodies, zero declared path/query parameters, zero per-operation security declarations**. A cookie security scheme exists, but neither operation requirements nor a global security requirement establish protected-route documentation. Default response entries have empty descriptions and no schemas; tags and registration's summary do not close the gaps.

`docs/api/README.md` points to root `API.md`; that file is a human summary, not generated completeness evidence. Its shorthand about cookie sessions must be read against the public/protected matrix above. Missing: every body/response/error schema above, actual security matrix, parameter validation/defaults, nullable/optional/date wire types, Set-Cookie/Retry-After, pagination/truncation, early framework errors and build-unavailable behavior. Docs/HEAD/OPTIONS are auxiliary surface, not additional advertised business operations. C5 must test generated output against the real routes and fixtures.

## 7. Three reproduced NUL findings and minimal fixes

| Boundary | Before (reproduced) | C1 result and implementation |
| --- | --- | --- |
| DELETE `/auth/sessions/%00` with valid Origin/session | Sanitized 500 from database text input | 400 `Invalid session identifier`; decoded id check after Origin/user lookup, before session.deleteMany. |
| GET `/legacy/catalog-projects/%00` | Sanitized 500 | 400 `Invalid catalog project slug`; before project.findUnique. |
| GET `/devices?manufacturerId=%00` | Sanitized 500 | 400 `Invalid manufacturer identifier`; after normal query parse, before device.findMany/count transaction. |

All checks use actual U+0000, including embedded NUL. They do not recursively decode `%2500`, reject valid opaque legacy IDs, catch arbitrary database exceptions or restrict IDs to CUID/UUID. No compensating mutation or database migration is involved.

Updated final-gate adversarial test now expects 400 and zero unexpected-error log events. New focused real PG/Redis integration test additionally proves: all six NUL/embedded-NUL cases avoid affected delegates; missing/tampered cookie remains401 and invalid Origin403 before private NUL validation; once-decoded literal `%00` remains ordinary opaque text (unknown session200, slug404, manufacturer empty200); project NUL remains401 before auth/400 after auth; valid session survives; injected Prisma initialization errors for valid identifiers still503 without sensitive marker. Delegate spies/faults are local to the test and restored before fixture cleanup.

## 8. Files modified by C1

- `apps/api/src/app.ts`: three narrow decoded-NUL guards only.
- `tests/api.integration.ts`: existing final-gate expectations updated, one focused boundary/auth-order/infrastructure regression added.
- `docs/backend/phase-c1-contract-inventory.md`: this report.

The repository already contained earlier uncommitted phase work; that work was preserved. Ignored `.local/c1-*` helpers/logs are verification artifacts, not shipped product changes. No frontend, shared schema, dependency, database schema or environment file changed in C1.

## 9. Verification results

Final executed results are recorded below after all checks and fixture cleanup.

| Executed check | Exact result |
| --- | --- |
| `pnpm typecheck` | PASS. Root test typecheck plus 7 successful workspace tasks, all 7 workspace tasks cached on final run. |
| `pnpm lint` | PASS. 7 successful tasks, 6 cached; existing conventions (web ESLint, backend TypeScript lint script). |
| `pnpm test` | **34 passed, 0 failed**, no skipped/cancelled tests. |
| `pnpm test:integration` | **14 passed, 0 failed**, no skipped/cancelled tests; real local PostgreSQL and Redis. Includes original auth/atomic rollback/cookie/proxy/limiter/ownership regressions and C1 additions. |
| Focused C1 `--test-name-pattern` run | **1 passed, 0 failed**; delegate call counts and infrastructure faults are test instrumentation, not an assertion that a real database outage occurred. |
| `pnpm test:e2e` | **6 passed**, Chromium against production API and web servers through Next proxy. Includes registration/session/logout, real-device draft persistence and failure UX. Synthetic credentials only. |
| `pnpm build` | PASS, **7 successful tasks / 5 cached**; API rebuilt with guards. Production web build reused a valid cached result. No clean-cache rebuild claim. |
| `pnpm audit --json` | Exit0; **0 critical/high/moderate/low/info advisories**, 636 total dependencies in audit metadata. |
| `pnpm audit --prod --json` | Exit0; same zero totals, 267 dependencies in metadata. No dependency or lockfile changes in C1. |
| `pnpm db:status` | Three migrations found, database up to date. **No migration executed.** |
| Read-only pre/post Prisma model count/digests | **All 28 unchanged** after synthetic fixture cleanup. Existing accounts, sessions, projects and other model rows preserved; no stored user credentials used. Schema file/migrations untouched. |
| Environment/HMAC preservation | Root environment byte-for-byte unchanged; ignored/untracked, mode0600. Known HMAC/database secret scan: **0 matches** in 146 nonignored repository files, 10 verification logs and 20 client static assets at check time. This is a bounded known-value scan, not universal secret detection. |
| Live API/web after restoration | health4000, ready4000, web3000 and ready through Next3000 all **HTTP200**. Normal development servers restored with explicit API PORT4000/web PORT3000; PG/Redis storage untouched. |
| Swagger/route inspection | Fresh live JSON confirms 19 paths/21 operations and all zero coverage counts in section6; actual Fastify route tree includes documented HEAD/OPTIONS/assets. |
| `git diff --check` | PASS. |

Integration coverage verifies B1 legacy/current password behavior and safe upgrades, B2 transaction fault rollback, B3 cookies/exact-peer proxy trust, B4 shared atomic IP limits/outage recovery, B6.3 account HMAC normalization/limits/outage recovery, B6.1 logging and ownership boundaries, and B6.6 validation compatibility. No account-aware threshold, Redis namespace policy or security setting was changed. Existing stored session rows remain unchanged by digest comparison; fixture authentication proves request behavior without using a real user's credential. No real production TLS, deployment, load certification or penetration test was performed.

The first focused test-development attempt failed because Node mock.method cannot inspect Prisma's proxy method descriptors. It was corrected with explicitly restored, test-only counted wrappers; the focused rerun and full final suite above passed. That initial harness failure is not represented as a passing run. Ignored `.local/c1-*.log`, audit JSON and preservation helpers hold local evidence; no raw database records or secret values were printed.

## 10. Proposed C2–C5 sequence (not implemented)

| Phase | Prioritized scope | Dependencies / acceptance |
| --- | --- | --- |
| **C2 — Shared contracts** | Define endpoint-specific wire types/schemas for public user/sessions/catalog/base/raw project/detail/revision/compatibility and errors; consolidate duplicated types without changing responses. Separate input/defaulted output and nullable relations. Inventory path/query policy and storage bounds; retain auth-first validation and opaque IDs. | Use this inventory and B6.6 corpus; prove current real responses conform before enabling parsers. Any stricter previously valid input rule or revision bound requires explicit compatibility review. No DB migration/product endpoint. |
| **C3 — Response/error consistency** | Adopt common web transport/error decoding internally, preserve current wire shapes/statuses; propose early router-error normalization and stored-data versus input classification. Add endpoint-specific response regressions. | C2 schemas first. Do not globally wrap direct project results or change POST statuses silently. Review public legacy visibility and enumeration policy separately if product decisions are required. |
| **C4 — Pagination/query contracts** | Propose backward-compatible continuation/metadata for latest100/50 lists, session bounds, deterministic tie-breakers; resolve ignored device kind and repeated/coerced query semantics. | C2/C3 baseline. Keep current defaults/clients functional; explicitly review any limit/filter/order change. No speculative indexing/schema migration. Validate concurrency semantics and existing catalog pagination. |
| **C5 — Complete OpenAPI + drift tests** | Connect approved shared contracts to documentation; all bodies/parameters/responses/errors/cookies/security/headers; actual503 build behavior, pagination/null/date semantics. Route-to-document coverage and live response/request contract tests. | Documentation design may start with C2; finalize generated contracts after C3/C4 decisions. Avoid a second independent handwritten schema system. Keep JSON/YAML compatibility and security regressions. |

The adjusted boundary is deliberate: C2 models the **existing different** response shapes; C3 cannot silently standardize them into one shape. OpenAPI mapping can be planned alongside C2 but final completeness depends on the C3/C4 decisions. Neither a new contract integration dependency nor later implementation is authorized by this report.

Remaining production-only risks from the final gate (actual TLS/proxy/private ingress, Redis/DB isolation and capacity, backups/restore, load/abuse evidence, monitoring, retention and worker hardening) remain open. Zero audits and local compatibility do not resolve them. **Stop after C1; C2 requires approval.**
