# Phase C2 — Shared API contracts

Work date: 2026-10-29, Asia/Dushanbe. C1 and the Final Security Gate were reviewed before implementation. Development authorization is separate from the public-production NO-GO.

## Pre-change consolidation plan

1. Preserve the existing request schemas verbatim in the contracts package; make the index a public barrel with separate request and response modules, avoiding backend imports and circular dependencies.
2. Define shared Zod wire schemas and inferred types for public auth/session, catalog, bases, raw/write/detail project shapes, revisions, compatibility and existing application errors. Keep schema-local request messages and Zod4.6.6. Separate stored optional description from normalized output and nullable relations from absent fields.
3. Replace account, project-api and Studio's local API interfaces with shared types. Correct the mistaken enriched-type claim for plain POST/PATCH responses. Keep UI markup, transport behavior, API status codes and server validation unchanged.
4. Connect the backend public projection/compatibility typing to shared contracts without introducing response parsing/serialization middleware. Existing server-side request parsers and ownership remain authoritative.
5. Add focused unit and real HTTP schema-compatibility tests; rerun full checks, audits, preservation and availability checks. No C3 transport/error standardization, C4 query/pagination or C5 OpenAPI generation.

Confirmed duplication: account User/session types; project-api CatalogDevice/CatalogVariant/AndroidBaseOption/SavedProject; Studio Device/Project/compatibility subsets; local auth/catalog envelope declarations. Existing request validators already have shared ownership; no competing backend-only Zod schema needs moving. Worker has no HTTP/Zod contract consumer. Prisma enums represent storage and are not safe client imports.

## Shared ownership and migration

| Module | Authoritative contracts / consumers |
| --- | --- |
| `packages/contracts/src/requests.ts` | Existing registration/login, catalog/device query, ROM configuration, metadata, save/CAS schemas, defaults and compatibility helper moved from index. Existing parse constraints/messages/transforms preserved. New inferred input aliases distinguish optional description input from normalized configuration output. |
| `packages/contracts/src/responses.ts` | Strict public wire schemas and inferred types for auth/me, sessions, success, application/native-router errors, manufacturers/devices/variants, Android bases, raw project list, normalized write/detail, revisions, compatibility, health/readiness, admin audit and legacy catalog. No backend/Prisma imports or secrets. Legacy project kind reuses the existing query enum. |
| `packages/contracts/src/index.ts` | Public barrel; existing imports remain valid. Response module imports request module directly; no circular module dependency. |
| `apps/api/src/app.ts` | Public user select checked against shared public-user keys; validate controller return checked against shared CompatibilityResponse. Existing request parses continue importing the authoritative schemas via the same package. No response middleware/serializer or new failure path. |
| Web account | Shared PublicUser, Session, AuthenticationResponse, SessionsResponse, SuccessResponse; typed helper return. HTML controls and network/error behavior unchanged. |
| Web project-api / creation / details | Local catalog/base interfaces removed; shared types re-exported for existing callers. Creation uses write response; detail GET uses enriched response; PATCH uses plain write response merged into existing detail state. Catalog/auth envelopes imported instead of duplicated. |
| Web Studio | Shared catalog, write/detail, compatibility and persisted-project presentation types replace local subsets. Fetch implementation and rendering unchanged. |
| Worker and remaining packages | No existing HTTP/Zod contract duplication identified. No speculative worker HTTP contract added. |

The application/environment/password-hash validators remain backend-only: they describe trusted infrastructure/secrets and are not public client contracts. Prisma enums still own storage constraints; wire enums live in contracts and do not import the generated backend client. A future storage enum change requires compatibility review, not silently exporting Prisma models to browsers.

## Compatibility decisions

