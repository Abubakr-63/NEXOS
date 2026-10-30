# NEXOS premium frontend experience — F1–F4 design specification

Historical planning document. The subsequent Premium Experience Rebuild authorizes and supersedes these checkpoint limits; see [the implementation report](phase-f-premium-auth-pixel-experience.md) for actual current behavior and verification.

Date: 2026-10-29. Product direction: **NEXOS — Android, reimagined.** This document describes the full vision; only F1 is authorized and implemented in this change. F2–F4 require separate approval. Public deployment and Android compilation remain outside this frontend work.

## Product and implementation baseline

The existing frontend is Next.js 16.4.3 App Router / React 19.3.0, Tailwind 4.3.3 with scoped presentation CSS, Lucide icons, and an Inter/system font stack. There is no existing Motion/Three.js/Fiber/Drei dependency. Installed Next.js layout, client-boundary and router guidance was reviewed before implementation.

The animated desktop rail, touch toggle, four-item mobile dock, dark/light themes, existing dashboard and project flows define the product language. Authentication uses same-origin `/api/v1/auth/*` calls through the existing Next rewrite, server-owned HttpOnly session cookies, and the existing `/settings` success destination. There is no supported OAuth, password recovery or verification flow to link to.

`project-creation.tsx` is the existing four-step creation wizard. `studio.tsx` contains the ten-stage editor: Device, Android Base, ROM Identity, Appearance, Applications, Performance, Kernel, Advanced Options, Installation, Review & Build. Its draft schema is version 1; save/revision/ownership behavior and the disabled build gate remain authoritative.

## Visual system

Retain the existing tokens: graphite background `#0B0E14`, surface `#131823`, ice-blue accent `#8CD5FF`, muted `#A1ACBF`, text `#EDF2FA`; inherit matching light-theme tokens. Do not override global theme variables to style authentication. Use rounded panel edges, a thin translucent border, restrained radial lighting and generous space around form controls. The original cyan orbit mark remains transparent and unchanged.

Typography has a clear hierarchy: tightly spaced editorial headings, quiet uppercase section labels, readable form labels/body copy, and concise explanatory text. Inherit the existing local/system font stack; do not add remote fonts or claim an Inter font file is bundled. Contrast is more important than low-opacity decoration.

Motion follows causality: hover/focus acknowledges an action; field feedback reflects local validity; authenticated success follows a confirmed backend response; preview changes reflect actual draft values. Avoid ambient constant spinning, required playback, deceptive progress and simulated build success. Reduced-motion users receive immediate state changes and usable controls.

## F1 — Dedicated authentication (implemented)

Separate `/login` and `/register` routes share an AuthShell and AuthScreen. The desktop composition puts the focused form on one side and an original static Android concept on the other. At tablet/mobile widths the decorative presentation is hidden and the form remains primary. Existing desktop/mobile navigation continues to operate.

The form preserves email/password and registration-only username, their existing maximum/minimum lengths and username character set. Native browser validation is lightweight feedback; backend validation is authoritative. Submission is guarded against double clicks, exposes loading state, focuses an accessible error, and allows retries. Password visibility is an explicit keyboard-accessible control. Secrets/session tokens are not stored by this UI.

The shared request helper retains existing URLs, methods, credentials and error formatting. Authentication additionally validates the successful response against the existing shared response schema before showing confirmed state. Success navigates immediately to `/settings`; no cinematic timer can delay access. There are no fabricated recovery/OAuth actions or redirect query parameters.

The preview slot is replaceable. Its current CSS phone illustration is explicitly labeled temporary/static, has no WebGL/asset loading dependency, and claims no Pixel hardware accuracy. Registration changes only a local validity count and subtle concept-wallpaper saturation. This is not ROM configuration, device compatibility or password-strength verification.

## F2 — Reusable 3D device engine (proposal only)

First verify Google Pixel 10 Pro dimensions, display ratio and camera structure against current official manufacturer specifications and retain source/date evidence. No numeric dimensions or accuracy claims are assumed by F1. Prefer original procedural geometry; any imported model, photo, texture or environment map needs a reviewed redistribution license. An approximate model must be labeled accordingly.

Proposed modules:

