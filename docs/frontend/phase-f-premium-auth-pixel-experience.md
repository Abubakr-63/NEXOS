# NEXOS — Protected authentication and Pixel product experience

Reviewed: 2026-10-29. Local implementation and verification; no public deployment, Android compilation, firmware, database migration or backend security change.

## Outcome and original causes

The root layout previously wrapped every route in `Shell`, so login inherited the sidebar, workspace breadcrumb, avatar and toolbar. Workspace pages also lacked a frontend server session boundary, although NestJS continued enforcing API ownership. The earlier phone was a CSS illustration, not a realtime model.

The implementation moves Shell behind server-verified workspace layouts, gives authentication its own full-viewport composition, and replaces the illustration with an original Three.js model. The seven-scene product story and Studio adapter share the same renderer. A static fallback is identified as unavailable 3D, never presented as an Android emulator or completed engine render.

## Route architecture and authorization

| Location | Behavior |
| --- | --- |
| `app/layout.tsx` | Shared document/theme/CSS and Suspense only; no workspace shell |
| `app/(auth)/layout.tsx` | Server checks the existing session; valid users redirect to `/settings`; anonymous users receive the standalone auth experience; verification outages show an explicit unavailable state |
| `app/(auth)/login/page.tsx` | `/login`, existing email/password flow |
| `app/(auth)/register/page.tsx` | `/register`, existing username/email/password flow |
| `app/(workspace)/layout.tsx` | Verifies the session before rendering Shell; unavailable verification renders no workspace chrome |
| All `(workspace)` pages | Also call `requireWorkspaceSession` before returning their actual page components, including dynamic project/builder pages |
| `proxy.ts` | Early anonymous redirects; supplies a sanitized request path and private/no-store response policy; cookie presence is not treated as authentication |

Existing public URLs are preserved. `/` now shows the existing dashboard component after verification; anonymous `/`, `/dashboard`, `/projects`, `/projects/new`, `/builder/:id`, `/settings` and other workspace paths redirect to login. Static framework/icon/license resources remain available. `/api/v1/*` continues to delegate to the existing NestJS API contracts and authorization; public catalog/health API contracts have not been secretly changed into private endpoints.

`session-server.ts` is server-only. It reads the existing `romhub_session` HttpOnly cookie and calls NestJS `/api/v1/auth/me` with no-store, a four-second deadline, no redirect following and an explicitly configured API origin. Only the existing validated public-user response counts as authenticated. Missing/malformed/401 sessions are anonymous; 403/429/5xx/network/invalid-response failures are unavailable, never successful authentication. React cache deduplicates within a server render; no persistent/shared authentication result cache was introduced. Incoming forwarded headers are not trusted or copied to fabricate HTTPS.

Return URLs accept only known relative workspace paths and valid opaque ID characters. Schemes, protocol-relative URLs, encoded redirects, backslashes, query strings and control characters fall back to `/settings`. Deep links passed as `next` are honored on successful login. This is a bounded allowlist, not a general URL redirect facility.

Successful login/registration validates the existing response, signals the renderer's unlock state, navigates and refreshes the router cache. Navigation never waits for WebGL or an artificial success timer. Logout clears the session through the unchanged backend, then redirects/refreshes to login. A client observer rechecks real API sessions on visibility/history restoration and every sixty seconds; initial rendering is authorized by server guards, not that observer's state. Previously served content cannot be remotely erased; API access is always re-authorized, and an already-open idle view is rechecked on that bounded schedule.

Request-time authentication segments explicitly use the installed Next.js `instant = false` option, including both auth pages, so development navigation validation does not try to prerender session-dependent redirects. Authentication is never cached to satisfy instant navigation. Private navigation links disable speculative prefetch to avoid redundant session probes and backend read-throttle exhaustion. Authenticated page requests retain their server checks. The backend rate limits were not raised or bypassed.

## Dedicated auth experience

Graphite/ice-blue surfaces, transparent orbit branding, editorial typography, native labels, visible focus and separate mode copy/pacing use the existing theme tokens. Login/Register contain no Shell, breadcrumb, workspace avatar, dock or toolbar. The registration layout gives its additional fields room and uses a related but distinct palette treatment.

