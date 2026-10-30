# Phase C3 — Response and error contracts

Reviewed **2026-10-29**, Asia/Dushanbe. Inputs: Final Security Gate, C1 inventory, C2 consolidation report, all controller handlers and their shared schemas, Fastify bootstrap/filter, three frontend request helpers and current tests. This is a local engineering phase, not production certification.

## Outcome and compatibility boundary

Shared error construction and frontend message decoding now have one owner in `@rom-hub/contracts`. Successful JSON shapes, status codes, cookies, authorization, redirects and rate-limit headers remain unchanged. No universal response wrapper/serializer, networking framework, automatic retries or new endpoint was introduced.

Two narrowly verified error-classification defects were repaired:

- NUL search text on devices/legacy catalog, and NUL project name/description/variant/base inputs, returned sanitized500. They now fail shared request validation with400 before persistence/lookups. These are proven PostgreSQL-invalid inputs, not a new search/filter feature or general control-character restriction.
- Invalid **persisted** configuration was treated like invalid client input. Valid requests encountering it now return sanitized500; invalid request bodies still400. No existing configuration is repaired or rewritten automatically.

These are the intentional changes to formerly erroneous failure cases. Normal input errors/messages and successful operations remain compatible. Public production remains **NO-GO**. C4/C5 have not started.

## 1. Audit of all 21 operations

Paths below use `/api/v1`. Full field-level shapes remain in C1 and the C2 response schemas; this matrix records current status/envelope/error distinctions rather than pretending every ORM object is interchangeable.

Common errors: all controller operations can429 through existing guards; 500 unexpected errors are sanitized. Prisma initialization failures map503; P2002 maps409. These mappings do not imply every database failure is classified503. Malformed JSON/oversized/media-type/parser requests may produce their existing400/413/415 errors. Early malformed URI400 retains Fastify's native shape. Rate guards/parser errors can precede controller checks.

`S`: authenticated unexpired cookie, else401; production insecure auth transport403. `M`: exact Origin/JSON and production HTTPS, else403. `O`: S+owner-scoped query; absent/foreign project404. `A`: S+ADMIN, else403. No changed auth ordering.

| Method/path | Actual success JSON/status | Specific failure behavior and frontend assumptions |
| --- | --- | --- |
| POST `/auth/register` | 201 `{user}` + committed session cookie | M; strict shared body400; email/username409; distributed IP429/Redis503 with Retry-After. Account helper retains sentence-separated validation errors and success redirect. |
| POST `/auth/login` | 201 `{user}` + rotated cookie | M;400; generic credentials401; IP/account429 and Redis/capacity503 with Retry-After. No auth response/session semantics changed. |
| GET `/auth/me` | 200 `{user}` | S;401/403. Settings/creation gate retain expired/revoked-session handling. |
| POST `/auth/logout` | 201 `{success:true}` + clearing cookie | M; idempotent even without valid session;403 on invalid Origin/transport. Account state behavior unchanged. |
| GET `/auth/sessions` | 200 `{items:[id,createdAt,expiresAt]}` | S;401/403; current user only. Account loads/clears state as before. |
| DELETE `/auth/sessions/:id` | 200 `{success:true}` | M then S; decoded NUL400 after auth; unknown/foreign valid id also200, no existence leak. Self-revocation still makes next authenticated read401. |
| GET `/health` | 200 `{status:'ok',service:'rom-hub-api'}` | Public; liveness independent of DB/Redis. Existing local throttle can429. |
| GET `/ready` | 200 `{status:'ready'}` | Public; PG/Redis failure503 `Required service unavailable`. No dependency details leaked. |
| GET `/manufacturers` | 200 `{items:[id,name]}` | Public DB read; no body/query contract. Creation consumer unchanged. |
| GET `/android-bases` | 200 `{items:BaseView[],explanation}` | Public; UNKNOWN/buildSupported false. No inferred build compatibility. |
| GET `/devices` | 200 `{items:DeviceView[],total,page,limit}` | Query validation400, manufacturer NUL400; **q NUL now400**. Creation paginates; Studio retains first-page behavior. |
| GET `/legacy/catalog-projects` | 200 `{items:LegacyProject[],total,page,limit}` | Query validation400; **q NUL now400**. Public legacy visibility/filter behavior unchanged; no current UI request found. |
| GET `/legacy/catalog-projects/:slug` | 200 `{project:LegacyDetail}` | NUL400, absent404; no ownership rule for public legacy catalog. Native malformed URI400 distinct. |
| GET `/admin/audit` | 200 `{items:AuditLog[]}` | A;401/403. No frontend consumer found; no new disclosure/projection. |
| GET `/projects` | 200 `{items:RawROMProject[]}` | S; owner filter. Raw stored JSON remains raw; list is not parse-normalized. Studio presentation assumptions remain documented. |
| POST `/projects` | 201 `ProjectWriteResponse` direct object | M+S; body/selections400, including four newly rejected NUL text fields. Server assigns owner. No enriched relations added. |
| GET `/projects/:id` | 200 `ProjectDetailResponse` direct enriched object | O; control-character id400 after auth;401/403/404. **Invalid stored config now500**. Existing detail error display remains general Error handling. |
| PATCH `/projects/:id` | 200 `ProjectWriteResponse` direct object | M+O; request400, selection400, stale revision409. Invalid stored config500 before writes. Client still merges plain reply into detail state. |
| GET `/projects/:id/revisions` | 200 `{items:Revision[]}` | O;400 id/401/403/404. Raw snapshots retained; no new normalizer. |
| POST `/projects/:id/validate` | 201 `CompatibilityResponse` | M+O;400 id,401/403/404; invalid stored config500. Current result UNKNOWN/foundation-1. Studio display formatting preserved. |
| POST `/projects/:id/builds` | **No successful result** | M+O via validate. Valid owned config503 build unavailable; invalid stored config500 rather than false availability diagnosis; auth/id/not-found behavior retained. No compiler/producer activated. |

