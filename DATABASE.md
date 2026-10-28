# Database

Apply migrations with pnpm db:migrate, then generate the client with pnpm db:generate. ROMProject has an indexed owner foreign key, JSON configuration, integer revision and timestamps. ConfigurationRevision has a project foreign key and unique (projectId, number). Both cascade on owner/project deletion. Configuration validation occurs at the API boundary; revision writes occur in one transaction. The additive ROMCRAFT migration preserves existing foundation tables.

## Phase 2B catalog provenance

The additive `20261028160000_real_catalog` migration adds Device.deprecatedAt,
DeviceVariant identity/source/build status, review date, hardware description,
source links and notes, plus a dedicated AndroidBase source catalog. Existing
records default to UNVERIFIED / UNREVIEWED / NOT_VERIFIED. AndroidBase entries do
not have automatic device compatibility relations. BuildSupportStatus intentionally
contains only NOT_VERIFIED until an evidence-bearing build pipeline exists.

Catalog seed updates are transactional and idempotent. Known demos are retained and
deprecated. User/project/revision rows and ProjectDevice references are not changed.
See [source ledger and preservation policy](docs/catalog/README.md).
