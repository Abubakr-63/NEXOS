# NEXOS — REDMAGIC reference-driven cinematic presentation

Date: 2026-10-30. PAUSED at the user’s request while the Superconscious-inspired redesign is implemented. This is a working checkpoint, not a final visual acceptance report. Local frontend implementation; no public deployment.

## Reference actually inspected

The supplied recording `Запись экрана от 2026-10-30 15-08-26.mp4` was opened in Chromium through a temporary loopback-only video server. Browser metadata reports 43.2246 seconds and 524 × 942 pixels. Frames at 3, 5, 7, 9, 12, 16, 20, 24, 28, 32, 36 and 38 seconds were extracted and inspected. This supersedes the earlier attachment's approximate storyboard; the actual recording became available during implementation.

Observed product details: a silver, nearly rectangular frame, four circular elements at the upper left, a transparent upper-right technical window, a large blue segmented circular assembly, fine metallic surfaces, internal illuminated routes, a red side control and macro fin/cooling imagery. The recording also contains a presenter, gameplay, source captions and human imagery on the display. None of those images, people, audio or captions are included in the application.

The reference file and extracted frames remain ignored local inspection artifacts. They are not published assets, downloaded third-party models or backgrounds disguised as 3D.

## Implemented asset and visual approach

The previous Pixel approximation is replaced with an original procedural mesh study following the visible REDMAGIC design. It has an extruded open metal perimeter, tighter corner radii, display gasket and shaped front glass, a silver rear plate with real circular/window cutouts, a transparent rear cover, four layered optical assemblies, concentric machined rings, aperture geometry, side controls, antenna seams, USB/speaker apertures and rear fasteners.

The interior includes a board carrier, shield packages, a labelled conceptual logic package, instanced pins/capacitors, routed metal paths with moving light pulses, a central brushed disk, concentric etching, segmented blue illumination, a rotor/spindle and layered fins. The cover, central cap and fins separate during cutaway shots. Rotor motion and travelling pulses are genuine scene geometry. The public scene is a design recreation/study, not a verified digital twin or a claim that NEXOS supplies REDMAGIC hardware or physical cooling.

Materials use metalness/roughness, an original deterministic brushed roughness texture, optical clearcoat/transparent lens surfaces, reflective silver panels and blue/RGB emissive technical elements. A localized additive point halo accompanies the blue ring. No fullscreen bloom or blur hides geometry. Studio lighting uses a procedural RoomEnvironment, directional key/fill/rim lights and two rectangular softboxes. ACES tone mapping, antialiasing and the existing contact-shadow texture remain. A costly second full geometry shadow pass was removed after software-rendering inspection. Screen textures are generated at a higher desktop resolution while retaining the existing vector composition and state transitions.

True refractive/volumetric liquid simulation, photographic HDRI, ray-traced reflections, cinematic depth of field and offline-grade compositing are not implemented. There is no external licensed scan or manufacturer CAD model. Those differences matter: the result is an approximate real-time recreation of the reference's design and shot vocabulary, not a claim of equivalent offline advertising fidelity.

## Shot-by-shot timeline

The autonomous desktop film loops over 43 seconds. Camera paths, targets, light level, layer separation and display brightness are explicit keyframes in `film.ts`; interpolation is deterministic. Camera distances remain outside the component surfaces. First/last camera, target, cover state and lighting match, preventing a reset flash.

| Time | Shot | Actual rendered content / relation to reference |
| --- | --- | --- |
| 0–6 s | Device reveal | Silver full-device rear composition, frame reflections, quad optical elements, transparent window and blue ring; camera approaches the hardware |
| 6–9 s | Optical macro | Real concentric metal rings, iris elements and layered optical geometry, rather than scaling a photograph |
| 9–15 s | Technical cutaway | Cover separates; shield caps, pins, packages, traces and central assembly remain three-dimensional |
| 15–21 s | Technical tracking / RGB | Camera traverses components and illuminated paths; emissive color changes visualize the reference's energetic technical lighting without performance claims |
| 21–29 s | Cooling-inspired macro | Separated cap, rotor, fins and machined ring; moving pulses and original mechanical motion, not a physical thermal simulation |
| 29–36 s | Reassembly / Android concept | Cover returns, camera moves around the side toward the front, display illuminates and shows animated NEXOS themes/app grid/Calendar |
| 36–43 s | Hero / loop transition | Full front, side and rear compositions; “Your phone. Your Android. Your rules.” narrative; continuous return to the opening pose |

This is a connected adaptation. The source's presenter and gameplay passages are replaced with device/interface/technical imagery; it is not a frame-for-frame reproduction of those passages. Layered macro content, cutaway views and complete-device views were inspected separately in the running browser.

## Shared integration and behavior

Login/Register remain outside the workspace shell, sharing the persistent auth canvas. Register starts around the personalization/front-display portion, rather than rebuilding the renderer. Authentication input, pending/error behavior, backend-confirmed success, cookies, session handling and existing redirects are unchanged. Unlock is signalled only after the existing successful API response; navigation never waits for a long product film.

