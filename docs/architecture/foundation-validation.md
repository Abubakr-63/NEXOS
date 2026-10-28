# Foundation validation — 2026-10-27

Validated on Linux with Node.js 22.23.1, pnpm 10.18.3, a temporary local PostgreSQL cluster on port 55432, and Chromium headless.

| Check                                           | Result                                         |
| ----------------------------------------------- | ---------------------------------------------- |
| Frozen lockfile / offline installation          | Passed                                         |
| Prisma schema validation and client generation  | Passed                                         |
| Migration deployment to a second empty database | Passed                                         |
| Seed applied twice                              | Passed, repeatable                             |
| Strict TypeScript, including test sources       | Passed                                         |
| Web ESLint and package compiler checks          | Passed                                         |
| Unit tests                                      | 5 passed                                       |
| Database-backed API integration suite           | Passed                                         |
| Production builds                               | Web, API, worker and shared packages passed    |
| Browser tests                                   | 4 passed                                       |
| Automated WCAG A/AA checks                      | No violations on overview in dark/light themes |
| Mobile layout                                   | 390px navigation/overflow check passed         |
| API development-mode startup                    | Health endpoint passed                         |
| Diff whitespace check                           | Passed                                         |

API integration covers registration validation, password authentication, token digest storage, cookie flags, presented-session rotation, session ownership/revocation, logout, unauthenticated access, admin rejection, origin rejection, bounded catalog filters, missing projects, and OpenAPI availability. Browser tests cover project discovery filters, command search, detail navigation, theme persistence, mobile navigation, and registration/logout through the Next proxy.

Docker was unavailable, so Compose services were not launched. Redis was also unavailable: the worker was compiled but not exercised against Redis. Optional storage/search, real upload verification, email/OAuth, live frontend catalog integration, community, manual assistive-technology tests, and production monitoring/hardening remain incomplete. No full Phase 2 completion or production readiness is claimed.

Temporary test services were stopped after validation. See README for normal local setup. pnpm was installed in the user's local prefix because system-wide installation required unavailable permissions.