| Module | Responsibility |
| --- | --- |
| Device geometry | Rounded body/frame/glass, recognizable camera bar and lenses, side buttons; bounded mesh complexity |
| Materials | Shared physically based glass/metal/lens surfaces and color palette; no external commercial assets without license review |
| Lighting | Restrained studio lights/reflections, contact shadow; no critical text blurred by postprocessing |
| Camera/controls | Front, rear and three-quarter poses, keyboard-accessible view controls, bounded zoom and rotation |
| Screen renderer | Original screen composition/texture with deterministic layout; separate from the device mesh |
| State adapter | Typed auth visual state and a separately typed existing ROM-draft adapter; no backend implementation claims |
| Choreography | Short action-driven pose/screen transitions and reduced-motion alternatives |
| Boundary/fallback | Client-only lazy loading, error/context-loss handling, static fallback and retry without losing the form |

Evaluate stable Three.js/Fiber/Drei versions against the installed React/Next versions and dependency audits at F2 implementation time; do not assume latest means compatible. Motion for React is optional only if CSS/native interpolation cannot meet a concrete need. GSAP has no justified requirement. No dependencies were installed in F1.

The phone starts at a three-quarter angle; optional slow idle movement stops offscreen/inactive and under reduced motion. Auth success can unlock the display after confirmation but must never gate navigation on canvas readiness. Canvas input cannot trap keyboard focus or replace semantic form controls. Test WebGL denial/context loss, browser/device limits, touch interaction and resize.

## F3 — Existing draft-to-preview bindings (proposal only)

| Existing configuration | Grounded preview behavior |
| --- | --- |
| `apps` (`browser`, `calendar`, `files`, `terminal`) | Add/remove calendar and other allowed icons in a deterministic grid; membership changes may animate grid reflow; no claim that packages are installed |
| `darkMode` | Smooth dark/light screen palette transition with accessible contrast |
| `accent` | Screen highlight/accent interpolation; maintain independent readable text colors |
| `name` / `description` | Reflect actual ROM identity in appropriate preview/summary text, with escaping and length bounds |
| `variantId`, `base` | Display resolved exact selection and evidence status; do not change the visual phone's hardware or advertise compatibility merely from a catalog match |
| `preset` | Summarize saved intent; do not simulate measured performance, thermal changes or battery gains |
| `kernel: unconfigured` | Remain visibly unverified/unconfigured; no invented compatible kernel |

There is **no wallpaper field or home-screen-position schema** today. Do not silently reinterpret a performance preset as wallpaper, add persistent wallpaper presets, drag sorting, or save new keys into version-1 JSON. Calendar-triggered deterministic grid reflow is possible with existing membership data; arbitrary layout/wallpaper editing needs a separately approved contract first. A default visual wallpaper can be labeled a concept, not a saved customization.

Review & Build may briefly show front/rear and the true configuration summary, but must retain UNKNOWN/NOT_VERIFIED, compiler unavailable and disabled build controls. A rendered screen is not compiled firmware, boot evidence or permission to flash. Existing save, undo, revisions, JSON export, creation wizard and owner checks must continue working.

## F4 — Responsive, motion, accessibility and performance (proposal only)

Finish short entrance/selection transitions after core behavior works. Keep visible text sharp, forms usable immediately, focus indicators clear and layouts stable. Test keyboard order, native autofill/password managers, zoom, light/dark contrast, live errors, mobile keyboard overlap and reduced motion. No essential operation depends on 3D.

Lazy-load the engine only on approved auth/studio surfaces; unrelated routes must not fetch it. Cap device pixel ratio and texture resolution; avoid per-frame React state. Use visibility/intersection signals to stop rendering offscreen/background, and dispose owned textures/materials/geometries/listeners. Mobile defaults may use a static fallback or demand-rendered lightweight scene. Test context loss without losing form/draft state.

Measure development and production navigation/resource cost, main-thread work and real scene render performance under stated hardware/browser conditions. Record actual values and cold/warm caveats. Do not invent FPS, Lighthouse scores, bundle savings or battery claims. Establish budgets after the F2 baseline measurement, then compare before/after under identical conditions.

## Verification and approval gates

F1 requires real register/login/error/logout/session/project regressions, targeted mocked pending/malformed-response tests, desktop/tablet/mobile checks, automated accessibility plus keyboard inspection, frontend production build, and data/secret preservation. Those results belong in the F1 report.

F2 approval authorizes model/render/fallback work only. F3 approval authorizes bindings to existing fields only; new persistence fields require separate approval. F4 approval authorizes polish/performance verification. None authorizes backend/schema/Redis/worker/build-eligibility changes, data resets, secret rotation or production deployment.