- **Plain versus enriched projects:** POST/PATCH are direct plain project objects; GET detail adds required nullable deviceVariant/androidBase and compatibility. The removed SavedProject definition falsely modeled the nested device as a full catalog device and treated detail relations as optional. Shared detail schema matches the actual nested Device+Manufacturer without variants/support decoration. No server response changed.
- **Raw persisted JSON:** project lists/revision snapshots do not parse configurations. Their wire schemas use JSON, preserve missing legacy description and accept arbitrary out-of-band JSON without pretending it is a valid configuration. Write/detail config uses the existing normalized ROM schema. No stored configuration is rewritten. StoredProjectView/StoredProjectsView are explicitly named presentation assumptions derived from configuration input, with optional description; they are not raw wire validation guarantees. Studio retains its existing assumption that persisted drafts are renderable. A safe malformed-history UX/adapter requires separate review.
- **Nullable versus missing:** public email verification, device evidence/hardware/notes/timestamps and nullable project relations are required nullable fields, matching JSON. Catalog fields previously marked optional in local frontend types now reflect required server fields. No default/fallback is inserted into server responses.
- **Error contracts:** application envelope retains string OR string-array messages/requestId; early Fastify router error remains a separate schema. No global envelope, status, message or frontend error-joining change. C3 owns standardization.
- **Request security:** strict auth/config/save request objects still reject unknown fields. Lowercasing, email regex, password bounds, query stripping/coercion, schemaVersion1, draft sentinels, array bounds/deduplication and selection/ownership checks are unchanged. Existing 98-case Zod corpus remains regression evidence. No new UUID/control-character policy or revision bound was imposed.
- **Compatibility literal:** the existing helper's `ruleVersion` now has `as const` typing to satisfy the shared literal contract; runtime value remains foundation-1. UNKNOWN/NOT_VERIFIED statuses are preserved; no builds or new support claims.

## Runtime trust boundaries

Shared types do not replace runtime request validation. Nest handlers continue parsing untrusted requests before using them; authenticated ownership/proxy/Origin checks remain authoritative. Response schemas are exercised in tests, **not installed as production serializers or automatic fetch parsers**. Strict response schemas reject secret-bearing/extra response properties in tests; existing explicit backend projections remain the actual production leak-prevention boundary.

The three transport helpers still perform JSON casts at the network boundary. These are explicit unchecked generic assertions, not a claim that TypeScript verifies HTTP data. Installing runtime client parsers now could reject historical responses or change failure UX, so it was intentionally deferred. HTML form constraints remain an additional UX layer, not independent server authority. Broad compatibility enum types versus the current UNKNOWN-only response are different concepts, not permission to emit supported builds.

## Focused coverage and observations

Three added unit tests cover strict valid/invalid auth payloads, normalization, missing/null fields, rejection of password/token/email extras in public user/session schemas, existing error variants, raw legacy JSON preservation, plain-versus-detail project schemas, request field injection, duplicate apps, compatibility status and nested catalog evidence/arrays.

One added real PostgreSQL/Redis integration case checks unchanged parsed JSON (deep equality with original wire body) for registration/me/sessions, health/readiness, manufacturers/devices/bases/legacy list, project create/list/detail/update/revisions/validate, unavailable build error, logout/unauthorized errors and forbidden ownerId injection. It exercises both null and non-null project relations using existing source catalog entries; nested detail device is verified not to contain catalog variants. Fixtures are isolated synthetic accounts/projects and cleaned only by their unique test identity. No real user credentials used.

An initial added-test root typecheck caught heterogeneous schema-union inference and nullable detail handling; both harness types were corrected. A subsequent API build caught widened ruleVersion inference; adding the literal annotation resolved it without changing JSON. Final successful results below supersede those development failures; no failed command is represented as passed.

Static type-erasure comparison of the five changed web modules against their pre-C2 HEAD content found unchanged emitted tokens in four; detail differed only by harmless trailing-comma punctuation in its metadata-schema import. No JSX, CSS, text, icons, navigation, layout or animation changed. A production build and the existing accessibility/browser suite validate integration; no visual redesign was performed.

## Files modified by C2

1. `packages/contracts/src/index.ts` — public barrel.
2. `packages/contracts/src/requests.ts` — moved original request definitions; inferred input types and literal typing.
3. `packages/contracts/src/responses.ts` — shared wire schemas/types and explicit presentation projection.
4. `apps/api/src/app.ts` — public select and compatibility return type checks.
5. `apps/web/lib/project-api.ts` — re-export authoritative types; remove duplicated interfaces.
6. `apps/web/components/account.tsx` — shared auth/session types.
7. `apps/web/components/project-creation.tsx` — endpoint-specific shared response types.
8. `apps/web/components/project-details.tsx` — separate detail and write types.
9. `apps/web/components/studio.tsx` — shared catalog/project/compatibility types.
10. `tests/shared-contracts.test.ts` — three unit regressions.
11. `tests/api.integration.ts` — one real HTTP compatibility regression.
12. `docs/backend/phase-c2-shared-contracts.md` — plan and final report.

