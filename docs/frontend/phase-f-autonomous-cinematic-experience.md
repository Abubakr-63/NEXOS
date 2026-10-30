# NEXOS — Autonomous cinematic UX correction

Date: 2026-10-30. Local implementation; no public deployment or Android compilation.

## Implementation and page architecture

This corrects the existing protected-auth/Pixel implementation. The previous manual viewer UI and scroll-driven camera have been removed: no Front/Rear/Angle, orbit, zoom, scene buttons, timeline slider, Play/Pause/Replay or demo-setting controls are rendered anywhere by the shared preview. Scrolling is ordinary document scrolling.

Login and Register remain dedicated public routes, outside Shell. `AuthRoutes` now owns the shared `AuthShell` and its persistent `PixelExperience`; only the form is keyed by mode. Existing input constraints, API validation, pending/error state, password visibility, return-path validation and backend-confirmed authentication are preserved. The existing scene is reframed when switching forms. A browser test marks the canvas and verifies the identical DOM canvas survives both transitions.

The Login sequence reveals the rear, turns to the front, demonstrates original NEXOS interface concepts, applications and configuration intent, then settles. Register starts with the display and assembly/customization narrative rather than repeating the rear reveal. Both have a finite automatic sequence. Form interaction never waits for animation. Backend success alone signals unlock, followed immediately by existing router navigation; completing an unlock animation is deliberately not a navigation prerequisite. Failed/malformed authentication responses cannot signal success.

All workspace HTML retains server session checks. `/profile` and `/help` use the same guard and request-time Next.js segment policy. No API routes or authentication contracts were changed.

## Reusable animation system

The existing geometry, screen renderer, lighting, engine and configuration adapter are reused. New `pixel/orchestrator.ts` supplies deterministic mode-specific choreography, semantic configuration diffing and a replaceable animation clock.

| Actual event                      | Preview reaction                                                                                                                   |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Login page / Register mode        | Distinct finite automatic sequence; return to a front resting composition                                                          |
| Confirmed authentication          | Update actual unlock state; navigation remains immediate                                                                           |
| Calendar enabled/removed          | Front screen composition, bounded 1.15× camera focus, existing canvas grid interpolation, Calendar confirmation, return to 1× rest |
| Other application changes         | Latest app membership/grid; front focus then rest                                                                                  |
| Accent / dark appearance          | Existing smooth texture/palette transition; no camera manipulation UI                                                              |
| Identity typing                   | Update actual display text without repeated camera movement                                                                        |
| Preset preference                 | Factual preset card and brief automatic framing; no performance measurements                                                       |
| Enter Review                      | Rear/front automatic fly-around, existing actual draft information and return to rest                                              |
| Leave Review                      | Cancel obsolete camera work and restore resting pose                                                                               |
| Hidden/offscreen / reduced motion | Cancel/pause animation work, static accessible composition; no perpetual RAF idle                                                  |

There is one replaceable clock per preview, not independent delayed completion timers. New meaningful configuration changes cancel obsolete choreography; the latest configuration reaches the texture independently of animation completion. Name typing does not restart camera sequences. A unit test exercises cancellation and hidden-page pause/resume without elapsed-time jumps. Rapid Calendar changes are exercised in the real saved-project E2E flow.

The renderer remains lazily imported on visibility/idle, capped at DPR 1–1.5, and stops when hidden/offscreen or settled. Existing disposal covers geometry, materials, textures, environment/shadow targets, renderer and observers. Context loss/denial leaves forms and configuration editing usable. Reduced motion removes automatic cinematic movement. No audio, external model requests or new animation/rendering dependencies were added.

## Geometry, lighting and accuracy

The existing original approximate Pixel 10 Pro geometry is retained for the public product story. Rear key/fill/rim illumination, frame environment reflections, glass roughness and exposure were adjusted so the dark body and camera bar remain visible. Reveal framing was corrected after inspecting the actual rendered screenshot to keep the lower edge inside the composition.

