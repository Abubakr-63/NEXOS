/**
 * Adaptive Rendering Quality System for NEXOS Android Creation Studio.
 *
 * Tiering:
 * - "high": Full 3D WebGL visuals, capped DPR (1.5), HD canvas texture (scale 1.4).
 * - "balanced": 3D WebGL with lower DPR (1.0), standard texture (scale 1.0), reduced particle/reflection load.
 * - "lite": Zero WebGL allocation. Uses ultra-lightweight SVG+CSS 2D AndroidPhonePreview.
 *   Ideal for midrange Android devices (~4GB RAM), battery conservation, and reduced-motion environments.
 */

export type VisualQuality = "high" | "balanced" | "lite";

const STORAGE_KEY = "nexos_visual_quality";

/**
 * Detects sensible default quality based on viewport, input type, and reduced motion.
 * Avoids fragile hardware fingerprinting.
 */
export function detectDefaultQuality(): VisualQuality {
  if (typeof window === "undefined") return "balanced";

  const match =
    typeof window.matchMedia === "function"
      ? (q: string) => window.matchMedia(q).matches
      : () => false;

  // Mobile, tablets, and touch-only coarse pointers default to "lite" (fast 2D preview)
  const isMobileOrTouch = match(
    "(max-width: 950px), (hover: none) and (pointer: coarse)",
  );
  if (isMobileOrTouch) return "lite";

  // Reduced motion preference defaults to "balanced"
  const prefersReduced = match("(prefers-reduced-motion: reduce)");
  if (prefersReduced) return "balanced";

  // Large desktop displays default to "high"; smaller laptops to "balanced"
  return window.innerWidth >= 1280 ? "high" : "balanced";
}

/**
 * Gets currently active visual quality (user preference or detected default).
 */
export function getVisualQuality(): VisualQuality {
  if (typeof window === "undefined") return "balanced";
  try {
    const saved = window.localStorage?.getItem(STORAGE_KEY) as VisualQuality | null;
    if (saved === "high" || saved === "balanced" || saved === "lite") {
      return saved;
    }
  } catch {
    // localStorage restricted / private browsing
  }
  return detectDefaultQuality();
}

/**
 * Sets user visual quality preference and dispatches an event for reactive updates.
 */
export function setVisualQuality(quality: VisualQuality): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage?.setItem(STORAGE_KEY, quality);
  } catch {
    // Ignore storage quota or access errors
  }
  window.dispatchEvent(
    new CustomEvent("nexos-quality-change", { detail: quality }),
  );
}

/**
 * React hook subscriber for quality changes.
 */
export function subscribeQualityChange(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("nexos-quality-change", callback);
  const media =
    typeof window.matchMedia === "function"
      ? window.matchMedia(
          "(max-width: 950px), (hover: none) and (pointer: coarse)",
        )
      : null;
  media?.addEventListener?.("change", callback);
  return () => {
    window.removeEventListener("nexos-quality-change", callback);
    media?.removeEventListener?.("change", callback);
  };
}

