# ROMCRAFT

A no-code Android configuration studio built on the existing Next.js / NestJS / Prisma monorepo.

**Implemented slice:** responsive dark/light shell, project creation, authenticated database persistence, optimistic revision checks, JSON import/export, undo, appearance preview, application-role and preset intentions, and server-side fail-closed compatibility checks. Existing cookie authentication and session management are retained.

**Unavailable:** real Android compilation, verified device support, APK uploads/scanning, executable presets, email verification/reset delivery, autosave, redo, revision restoration, and installation guides. No artifacts or successful builds are simulated. Save drafts explicitly. This is not production-ready.

## Setup — Linux

Install Node.js 22+, pnpm 10.18.3 (`npm install -g pnpm@10.18.3`), and Docker with Compose. From the repository root:

```sh
pnpm install --frozen-lockfile
cp .env.example .env
set -a
. ./.env
set +a
docker compose -f infrastructure/docker/compose.yaml up -d
pnpm db:generate
pnpm --filter @rom-hub/contracts build
pnpm db:migrate
pnpm db:seed
pnpm dev
```

## Setup — Windows

Use Node.js 22+, pnpm, and Docker Desktop with Linux containers. WSL2 can use the Linux instructions. In PowerShell:

```powershell
pnpm install --frozen-lockfile
Copy-Item .env.example .env
Get-Content .env | ForEach-Object {
  if ($_ -match '^([A-Z_]+)=(.*)$') {
    [Environment]::SetEnvironmentVariable($matches[1], $matches[2], 'Process')
  }
}
docker compose -f infrastructure/docker/compose.yaml up -d
pnpm db:generate
pnpm --filter @rom-hub/contracts build
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Environment variables must be exported into the process: the root `.env` is not automatically loaded by every workspace tool. `.env.example` files describe each app's configuration. Web: http://localhost:3000; API: http://localhost:4000/api/v1/health; OpenAPI: http://localhost:4000/api/docs. Keep WEB_ORIGIN equal to the exact browser origin for authentication. Next proxies `/api/v1` to API_ORIGIN. Register your own development account; no default privileged user is seeded.

Optional storage/search: `docker compose -f infrastructure/docker/compose.yaml --profile extended up -d`. These services are configuration only and are not integrated into upload/search workflows yet. Demo data is fictional and never suitable for flashing hardware.

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

`pnpm dev` runs web, API, and worker. A running Redis is required for the worker. For just the web preview use `pnpm --filter @rom-hub/web dev`. Build first before using individual production start scripts. The API needs a generated Prisma client and built contracts package.

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