Earlier uncommitted phases remain intact; a full git diff includes those earlier changes. No dependency manifest/lock/patch, environment, database schema/migration or worker file was modified by C2. Ignored .local/c2 helpers/logs are local verification artifacts.

## Verification and integrity

| Executed check | Final result |
| --- | --- |
| `pnpm typecheck` | PASS: root test typecheck and 7 workspace tasks; 4 cached. |
| `pnpm lint` | PASS: 7 tasks, 4 cached; web ESLint/backend existing TypeScript convention. |
| `pnpm test` | **37 passed, 0 failed**, no skipped/cancelled tests (34 existing + 3 C2). |
| `pnpm test:integration` | **15 passed, 0 failed**, no skipped/cancelled tests (14 existing + 1 C2), real PG/Redis. |
| Focused C2 HTTP test | **1 passed, 0 failed**, additionally executed before full final suite. |
| `pnpm test:e2e` | **6 passed** in Chromium; production API/web, Next proxy, synthetic auth/session/logout and real-device project persistence. |
| `pnpm build` | PASS: 7 tasks, 3 cached; contracts/API/web rebuilt. No clean-cache claim. |
| `pnpm audit --json` | Exit0: **0 critical/high/moderate/low/info advisories**, 636 total dependencies in metadata. |
| `pnpm audit --prod --json` | Exit0: same zero advisory totals, 267 dependencies in metadata. No dependency changes. |
| `pnpm db:status` | Three migrations found; up to date. No migration executed. |
| Read-only model count/digest comparison | **All 28 unchanged** after all test fixture cleanup. Existing records and schema preserved. |
| Environment/secret check | Existing root environment byte-for-byte unchanged, ignored/untracked, mode0600. **Zero known HMAC/database secret matches** in 150 nonignored repo files, 12 verification logs, 20 client static assets at scan time. No secret value printed or rotated. This bounded known-value scan is not a universal secret detector. |
| Live restored development services | API4000 health and readiness, frontend3000 root and readiness through Next proxy all **HTTP200**. |
| `git diff --check` | PASS. |

The final suite includes B1 legacy/current scrypt/CAS upgrades, B2 atomic registration rollback and duplicates, B3 cookie/proxy/HTTPS behavior, B4 distributed IP Redis atomic limits/outage recovery, B6.3 account HMAC admission/outage recovery, C1 NUL/authorization boundaries and B6.6 validation corpus/dependency compatibility. Passing tests do not certify production transport, load capacity or all possible attacks.

Initial local PostgreSQL was stopped and the existing Redis container had exited cleanly; API/web ports were not listening. Restored **existing** PostgreSQL data with `pnpm db:local:start` and **existing** `rom-hub-redis` with `podman start`; no initialization/reset, migration, queue erasure or secret regeneration. Baseline digests were collected after restoring access and before synthetic fixture tests. The initial baseline attempt could not connect and was not counted as successful verification. After checks, normal development servers were started with explicit `PORT=4000 pnpm dev:api` / `PORT=3000 pnpm dev:web`. No claim about production deployment is made.

## Remaining limits and Phase C3 recommendation

**Ready for explicit C3 approval**; all final checks above passed. Do not infer public-release approval. Recommended C3: agree endpoint-specific response/error contracts, consolidate transport/error decoding without changing current wire shapes, and review early-router versus stored-data error classification. Test opt-in response parsing against raw/legacy data before enabling it; do not silently wrap direct project objects or change POST201 statuses.

Sparse OpenAPI, list truncation/query semantics, ignored device kind, storage bounds/JSON references, publication policy, account enumeration/retention, worker hardening and deployment capacity/TLS/backup requirements remain as documented in C1/final gate. Strict response schemas will deliberately flag future unknown fields in compatibility tests; additive API changes need shared-schema review. New response schemas are not evidence of complete OpenAPI coverage or a new production response firewall.

C3 transport changes, C4 pagination and C5 OpenAPI were **not implemented**. Public deployment remains **NO-GO**. Stop after C2 and await approval.