Public/private legacy distinction, POST201 semantics, raw/write/detail differences, required-nullable relations and list truncation are unchanged. Swagger's sparse schemas and placeholder201 for builds remain a C5 gap, not an assertion that this matrix was generated from complete OpenAPI. HEAD/CORS OPTIONS/docs assets remain as inventoried in C1.

## 2. Canonical shared errors

`packages/contracts/src/errors.ts` owns:

- `apiErrorMessageSchema`: string OR string array, preserving Zod issue-path/message representation.
- `apiErrorSchema` / `APIErrorResponse`: existing `{error:{status,message,requestId}}`, with no added fields.
- `apiErrorsByStatus`: literal-status schemas for **400,401,403,404,409,429,500,503**; `CanonicalErrorStatus` is their key union.
- `createAPIError`: typed construction only, no runtime coercion/reparse, exception introspection or header changes.
- `formatAPIErrorMessage`: safe envelope extraction and explicit legacy display policies, no fetch/retry/logging.

The general schema still accepts other integer HTTP statuses such as413/415; restricting it to the eight named statuses would reject existing framework errors. The existing native `routerErrorSchema` stays separate. Canonical shared construction does not mean every early router error now has the NEXOS envelope.

The public package index remains compatible. Error definitions moved from responses.ts into the dedicated module; no direct internal-subpath consumer was found. Response shape/schema logic otherwise stays unchanged.

## 3. Backend changes and reproduced defects

`Errors.catch` retains the same mappings and logging decisions, now using typed message and shared construction. It does not read arbitrary exception messages for unknown failures. HttpException messages remain the existing explicit handler/framework messages. Generic failures still log only event/requestId/exception class; no exception cause, stack, query, body, cookie or token is emitted by that path. Existing sanitized Fastify request serializer was preserved.

### Stored configuration boundary

The new real fixture test was first run against the old API and failed as expected: detail GET **actual400, expected500**. The valid request was being blamed for invalid database JSON. That red run is recorded in ignored `.local/c3-before.log`, not counted as a successful final test.

`parseStoredConfiguration` now wraps only a ZodError from parsing saved project data as an internal Error, retaining its cause without exposing it. Other exceptions are rethrown unchanged. Three existing parse sites use it: detail GET, prior-config parse during PATCH selection validation, and validate (also used by builds). Request-body parsing remains direct Zod validation. No broad Prisma/error catch or infrastructure-to400 conversion was added.