The reference provenance remains the official [Google specifications](https://store.google.com/ca/product/pixel_10_pro_specs?hl=en-GB) and [Google launch article](https://blog.google/products-and-platforms/devices/pixel/google-pixel-10-pro-xl/), previously inspected for proportions and camera arrangement. This is an original approximate model, not CAD or a claim of exact hardware fidelity. Materials vary with browser/GPU.

Workspace previews explicitly use a generic geometry variant: Pixel rear camera island/lens assembly and Google rear letter are absent. The label says it is not a model of the selected device. No selected Redmi, Samsung, OnePlus or other device is falsely represented as a Pixel. Project/base selections update honest descriptive context rather than inventing that vendor's OS visuals or compatibility. The renderer and original screen remain shared. Three.js/RoomEnvironment MIT notices are unchanged; no third-party commercial model or Google photography is shipped.

## Create ROM and ten-stage Studio

The four existing creation steps, validation, device/base catalog, exact-variant requirements, save operation and build warnings are preserved. The former right summary card is replaced by a larger generic conceptual display and a compact “Draft configuration · Cloud compilation unavailable” notice. Name, selected variant/base descriptions and review state drive the existing preview; selecting a base does not claim to reproduce authentic AOSP/LineageOS UI.

Desktop grids reserve a meaningful preview column, intermediate widths put it below the form, and narrow screens use one column with capped preview height. The ten-stage Studio uses the same responsive sizing and actual config adapter. Calendar, appearance, identity, apps and preset inputs remain authoritative, with save/revision/undo/export and unavailable-build behavior retained.

There is no persisted wallpaper selection field, arbitrary icon-position contract or compatible kernel selector in the current product. Existing accent changes crossfade the original wallpaper palette; independent wallpaper selection was not fabricated. Kernel remains explicitly unconfigured and compatibility unverified. Adding those persistent capabilities requires a separate approved contract/product phase.

## Profile versus Settings

`/profile` is a real identity/project presentation: authenticated username, initials, role, existing email-verification state, recent saved projects/revision/edit date, selectable recent-project concept preview and empty state. The current public-user response does not expose email address or account creation date; neither is invented or obtained through a backend change. No total-project count or activity graph is fabricated.

Settings retains account/session management, session revocation and logout. Username is visibly read-only, email verification is accurately labelled, and unavailable account-edit/password-change/verification capabilities are stated. Browser theme preference still uses the existing sidebar theme control. Project statistics and profile preview do not appear in Settings.

## Overview versus My Projects

Root and `/dashboard` now render a personalized welcome, Create ROM action, Continue last project, latest saved-draft information, honest readiness summary and recent cards. The existing legacy project listing is ordered by `updatedAt` and returns up to 100; Overview/Profile select a small recent subset of that response. They never describe subset length as the account's total.

`/projects` is a dedicated library using the existing opt-in cursor contract, 20 records at a time with Load more. Search and sorting are explicitly labelled as operating on loaded projects; no backend filtering/search endpoint was invented. Empty, failed-load/retry and malformed persisted-config states are handled. Cursor pagination has stable creation ordering; “Recently edited” is a client sort over loaded rows, not an inaccurate global sorting claim.

## Sidebar

Profile links to the protected `/profile`, including mobile More navigation. The redundant bottom account card is replaced with Help & documentation using Lucide BookOpen and the existing expanding-row styles. `/help` contains accurate instructions for existing creation, editing, previews and account/session features; mobile More also links to it. The topbar avatar uses the authenticated user's initial. Existing hover/focus expansion, touch toggle, mobile dock and themes are preserved.

## Browser verification and results

| Executed verification                         | Exact result                                                                   |
| --------------------------------------------- | ------------------------------------------------------------------------------ |
| `pnpm typecheck`                              | All 7 tasks passed; root tests included                                        |
| `pnpm lint`                                   | All 7 tasks passed                                                             |
| `pnpm test`                                   | 67 passed, 0 failed/skipped                                                    |
| `pnpm test:integration`                       | 23 passed, 0 failed/skipped; real PostgreSQL/Redis, approximately 55.6 seconds |
| `PLAYWRIGHT_API_PORT=4300 pnpm test:e2e`      | 15 passed, approximately 1.9 minutes                                           |
| `API_ORIGIN=http://localhost:4200 pnpm build` | All 7 production build tasks passed                                            |
| `pnpm audit --json`                           | Zero advisories; 644 dependencies                                              |
| `pnpm audit --prod --json`                    | Zero advisories; 268 dependencies                                              |
| `git diff --check`                            | Passed                                                                         |

A final focused rerun of `registration, session listing` passed (1 test, 36.0 seconds) after adding an explicit assertion that the reactive camera returns below 1.005× zoom following rapid Calendar changes. The production build was then regenerated for API port 4200.

The initial E2E run had one failure: the shared outer auth container no longer reflected pending submission. Restoring form-to-layout visual-state reporting fixed it; the complete repeated run passed all 15 tests. A root TypeScript import-resolution error in the new test was also corrected before the final checks. No failing intermediate run is counted as a passing result.

Executed coverage includes pending/failed/malformed authentication, real login/register/logout and session revocation/expiry, protected HTML, keyboard traversal and automated WCAG A/AA checks on both auth themes and Overview, desktop/mobile overflow, actual mesh rendering, automatic progression and settling, persistent canvas across both mode transitions, reduced motion, context loss/WebGL denial, four-step creation and ten-stage editing/save/reload/undo/export, Calendar add/remove/rapid replacement, real Profile/Overview/library data and Help routing. New tests use only synthetic accounts and clean their own fixtures. The browser tests do not use real user credentials. Existing integration coverage continues testing security and orchestration behavior without backend changes.

The final interactive checks returned API `/api/v1/ready` 200, `/login` 200 and anonymous `/profile` and `/` 307 redirects. API and development web processes were already listening when duplicate startup attempts were made; those attempts failed with EADDRINUSE. The existing listeners were retained, with no process killed or port silently changed. The working application remains `http://localhost:4000/login`, API port 4200.

Screenshots are local ignored verification artifacts, not production assets:

- `.local/autonomous-login-rear.png`, `autonomous-login-front.png`, `autonomous-register.png`: automatic scene and persistent form-mode transition.
- `.local/autonomous-login-mobile.png`: usable form-first mobile view without workspace chrome.
- `.local/autonomous-studio-calendar.png`: real Calendar checkbox, rendered icon grid and generic-model label.
- `.local/autonomous-create-desktop.png`, `autonomous-create-mobile.png`: meaningful wizard preview and responsive flow.
- `.local/autonomous-profile-desktop.png`, `autonomous-overview-desktop.png`, `autonomous-library-desktop.png`: distinct real-data page responsibilities.

The desktop rear/front, Register, Profile, Calendar Studio, Overview, library and desktop/mobile creation screenshots were opened and visually inspected. Rear framing now includes the lower rounded edge; the dark rear, frame and lens bar are distinguishable. Auth has no workspace chrome; the profile and library use different layouts; the creation preview stays below the form on mobile. Screenshot evidence is from the executed Chromium tests, not a static mockup. Software WebGL testing does not establish physical-device GPU performance or exact hardware fidelity.

## Modified files in this correction

- `apps/web/components/pixel/pixel-experience.tsx`, `orchestrator.ts` (new), `engine.ts`, `model.ts`, `materials.ts`, `lighting.ts`, `timeline.ts`, `pixel.css`.
- `apps/web/components/auth/auth-routes.tsx`, `auth-screen.tsx`, `auth-shell.tsx`.
- `apps/web/components/project-creation.tsx`, `studio.tsx`, `account.tsx`, `shell.tsx`.
- `apps/web/components/workspace-pages.tsx`, `workspace-pages.css` (new).
- `apps/web/app/(workspace)/page.tsx`, `dashboard/page.tsx`, `layout.tsx`, `profile/page.tsx` (new), `help/page.tsx` (new).
- `apps/web/lib/return-path.ts` (allowlisted protected Profile/Help return paths).
- `tests/pixel-timeline.test.ts`, `tests/e2e/pixel-experience.spec.ts`, `foundation.spec.ts`, `workspace-experience.spec.ts` (new).
- This report. Earlier dirty-tree backend/catalog/security/build work was preserved.

No package/dependency versions, NestJS/worker code, database schema, existing secrets, eligibility decisions or authentication semantics were changed in this correction.

## Preservation and limitations

All 22 pre-task backend/worker/Prisma source fingerprints remain identical. The environment file remains byte-identical, ignored and untracked. The existing HMAC secret was not rotated. A scanner checked configured secret values against nonignored repository files, verification logs and client static assets: zero matches; no values were printed.

A read-only baseline covered all 28 PostgreSQL models before this correction. At final comparison, 24 digests matched and four differed: `session` (0 → 1), `auditLog` (3 → 4), `rOMProject` (2 → 2) and `configurationRevision` (7 → 8). User and device/catalog model digests matched. There were zero remaining synthetic workspace/browser users or projects owned by those fixtures. These results are consistent with interactive login and a saved revision during the intervening live session, but full existing-record equality cannot be proved from the aggregate digests. Accordingly it is not claimed. No existing records were reset, deleted, rewritten or rolled back to force a digest match; test writes target their own newly created fixtures.

On resuming the task, PostgreSQL and the existing Redis container were stopped. PostgreSQL was started only after checking the existing `PG_VERSION`; the same Redis container was started. A real database connection and API readiness were then verified. No initialization, migration, seeding, storage reset, Redis flush or queue deletion was performed.

This is browser/software-WebGL verification, not physical mobile GPU certification or a public-production readiness assessment. No Android ROM was built or flashed. Generic workspace visualization remains conceptual. The prior report's manual viewer/scroll controls describe historical behavior and are superseded by this correction.
