# Contributing

Use Node.js 22 and pnpm 10.18.3. Follow the setup in README. Read AGENTS.md and the installed Next documentation before changing App Router code: this repository uses a newer Next build with different conventions.

Keep business logic in Nest; share boundary schemas in contracts and pure logic in utils. Keep browser state small; never store authentication tokens in localStorage. No unverified compatibility claims, invented statistics, or fabricated security badges. Label fictional data.

Run database validation, type checking, lint, meaningful tests, browser tests, and builds before proposing a change. Add migrations for schema changes. Tests should exercise behavior and authorization, not restate implementation. Never commit `.env`, credentials, generated clients, build output, or database files. Review pnpm lockfile updates.

Use small domain-focused changes and explain the user-visible behavior, validation performed, and remaining limitations. Do not deploy or provision external credentials as part of local development. See SECURITY.md before exposing any service publicly.