Final integration assertions cover500 for all four affected operations, generic message and requestId, four sanitized correlated log events, no marker/schema-path disclosure, no spurious Retry-After, request-body400, Origin403, unauthenticated401, foreign/missing404 and valid session afterward. Revision/config/snapshot state stays unchanged. The corrupted record belongs only to a new synthetic fixture and is cleaned afterward; existing user rows were never changed.

### Additional NUL boundaries

Direct local probes reproduced500 for **both** `devices?q=%00` and `legacy/catalog-projects?q=%00`. An isolated synthetic-account probe separately reproduced500 on project POST for **each** of name, description, variantId and base containing embedded NUL. No user payload, password or database exception detail was printed; only field/status results were retained.

A small reusable predicate in shared request schemas rejects actual U+0000 in those proven PostgreSQL text/JSONB boundaries. Query message: `q: Invalid search query`; project issues retain the ordinary path-prefixed Zod array, with field-specific Invalid project name/description/device variant identifier/Android base identifier messages. Valid whitespace/default/coercion, opaque IDs, enums, optional description and unknown-property behavior stay unchanged. Metadata/save schemas inherit the same correct field validators. It is not recursive URL decoding, a UUID policy or a blanket password restriction. Password NUL remains valid for hashing and is tested separately.

Integration covers NUL/embedded NUL on both query handlers and all four project fields,400 envelopes and absence of internal-error events. Existing C1 NUL path/manufacturer/authorization/infrastructure tests continue passing. No claim is made that every conceivable malformed string or database failure is globally normalized.

## 4. Frontend compatibility

| Consumer | Preserved behavior using shared formatter |
| --- | --- |
| Account helper | `nullish` fallback; arrays joined `. `; empty message/empty array remain empty. Existing JSON parse fallback, form validation, redirects and session state unchanged. |
| Project helper | `falsy` fallback; arrays joined `. `, including empty array staying empty; existing ProjectAPIError status/network fallback and AbortError propagation. |
| Studio helper | `stringified` policy, retaining comma-separated arrays and fallback for empty message/array; same JSON parse/network behavior. |

No fetch settings, credentials, cookie handling, unsafe-write retry or redirect policy changed. No retries were added. Safe extraction uses the existing nested envelope; native router errors still take the existing fallback rather than exposing raw URL details. Unsupported/malformed absent envelopes receive the caller's fallback; valid application messages remain unchanged.

Unit tests cover all eight statuses, string/array envelopes, extra-secret/stack field rejection, empty/null/false/zero values, native fallback, success JSON, ProjectAPIError status/message, cancellation/network/invalid JSON behavior and exactly one PATCH request even for429/503. The formatter has no authority to sanitize server exception content; backend mapping remains that security boundary.

## 5. Modified files (C3 only)

1. `packages/contracts/src/errors.ts` — shared schema/status construction/formatter.
2. `packages/contracts/src/index.ts` — public errors export.
3. `packages/contracts/src/responses.ts` — removed duplicate error definition; preserved native schema.
4. `packages/contracts/src/requests.ts` — narrow proven-NUL refinements only.
5. `apps/api/src/app.ts` — typed error construction and saved-data parsing boundary.
6. `apps/web/lib/project-api.ts` — shared message formatter.
7. `apps/web/components/account.tsx` — shared message formatter.
8. `apps/web/components/studio.tsx` — shared message formatter.
9. `tests/error-contracts.test.ts` — five targeted unit tests.
10. `tests/api.integration.ts` — one added real PG/Redis boundary/error regression.
11. `docs/backend/phase-c3-response-error-contracts.md` — this report.

Earlier uncommitted phase changes remain in the working tree. No JSX/design text, CSS, icon, layout, animation, database schema/migration, dependency manifest/lock/patch, environment or authentication/rate-limit policy file was changed by C3.

## 6. Exact final verification

