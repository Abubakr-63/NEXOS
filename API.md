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

## Phase 2A project creation

- `GET /manufacturers` reads real manufacturer records.
- `GET /devices?q=...&manufacturerId=...&page=1&limit=12` searches names,
  codenames, manufacturer names, model numbers and regions. Current build support
  is UNKNOWN; `isDemo` remains explicit.
- `GET /android-bases` reads the dedicated AndroidBase source catalog. It returns
  version, repository/ref, documentation, review date and SOURCE_AVAILABLE status.
  Each entry has UNKNOWN compatibility and `buildSupported: false`. Source
  availability is never a device compatibility claim. Empty catalogs still allow
  an explicitly unconfigured draft.
- Project configuration JSON now supports optional `description` (up to 2,000
  characters). Old JSON snapshots parse with an empty description. No migration
  is required. Base IDs are stable AndroidBase record IDs; `unconfigured` is reserved for drafts.
- POST/PATCH project endpoints reject nonexistent variant and base selections.
  Unchanged legacy/deprecated selections and old base strings remain editable.
  New or changed selections must use active catalog records. The four-step
  creation UI requires an exact variant.
- GET `/projects/:id` returns device/variant/manufacturer details and the current
  fail-closed compatibility result. PATCH retains revision conflict checking and
  appends a configuration revision when project metadata is updated.

Manual check: start PostgreSQL and API using the README setup, sign in, open
`/projects/new`, enter identity, choose manufacturer/model/variant, select catalog
base metadata or Unconfigured draft, review and create. Check `/projects/:id`,
refresh, edit metadata and refresh again. `/projects` must list only this account's
projects. Curated devices and source bases remain draft-only. The advanced editor is still
accessible at `/builder/:id`; creation now opens project details instead.

Phase 2B: manufacturers and devices exclude demo/deprecated devices. Variant fields
include catalogStatus, sourceStatus, buildSupportStatus, source/evidence URLs,
hardwareVariant and reviewedAt. All builds remain NOT_VERIFIED. Old owned project
reads continue to resolve deprecated devices. See [catalog sources](docs/catalog/README.md).
