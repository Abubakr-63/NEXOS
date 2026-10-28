# Database

Apply migrations with pnpm db:migrate, then generate the client with pnpm db:generate. ROMProject has an indexed owner foreign key, JSON configuration, integer revision and timestamps. ConfigurationRevision has a project foreign key and unique (projectId, number). Both cascade on owner/project deletion. Configuration validation occurs at the API boundary; revision writes occur in one transaction. The additive ROMCRAFT migration preserves existing foundation tables.
