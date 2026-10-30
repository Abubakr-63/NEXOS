import type { PixelScreenState } from "./adapter";
export type SceneEvent =
  | "calendar-added"
  | "calendar-removed"
  | "applications"
  | "appearance"
  | "performance"
  | "review";
export function configurationEvent(
  previous: PixelScreenState,
  next: PixelScreenState,
): SceneEvent | null {
  if (previous.apps.includes("calendar") !== next.apps.includes("calendar"))
    return next.apps.includes("calendar")
      ? "calendar-added"
      : "calendar-removed";
  if (previous.apps.join() !== next.apps.join()) return "applications";
  if (previous.dark !== next.dark || previous.accent !== next.accent)
    return "appearance";
  if (previous.preset !== next.preset) return "performance";
  return null; // Identity typing updates the texture, never repeatedly moves the camera.
}
/** One replaceable clock: no stale completion timers, no hidden/offscreen RAF loop. */
export function animationClock(
  duration: number,
  tick: (elapsed: number) => void,
) {
  let elapsed = 0,
    previous = 0,
    raf = 0,
    stopped = false;
  const frame = (now: number) => {
    raf = 0;
    if (stopped || document.hidden) return;
    elapsed += previous ? Math.max(0, now - previous) : 0;
    previous = now;
    tick(Math.min(duration, elapsed));
    if (elapsed < duration) raf = requestAnimationFrame(frame);
  };
  const visibility = () => {
    cancelAnimationFrame(raf);
    raf = 0;
    previous = 0;
    if (!document.hidden && !stopped && elapsed < duration)
      raf = requestAnimationFrame(frame);
  };
  document.addEventListener("visibilitychange", visibility);
  if (!document.hidden) raf = requestAnimationFrame(frame);
  return () => {
    stopped = true;
    cancelAnimationFrame(raf);
    document.removeEventListener("visibilitychange", visibility);
  };
}
