# ROMCRAFT architecture

Next.js owns presentation; NestJS owns authentication, ownership, schema validation and compatibility decisions. PostgreSQL owns persistent state. The separate BullMQ worker is not an Android compiler.

User → ROMProject → ConfigurationRevision. The project stores the current schema-versioned JSON configuration and revision number; each save atomically updates that revision and appends an immutable snapshot. Compare-and-swap returns 409 for stale writers. GET and mutation endpoints scope records by session owner. Device variants remain catalog references; drafts may reference unselected/unknown variants, but validation blocks builds.

Legacy catalog and social schema tables are retained to avoid destructive changes to existing data. Social interfaces are not exposed. Remove legacy models only through a separately reviewed migration.
