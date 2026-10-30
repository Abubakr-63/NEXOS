# API contracts and OpenAPI

The checked-in [OpenAPI 3.1 document](openapi.json) covers the existing 21 v1
operations. It is derived from shared Zod contracts plus route-specific descriptive
metadata in `apps/api/src/openapi.ts`. Runtime controllers and validators remain
authoritative; generating documentation does not alter request/response behavior.

The running API serves `/api/docs`, `/api/docs-json` and `/api/docs-yaml` on its
own origin (normally localhost:4000). The Next proxy forwards `/api/v1`, not docs.
Cookie, exact Origin/JSON and trusted production HTTPS checks still apply to
Swagger requests. A docs page on a different origin cannot override that policy.

From the repository root:

```sh
pnpm openapi:export
pnpm openapi:validate
```

Export rebuilds contracts/API and writes `docs/api/openapi.json`; an optional
output path may be supplied. It constructs metadata without initializing services,
listening, querying PostgreSQL or connecting Redis. Existing configuration is
loaded through the repository environment wrapper; no secret is exported or rotated.
Validation rebuilds without regenerating the artifact, so stale documentation fails.
The tests use existing Fastify Ajv tooling and a vendored OpenAPI schema offline.

`pnpm test` includes specification/drift tests after the normal build;
`pnpm test:integration` additionally checks actual routes and HTTP responses against
the served spec, including errors, headers and both pagination variants.

Legacy `{items}` responses and C4 cursor opt-in remain distinct; sessions are still
unbounded without opt-in. Builds deliberately have no successful response. See
[human API summary](../../API.md), [C4 pagination](../backend/phase-c4-pagination-query-contracts.md)
and [C5 verification/limitations](../backend/phase-c5-openapi-contract-tests.md).

JSON Schema cannot execute normalization, database selection/ownership or cursor
validation. Explicit adapters cover named refinements; UTF-16 versus code-point
length semantics and legacy numeric query coercion are described in the C5 report.
No production deployment approval is implied.
