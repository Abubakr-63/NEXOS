# ROMCRAFT

A no-code Android configuration studio built on the existing Next.js / NestJS / Prisma monorepo.

**Implemented slice:** responsive dark/light shell, project creation, authenticated database persistence, optimistic revision checks, JSON import/export, undo, appearance preview, application-role and preset intentions, and server-side fail-closed compatibility checks. Existing cookie authentication and session management are retained.

**Unavailable:** real Android compilation, verified device support, APK uploads/scanning, executable presets, email verification/reset delivery, autosave, redo, revision restoration, and installation guides. No artifacts or successful builds are simulated. Save drafts explicitly. This is not production-ready.

## Setup — Fedora / Linux

Use Node.js 22+, pnpm 10.18.3 and the native PostgreSQL tools. On Fedora, if the
binaries are missing, install them yourself:

```sh
sudo dnf install postgresql-server postgresql
```

The recommended local setup uses a persistent repository-owned PostgreSQL cluster
in ignored `.local/postgres/data`, bound to `127.0.0.1:5433`. It does not initialize,
change or restart the system PostgreSQL service on port 5432. Run from the root:

```sh
pnpm install --frozen-lockfile
pnpm db:local:start
pnpm db:generate
pnpm --filter @rom-hub/contracts build
pnpm db:migrate
pnpm db:seed
pnpm db:status
```

`db:local:start` generates random SCRAM credentials and creates a non-superuser
application role. It creates ignored `.env` with mode 0600, never prints credentials,
and verifies a real database connection. It refuses to overwrite existing settings
or delete an incomplete cluster. Do not copy `.env.example` before this helper.

Start the existing services in two terminals:

```sh
pnpm dev:api
```

```sh
pnpm dev:web
```

After a reboot, run `pnpm db:local:start` again before starting the API. Check or stop
only this repository's database with `pnpm db:local:status` / `pnpm db:local:stop`.
Stopping preserves data and credentials. Keep `.env` with the matching cluster.
Redis is not required for authentication, catalogs or project persistence.

### Existing PostgreSQL or Docker Compose

If you already have an application database, copy `.env.example` to `.env` only if
no `.env` exists, then set DATABASE_URL to that database's URL with its URL-encoded
password. Set WEB_ORIGIN to the exact browser origin and API_ORIGIN to the server
address. Run the generate/migrate/status commands above; do not use db:local:start
for an externally managed server.

For Docker Compose, configure your own POSTGRES_PASSWORD and matching DATABASE_URL,
then run `docker compose --env-file .env -f infrastructure/docker/compose.yaml up -d
postgres`. The Compose database uses port 5432, so check for an existing system
server first. Compose requires an explicit password; no default password is provided.

For a Fedora system database, an administrator can create a dedicated role using
`sudo -u postgres createuser --pwprompt --no-superuser --no-createdb --no-createrole
romcraft` and database using `sudo -u postgres createdb --owner=romcraft romcraft`.
If TCP authentication uses ident, configure a narrow `host romcraft romcraft
127.0.0.1/32 scram-sha-256` rule before broader rules in pg_hba.conf and reload the
service. Never reinitialize an existing system database. The repository-local helper
avoids requiring these administrator changes.

## Setup — Windows

Use Node.js 22+, pnpm, and Docker Desktop with Linux containers. WSL2 can use the Linux instructions. In PowerShell:

```powershell
pnpm install --frozen-lockfile
Copy-Item .env.example .env
# Edit .env: supply DATABASE_URL and a generated POSTGRES_PASSWORD for Compose.
Get-Content .env | ForEach-Object {
  if ($_ -match '^([A-Z_]+)=(.*)$') {
    [Environment]::SetEnvironmentVariable($matches[1], $matches[2], 'Process')
  }
}
docker compose --env-file .env -f infrastructure/docker/compose.yaml up -d
pnpm db:generate
pnpm --filter @rom-hub/contracts build
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Root `.env` is now loaded automatically by dev/start scripts and root database/test
commands. Explicit shell/CI variables take precedence; app-local `.env` overrides
root file values. API_ORIGIN and DATABASE_URL remain server-side and are never
exposed as NEXT_PUBLIC variables. The API validates configuration, checks database
access and required tables at startup, and reports missing migrations without
logging connection secrets.

Web: http://localhost:3000; API: http://localhost:4000/api/v1/health; database readiness:
http://localhost:4000/api/v1/ready; OpenAPI: http://localhost:4000/api/docs. Next proxies
`/api/v1` to API_ORIGIN, including HttpOnly session cookies. Keep WEB_ORIGIN equal
to the exact browser origin (localhost and 127.0.0.1 are different origins).
Register your own account; no privileged account is seeded. Database seeding provides
7 real devices / 11 source-backed variants and 2 source-only Android bases. All builds
remain NOT_VERIFIED. Prior demo records are retained as deprecated for existing
projects and excluded from new selection. See [catalog evidence](docs/catalog/README.md).

Optional storage/search: `docker compose -f infrastructure/docker/compose.yaml --profile extended up -d`. These services are configuration only and are not integrated into upload/search workflows yet. Legacy demo devices are deprecated; no catalog entry has a verified ROMCRAFT build.

## Validation

```sh
pnpm db:validate
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm test:integration  # requires migrated PostgreSQL; starts an isolated API on 4101
pnpm exec playwright install chromium
pnpm test:e2e          # requires a build, PostgreSQL, and free ports 3100/4000
```

`pnpm dev` runs web, API, and worker, loading root environment settings. A running Redis is required for the worker. For just the web preview use `pnpm --filter @rom-hub/web dev`. Build first before using individual production start scripts. The API needs a generated Prisma client and built contracts package.

See [ARCHITECTURE.md](ARCHITECTURE.md), [DATABASE.md](DATABASE.md), [API.md](API.md), [SECURITY.md](SECURITY.md), [ROADMAP.md](ROADMAP.md), and [CONTRIBUTING.md](CONTRIBUTING.md). No release upload, email, OAuth provider, analytics, community, or deployment is silently simulated.

Browser tests cover the visual editor, JSON export, mobile layout, automated WCAG A/AA checks, and registration/project persistence/validation/logout through the Next proxy. Automated accessibility checks do not replace manual assistive-technology testing.

## Styling pipeline

The web app uses Tailwind CSS v4 through `apps/web/postcss.config.mjs` and imports
`app/globals.css` once in the root layout. Do not add a second Tailwind loader to
`next.config.ts`. Turborepo excludes `.next/dev/**` from production build outputs
so cached builds cannot restore stale development styles.

Run `pnpm exec playwright test --config playwright.styles.config.ts` after building
for CSS regression checks without a database. To check a running dev server, set
`STYLE_TEST_URL=http://localhost:3000` for that command. Tests check actual computed
styles, responsive navigation, light/dark themes, and compiled stylesheet contents.
