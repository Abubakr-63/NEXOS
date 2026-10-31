# NEXOS — Cinematic Power-On Animation & REDMAGIC Floating Pose

### Executive Overview

This update delivers a complete cinematic overhaul of the NEXOS 3D smartphone experience on the `ai/gemini-frontend` branch. It replaces the previous extended black-screen dwell with an immediate, physically grounded power-on interaction and introduces an autonomous, REDMAGIC-inspired diagonal floating product showcase pose.

---

### Key Implementations

#### 1. Physical 3D Power Button Mechanical Depression
- **Chassis Assembly**: Isolated the milled titanium power key and chamfer highlight into a distinct mechanical group (`powerButtonGroup`) seated on the right chassis rail (`x = 3.75, y = 2.85, z = 0`).
- **Mechanical Kinematics**:
  - `t = 0.0s to 0.8s`: Camera approaches side rail in macro focus (`camera: [4.8, 2.85, 3.5]`, distance `3.57 < 5.0`). Button rests at full protrusion (`3.75`). Screen is pitch black.
  - `t = 0.8s to 0.95s`: Mechanical inward depression. Sinks `0.075` units inward toward `x = 3.675`, entering the chassis recess.
  - `t = 0.95s to 1.15s`: Spring release. Button returns smoothly to its resting position.

#### 2. Immediate Screen Wake-Up (Reduced Black Screen Duration)
- The previous 28-second black-screen delay has been eliminated.
- **Immediate Ignition**: Screen activation triggers at `t = 1.15s` immediately upon button release.
- **Boot Glow**: Illuminates from black to full luminance (`display: 0 -> 1.0`) by `t = 1.8s`, displaying a radiant cyan NEXOS ambient orb and glowing ring.
- **Lock Screen Reveal**: Dual-row Pixel lockscreen clock ("09:41") and "At a Glance" widget appear as the camera pulls back smoothly (`t = 1.8s to 3.2s`).
- **Home Screen Transition**: Application drawer and floating glass cards smoothly fade in (`t = 3.2s to 4.8s`).

#### 3. REDMAGIC-Inspired Floating Product Showcase Pose
- **Diagonal Perspective**: At `t = 5.0s to 12.0s`, the phone transitions into a dynamic diagonal showcase pose:
  - `pitch: 0.16` (~9.2° upward tilt)
  - `yaw: -0.40` (~-23.0° front three-quarter profile)
  - `roll: -0.32` (~-18.3° diagonal dynamic tilt)
- **Framing & Proportions**: Camera pulled back to `[0, 0.2, 36.5]`, framing the complete smartphone with generous ~6% top/bottom margins (NDC Y: `-0.871` to `0.909`).
- **Autonomous Organic Levitation**: Gentle harmonic floating motion (+/- 0.12 units elevation, +/- 1.2° tilt) creates a weightless, premium flagship commercial aesthetic.
- **Lighting & Materials**: Cyan (`#38bdf8`) and sapphire blue (`#60a5fa`) studio rim lights cast sharp specular streaks along the machined titanium frame rails and curved 2.5D front glass.

#### 4. Strict Front/Side Orientation Safeguards
- Evaluated at 1,000 dense sample points across all 43 seconds:
  - Minimum front normal dot product: `0.908` (exceeds requirement `>= 0.14`).
  - Rear panel and back glass remain completely invisible at all times.
  - Starting (`t = 0.0s`) and loop ending (`t = 43.0s`) keyframes are mathematically identical, providing an infinitely seamless loop.

---

### Verification Summary

1. **Automated Unit Tests**:
   - `tests/pixel-timeline.test.ts`: **7 / 7 passed** (Loop endpoints, button press, screen wake-up timing, REDMAGIC floating pose angles, and front dot product lock).
   - `tests/i18n-completeness.test.ts`: **7 / 7 passed**.
2. **TypeScript & Static Analysis**:
   - `pnpm --filter @rom-hub/web typecheck`: **0 errors**.
   - `pnpm --filter @rom-hub/web lint`: **0 warnings, 0 errors**.
3. **Live Browser Screenshots (Captured in Edge Chromium)**:
   - `power-on-1-before-press.png`: Macro side profile, button at rest, screen off.
   - `power-on-2-button-depressed.png`: Visible mechanical button depression into chassis.
   - `power-on-3-screen-illumination.png`: Immediate screen bloom and boot glow upon release.
   - `power-on-4-lock-screen.png`: Smooth camera pullback revealing dual-row 09:41 lockscreen clock.
   - `power-on-5-floating-diagonal-pose.png`: Full phone floating in the diagonal three-quarter pose.
   - `power-on-register-floating.png`: Usable registration screen with floating phone presentation.