The existing single replaceable clock is reused. Hidden/offscreen canvases suspend animation and rendering. Timing is based on visible elapsed time, and wrapping uses identical endpoint poses. No camera, orbit, zoom, playback, timeline or scene-selection controls are rendered.

ROM Studio, project creation and Profile reuse the same asset. They use the existing configuration-driven choreography rather than the looping public film. Actual Calendar/app membership, accent, dark appearance, identity and preset values remain authoritative; rapid changes replace obsolete camera work and return to rest. Name typing does not repeatedly move the camera. Existing save/revision/undo/export, session authorization, projects and unavailable-build behavior are retained.

Workspace labels continue to distinguish the concept preview from the selected physical device. No catalog device becomes build-supported through this visual change. Existing accent changes drive conceptual wallpaper colors; no unsupported wallpaper persistence field, installed kernel or compiled Android build is invented.

## Mobile: no 3D loading

`pixel-experience.tsx` is now a small responsive gate. The desktop React scene is a separate `ssr: false` dynamic import, and the engine/model/film modules sit behind that boundary. Widths at or below 950 px, or devices with coarse pointers and no hover, never render that component. SSR uses the disabled snapshot; no device-specific hydration assumption is required.

On mobile Login/Register, the visual aside is hidden and only the responsive account form remains. There is no canvas, WebGL request or 3D preparation message. Workspace previews become lightweight text summaries of the actual selected configuration. Desktop-to-mobile resizing disposes the existing GPU resources; code already downloaded while genuinely on desktop cannot be retroactively removed from the browser cache.

Browser tests inspect downloaded JavaScript for engine/model/film signatures, count WebGL context requests, assert zero canvases, and verify both auth forms. A separate wide touch-device test covers coarse-pointer tablets/landscape cases that a narrow-width test alone would miss.

## Resources, fallback and licenses

No new dependency or third-party 3D asset was installed. Meshes, screen graphics, roughness/glow textures and animation paths were authored in repository code. Existing Three.js 0.186.1 / RoomEnvironment are MIT-licensed; the existing `THIRD_PARTY_NOTICES.txt` remains applicable. The supplied video is used as a visual reference only and is not redistributed.

Engine imports remain lazy. Resolution is capped, repeated small details use instancing, the display is not redrawn/uploaded while it is dark and unseen in rear/macro film shots, and contact shading avoids a second full scene pass. Geometry, materials, textures, point halos, environment targets, renderers, observers and clocks are disposed. Reduced-motion desktop rendering uses a static front composition. WebGL denial/loss preserves the forms; restoration rebuilds the scene from the latest configuration without re-authenticating or resetting project state. There is no audio.

## Browser evidence and performance

VISUAL_PENDING

PERFORMANCE_PENDING

## Tests and checks actually executed

RESULTS_PENDING

Intermediate failures are not counted as passing runs. One older combined workflow exceeded its original 60-second budget under software rendering and left its own test fixture behind. The following run hit the fixture's constant unique manufacturer name. Cleanup was limited to the newly created, timestamped fixture after checking its exact marker, device/variant metadata and exclusively matching synthetic-account ownership; no pre-existing account/project was deleted. Fixture setup now shares its `try/finally` cleanup boundary and uses unique names. The full workflow budget was increased to 120 seconds to include real graphics rendering. A catalog test also waited longer for its intercepted empty response under software rendering; its non-graphics scenario uses reduced motion. A new pure-film test needed a floating-point tolerance at the loop lighting endpoint.

## Modified files

- `apps/web/components/pixel/pixel-experience.tsx`: mobile/loading gate.
- `apps/web/components/pixel/desktop-experience.tsx`: extracted desktop scene, loop, mode integration, loss/restoration handling.
- `apps/web/components/pixel/film.ts`: new cinematic shot definitions and pure sampler.
- `apps/web/components/pixel/model.ts`, `materials.ts`, `lighting.ts`: reference-driven modeled asset, technical components, PBR materials and lighting.
- `apps/web/components/pixel/engine.ts`: film camera/light/cutaway controls, draw/upload optimization, resource handling and diagnostics.
- `apps/web/components/pixel/screen.ts`: desktop texture scaling while preserving state-driven rendering.
- `apps/web/components/pixel/orchestrator.ts`, `timeline.ts`: shared clock timing, removal of obsolete film logic/Pixel copy; existing Studio pose sampler retained.
- `apps/web/components/pixel/pixel.css`: studio backdrop and mobile form/text-only presentation.
- `tests/pixel-timeline.test.ts`, `tests/e2e/pixel-experience.spec.ts`, `tests/e2e/foundation.spec.ts`: film, mobile network boundary, context, configuration and fixture regressions.
- This report. Existing unrelated dirty-tree work was retained.

No NestJS/worker source, dependency versions, PostgreSQL schema, API contracts, eligibility rules or existing secret values were changed.

## Data preservation and operational limits

PRESERVATION_PENDING

Physical desktop/mobile GPU validation, photographic material calibration and offline commercial-render quality remain outside the verified results. A licensed detailed manufacturer model, measured optical/material references and offline rendering/compositing would be the next quality step for a closer advertising match. No production deployment, real ROM compilation, physical cooling modification or manufacturer endorsement is claimed.