| Executed check | Final result |
| --- | --- |
| `pnpm typecheck` | PASS: root tests plus seven workspace tasks, four cached. |
| `pnpm lint` | PASS: seven tasks, four cached; existing web ESLint/backend TypeScript conventions. |
| `pnpm test` | **42 passed, 0 failed**, no skipped/cancelled cases; includes five new C3 tests. |
| `pnpm test:integration` | **16 passed, 0 failed**, no skipped/cancelled cases; real local PostgreSQL/Redis, one new C3 case. |
| `pnpm test:e2e` | **6 passed**, Chromium with production API/web and Next proxy. |
| `pnpm build` | PASS: seven successful tasks, three cached; contracts/API/web rebuilt. No clean-cache claim. |
| Dependency audits | `pnpm audit --json` and `pnpm audit --prod --json` both exit0, **zero critical/high/moderate/low/info advisories**. Metadata totals636/full and267/production. No dependency change. |
| `pnpm db:status` | Three migrations found; database up to date. No migration executed. |
| 28-model pre/post counts/digests | **All unchanged**, after complete fixture cleanup and isolated probes. Existing records retained; schema/migration files unchanged. |
| Environment/HMAC check | Root environment byte-for-byte unchanged; ignored/untracked, mode0600. Zero known HMAC/database secret matches in153 nonignored repository files,12 verification logs and20 static client assets at scan time. No secret rotated/printed. Bounded known-value scan, not universal secret detection. |
| Live restored development API/web | health4000, ready4000, frontend3000, proxied ready3000 all **HTTP200**. Both live NUL search probes now400 with the shared query message. |
| `git diff --check` | PASS. |

During test development, the added fetch mock initially lacked two parameter annotations and root typecheck failed; those test types were fixed and the final root/workspace check passed. The deliberate pre-fix stored-data red test and pre-fix NUL probes are not counted as passing verification.

Regression evidence by requirement:

- C2 real response/schema deep-equality checks retain success structures, nullability and direct/enriched project distinctions; the 98-case Zod corpus still passes.
- Existing auth/atomic registration tests cover password/session behavior, duplicate409 and rollback. Ownership tests retain foreign404 and admin403; C3 adds invalid-body400, Origin403 and unauthenticated401 precedence with invalid stored data.
- Existing C1 tests cover malformed path/manufacturer queries and prove real infrastructure exceptions remain503. C3 adds both shared search routes and four configuration fields.
- IP limiter integration uses two API processes with real Redis and an isolated TCP fault proxy; closing/reopening it verifies controlled503/Retry-After and recovery without shutting down shared Redis. Account tests use independent instances and a test-owned WRONGTYPE state fault for fail-closed503, plus actual cooldown/recovery. Existing429/Retry-After assertions pass. Neither production topology nor total fleet outage was certified.
- Existing captured logging/parser/URI/unmatched-route tests preserve query and known-secret redaction. Added internal-data failure assertions verify generic client errors and correlated sanitized logs; generic unexpected-error regression still passes.
- Shared formatter/project-client unit tests and six browser tests cover display compatibility, statuses, no retry, registration/session/logout and exact catalog draft save/retrieval. No real user credential or existing stored session token was used in automated tests. Existing project/session rows are verified read-only by digest, while API access is exercised with synthetic owned projects.

Development servers were paused for production builds/E2E and restored afterward using `PORT=4000 pnpm dev:api` and `PORT=3000 pnpm dev:web`. PostgreSQL/Redis remained running with existing storage; no reset, queue erasure or data migration. No public deployment, load certification or penetration test was performed.

## 7. Deferred decisions and Phase C4

**C4 may be proposed for approval after this green C3 verification; it has not started.** Scope should remain existing query/pagination behavior: latest100 projects/latest50 revisions/admin rows, session bounds, deterministic ordering and continuation/metadata, and the ignored devices kind parameter. Preserve current defaults/consumers until an explicit compatibility plan is approved.

Deferred breaking changes: universal success wrapper, POST200/204 conversion, uniform error message scalar/object, replacing Fastify's native bad-URI shape, automatic response parsing that rejects raw legacy JSON, and publication/ownership policy changes. OpenAPI generation/completeness is C5. Existing enumeration, retention, worker, production TLS/proxy/network/Redis capacity/backup/monitoring limitations remain from the final gate; this phase did not certify production or perform a penetration test.

Stop after C3. Public production deployment remains **NO-GO**. Await explicit approval for C4.
