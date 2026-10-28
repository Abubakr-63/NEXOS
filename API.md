# REST API

Prefix: /api/v1. OpenAPI: /api/docs. Cookie sessions and global rate limits apply; JSON mutations require the configured exact WEB_ORIGIN.

- POST /projects: strict ROM configuration; creates an owned draft and revision 1.
- GET /projects: latest 100 owned drafts.
- GET /projects/:id: owned configuration and revision.
- PATCH /projects/:id: {configuration, revision}; atomic save, 409 on stale revision.
- GET /projects/:id/revisions: latest 50 snapshots, owner only.
- POST /projects/:id/validate: validates persisted state; UNKNOWN until evidence exists.
- POST /projects/:id/builds: same checks, then 503 while compilation is unavailable.
- GET /devices: paginated existing variant catalog; no build-ready claims.

Authentication/session endpoints remain unchanged. Old public project catalog endpoints are retained under /legacy/catalog-projects. Cross-owner IDs return 404. Detailed generated request DTO documentation is still pending.