The shared form retains existing constraints, same-origin credential handling and error formatting. Password visibility is explicit; duplicate submits are guarded; errors are announced/focused; pending controls disable appropriately. Fields wait only for hydration, and the form has POST semantics so an early native submission cannot put credentials into a GET URL. There are no fabricated OAuth, recovery, verification or consent flows.

Desktop uses a stationary form alongside the scroll-driven product presentation. Mobile puts the usable form first and loads the scene only when its canvas intersects the viewport. The workspace's existing floating navigation, touch behavior and four-item mobile dock remain inside the protected workspace.

## Original Pixel 10 Pro model and provenance

[Official Google specifications](https://store.google.com/ca/product/pixel_10_pro_specs?hl=en-GB) confirm the 152.8 × 72.0 × 8.6 mm body and approximately 20:9 display. [Google's launch article](https://blog.google/products-and-platforms/devices/pixel/google-pixel-10-pro-xl/) and its official product image were inspected for the camera island, three lenses, flash/sensor positions, buttons and silhouette. The inspected reference image is retained only in ignored local verification files; no Google photography or commercial model is redistributed.

The model is original procedural geometry in centimeter scene units, with beveled rounded extrusion, metal frame, matte Obsidian back, front glass/bezel, centered camera, protruding horizontal pill camera bar, three optical assemblies, rear sensors, side buttons, antenna separations, port and speaker apertures. The rear arrangement is oriented correctly when viewed from behind. It is an approximate design study, not CAD, a hardware-exact replica, endorsement or a supported build device.

Meshes, PBR material definitions, studio lighting/environment, camera controller, deterministic timeline, canvas screen composition, configuration adapter and React loading/fallback boundary are separate modules. Model inspection reported 42 actual meshes. Renderer draw calls/triangles are exposed only as verification data attributes, not fake product telemetry. Directional/rim/fill lighting, environment reflections and contact shadows act on real geometry.

Three.js `0.186.1` is the sole new runtime dependency; `@types/three` `0.186.0` is development-only. Direct Three.js avoids another React rendering/animation layer while retaining the requested WebGL functionality. Fiber, Drei, GSAP and overlapping motion packages were not added. Three.js/RoomEnvironment use MIT licensing; the notice is shipped in `public/THIRD_PARTY_NOTICES.txt`. All model geometry, screen graphics and shadow textures are generated locally in code.

## Cinematic timeline and screen state

| Chapter | Implemented behavior |
| --- | --- |
| Reveal | Rear three-quarter composition, studio-light interpolation, boot/welcome concept |
| Device | Real rotation/camera reframing toward the display; manual front/rear/angle and bounded zoom |
| Your Android | NEXOS clock/widget/home concept, moving original wallpaper and palette changes |
| Applications | Animated app membership/grid reflow and a conceptual drawer panel; Calendar addition/removal |
| Performance | Camera turn and actual preset-intent display; no benchmarks, CPU telemetry or kernel performance claim |
| Security | Camera/display transition describing real account/ownership/build gates; no invented Titan/hardware/ROM security |
| Create your ROM | Configuration summary and existing draft-creation action; anonymous visitors are directed to registration |

A pure seekable Hermite-interpolated timeline controls camera, device angles and key-light intensity. Normal document scrolling drives the same normalized timeline forward/reverse. Chapter buttons and a native range provide non-scroll access. Manual input stops the brief opening sequence; optional Play/Pause/Replay remains user-controlled. Angle changes choose the shortest rotation. No wheel/touch event is prevented or hijacked, and forms retain native scrolling.

The display is a 480 × 1066 canvas texture clipped by the screen geometry. It redraws original UI, interpolates app layout and crossfades palette/scene changes without rebuilding meshes. It includes welcome, lock/home, application-panel and review compositions. Unlock depends only on confirmed authentication; a failed login cannot unlock it. The graphics are visibly conceptual, not Android boot, an emulator or compiled firmware.

## Existing Studio integration

The ten stages, saves, revisions, undo, JSON export, selected devices/bases and unavailable-build controls are preserved. A compact instance of the same renderer replaces the old CSS preview. `configurationToScreen` reads the real name, accent, darkMode, app membership and preset; Calendar selection updates the actual canvas. An accessible text summary accompanies it. Review briefly shows the rear and returns to the front/summary, without blocking editing or claiming a build.

There is no wallpaper-preset field or arbitrary home-screen-position contract today. The existing accent drives the original wallpaper palette; app selection drives deterministic grid reflow. New persistent wallpaper presets, drag-position data and other unsupported fields were not invented. Auth-only demonstration selections are explicitly NOT SAVED. Kernel remains unconfigured, compatibility unverified and compilation unavailable.

## Accessibility, performance and lifecycle

- Native forms, associated unique IDs, autofill hints, error alerts, keyboard controls, native sliders and visible focus. Workspace/auth main landmarks have distinct IDs for cached navigation.
- Automated WCAG A/AA checks for both auth routes in both themes and the existing dashboard; keyboard traversal and reduced-motion checks. This is not a manual screen-reader certification.
- Reduced motion uses static poses, disables automatic playback and keeps chapter/view controls available. Authentication never depends on animation completion.
- Engine imports are client-only, asynchronous and deferred to idle/visibility. No external textures/models/fonts are requested. Pixel ratio is capped and adjusted on resize.
- Render invalidation is bounded; background/offscreen canvases stop drawing. No React state is set every animation frame for geometry. Screen updates reuse the texture and geometry.
- Resize/intersection/visibility listeners, RAF work, geometries, materials, textures, lighting targets and renderer resources are disposed. Normal cleanup preserves a cached canvas's context for Next Activity restoration; explicit context loss switches safely to fallback.
- WebGL denial/context loss leave the account form and semantic Studio controls usable. Mobile does not inherit the workspace dock on auth pages; it retains the dock inside authenticated pages.

Measured in local headless Chromium at 1440 × 1000 with software WebGL, a warm server and shared HTTP cache; one observation per route, not a hardware GPU benchmark:

| Mode / route | TTFB | DOMContentLoaded | Form ready, observed | First 3D frame, observed |
| --- | --- | --- | --- | --- |
| Production `/login` | 129 ms | 356 ms | 439 ms | 2,298 ms |
| Production `/register` | 10 ms | 127 ms | 158 ms | 2,059 ms |
| Development `/login` | 70 ms | 180 ms | 544 ms | 2,902 ms |
| Development `/register` | 164 ms | 273 ms | 376 ms | 2,628 ms |

Both routes rendered 42 meshes, 74 draw calls and 18,574 triangles in this observation, with zero runtime/console errors. Production navigation resource entries reported 392,682 encoded script bytes each; this is an observed transfer/resource statistic, not the complete installed bundle size. Development cache differences make script transfer comparisons misleading. These measurements precede the final request-time navigation-validation declarations; renderer/form code is unchanged. No FPS, Lighthouse score or physical-device performance result is claimed.

Screenshots captured and visually inspected include `.local/premium-pixel-rear-desktop.png`, `premium-pixel-front-desktop.png`, `premium-pixel-calendar-light.png` and `premium-login-mobile.png`. They show the shell-free form, real front/rear geometry, light Calendar display and mobile form-first composition. The complete official Google reference was also inspected. Local images are verification artifacts, not redistributed production assets.

## Verification and data preservation

| Executed command/check | Result |
| --- | --- |
| `pnpm typecheck` | All 7 tasks passed |
| `pnpm lint` | All 7 tasks passed |
| `pnpm test` | 65 passed; 0 failed/skipped |
| `pnpm test:integration` | 23 passed; 0 failed/skipped; real local PostgreSQL/Redis |
| `PLAYWRIGHT_API_PORT=4200 pnpm test:e2e` | 14 passed in approximately 1.3 minutes |
| Final graphics regression run with isolated API port 4300 | 3 passed: real meshes/timeline, reduced motion/context loss, WebGL denial/mobile |
| `API_ORIGIN=http://localhost:4200 pnpm --filter @rom-hub/web build` | Passed; final route configuration rebuilt |
| Full dependency audit | Zero advisories, 644 dependencies |
| Production dependency audit | Zero advisories, 268 dependencies |
| `git diff --check` | Passed |

The full E2E run covers real registration/login/logout, duplicate/incorrect authentication, session refresh/revocation/expiry, protected-route redirects, return-path validation, existing project save/reload, all ten Studio stages, undo/export, actual Calendar-to-canvas binding, disabled unsupported builds, desktop/mobile layouts, keyboard access, automated accessibility checks and graphics fallback. The final focused graphics rerun followed the shadow-map and effect cleanup adjustments. TypeScript/lint/build were repeated after the final Next.js route-validation declarations; the complete functional suites were run before that configuration-only change.

Test accounts are isolated synthetic fixtures, not real user credentials. Existing backend/worker/Prisma sources were compared against 22 pre-task file fingerprints. All 28 PostgreSQL model count/digests matched the baseline after the test runs and fixture cleanup, before restarting the interactive live application. The live application subsequently received interactive account/authentication/logout activity. A final read-only comparison found changes in `user`, `session` and `auditLog`; the other 25 model digests still matched. Therefore whole-database equality is verified at the post-test checkpoint, not claimed through subsequent interactive use. Those live changes were preserved rather than undone to manufacture end-of-session hash equality. No schema, migration, seed or reset was performed.

The environment file remains byte-identical and ignored/untracked. A scanner checked the existing HMAC key, database URL and database password against nonignored repository files, verification logs and client static assets: zero matches. Values were never printed or rotated.

Local infrastructure was restored with the existing PostgreSQL data directory and existing Redis container, without initialization or queue deletion. The interactive development application is available at `http://localhost:4000/login`, backed by API port 4200. The commands used are `PORT=4200 WEB_ORIGIN=http://localhost:4000 pnpm --filter @rom-hub/api start` and `API_ORIGIN=http://localhost:4200 pnpm --filter @rom-hub/web dev --port 4000`. The temporary production profiling server on port 3100 was stopped.

All five checkpoints have implemented and executed coverage: protected auth separation; real procedural model; seekable/scroll-driven timeline; supported Studio bindings; responsive/accessibility/fallback/performance verification. Production infrastructure and physical GPU/device validation remain separate follow-up work.

## Exact files changed

Routes moved without changing their URLs: `app/page.tsx`, `dashboard/page.tsx`, `projects/page.tsx`, `projects/new/page.tsx`, `projects/[slug]/page.tsx`, `builder/[id]/page.tsx`, `settings/page.tsx`, and `[section]/page.tsx` now live beneath `app/(workspace)/`.

Other implementation files:

- `apps/web/app/layout.tsx`, `app/loading.tsx`, `(workspace)/layout.tsx`, `(workspace)/error.tsx`, `(auth)/layout.tsx`, `(auth)/login/page.tsx`, `(auth)/register/page.tsx`.
- `apps/web/proxy.ts`; `lib/session-server.ts`, `lib/session-lookup.ts`, `lib/return-path.ts`, `lib/account-api.ts`.
- `components/auth/auth-routes.tsx`, `auth-screen.tsx`, `auth-shell.tsx`, `auth.css`, `session-unavailable.tsx`.
- `components/workspace-session.tsx`, `components/account.tsx`, `components/shell.tsx`, `components/design-system.tsx`, `components/studio.tsx`.
- `components/pixel/adapter.ts`, `timeline.ts`, `model.ts`, `materials.ts`, `lighting.ts`, `screen.ts`, `engine.ts`, `pixel-experience.tsx`, `pixel.css`.
- `apps/web/package.json`, `apps/web/public/THIRD_PARTY_NOTICES.txt`, `pnpm-lock.yaml`.
- `playwright.config.ts`; `tests/frontend-session.test.ts`, `tests/pixel-timeline.test.ts`; `tests/e2e/auth-experience.spec.ts`, `protected-routes.spec.ts`, `pixel-experience.spec.ts`, `workspace-fixture.ts`, `foundation.spec.ts`.
- This report and the supersession note in `nexos-premium-experience-design-spec.md`.

Earlier backend/security/build work in the dirty tree was preserved. No NestJS/worker source, Prisma schema/migration, authentication contract, build eligibility or existing project data was changed by this frontend implementation.

## Limitations and deployment

The model is original approximate geometry rather than a scanned/CAD asset. Phone materials depend on the browser/GPU; no hardware-accuracy, measured OS performance, installed apps or build-support claim is made. Physical vendor/browser testing and production profiling remain follow-up work. No new wallpaper/layout persistence contract was authorized.

Production must preserve the existing HTTPS, trusted-proxy, cookie, database and Redis requirements. Configure API_ORIGIN to the actual trusted API origin; server-side verification deliberately fails closed when it is wrong or unavailable. Local results do not authorize public production deployment.

The five implementation checkpoints are reported against executed evidence below. No Android build phase or unrelated feature work began.
