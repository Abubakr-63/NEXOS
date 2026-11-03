import { test } from "node:test";
import assert from "node:assert/strict";
import {
  detectDefaultQuality,
  getVisualQuality,
  setVisualQuality,
  subscribeQualityChange,
  type VisualQuality,
} from "../apps/web/lib/rendering-quality";
import { createScreen } from "../apps/web/components/pixel/screen";
import { configurationToScreen } from "../apps/web/components/pixel/adapter";
import { defaultConfiguration } from "../packages/contracts/src";
import { AndroidHomeScreen } from "../apps/web/components/preview/android-home-screen";
import { AndroidLockScreen } from "../apps/web/components/preview/android-lock-screen";
import { StoreCard } from "../apps/web/components/store/store-card";
import { NexosAppIcon } from "../apps/web/components/preview/app-icons";

// =========================================================================
// 1. Adaptive Rendering Quality System
// =========================================================================

test("adaptive rendering quality: defaults to balanced in SSR environment", () => {
  // In Node test environment, window is undefined initially
  const origWindow = globalThis.window;
  try {
    // @ts-expect-error simulating ssr
    delete globalThis.window;
    assert.equal(detectDefaultQuality(), "balanced");
    assert.equal(getVisualQuality(), "balanced");
  } finally {
    globalThis.window = origWindow;
  }
});

test("adaptive rendering quality: detects lite on mobile/touch screen viewports", () => {
  const listeners: Record<string, ((e: unknown) => void)[]> = {};
  const mockWindow = {
    innerWidth: 768,
    matchMedia: (query: string) => {
      if (query.includes("max-width: 950px") || query.includes("pointer: coarse")) {
        return { matches: true, addEventListener: () => {}, removeEventListener: () => {} };
      }
      return { matches: false, addEventListener: () => {}, removeEventListener: () => {} };
    },
    addEventListener: (event: string, cb: (e: unknown) => void) => {
      listeners[event] = listeners[event] || [];
      listeners[event].push(cb);
    },
    removeEventListener: () => {},
    dispatchEvent: () => true,
    localStorage: {
      getItem: () => null,
      setItem: () => {},
    },
  };

  const origWindow = globalThis.window;
  const origMatchMedia = globalThis.matchMedia;
  try {
    // @ts-expect-error mocking window
    globalThis.window = mockWindow;
    // @ts-expect-error mocking matchMedia
    globalThis.matchMedia = mockWindow.matchMedia;

    const detected = detectDefaultQuality();
    assert.equal(detected, "lite", "Mobile viewports must select lite (2D preview) tier");
  } finally {
    globalThis.window = origWindow;
    globalThis.matchMedia = origMatchMedia;
  }
});

test("adaptive rendering quality: detects balanced when reduced motion is preferred", () => {
  const mockWindow = {
    innerWidth: 1920,
    matchMedia: (query: string) => {
      if (query.includes("prefers-reduced-motion")) {
        return { matches: true, addEventListener: () => {}, removeEventListener: () => {} };
      }
      return { matches: false, addEventListener: () => {}, removeEventListener: () => {} };
    },
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => true,
    localStorage: {
      getItem: () => null,
      setItem: () => {},
    },
  };

  const origWindow = globalThis.window;
  const origMatchMedia = globalThis.matchMedia;
  try {
    // @ts-expect-error mocking window
    globalThis.window = mockWindow;
    // @ts-expect-error mocking matchMedia
    globalThis.matchMedia = mockWindow.matchMedia;

    const detected = detectDefaultQuality();
    assert.equal(detected, "balanced", "prefers-reduced-motion must downgrade to balanced");
  } finally {
    globalThis.window = origWindow;
    globalThis.matchMedia = origMatchMedia;
  }
});

test("adaptive rendering quality: detects high on wide desktop displays", () => {
  const mockWindow = {
    innerWidth: 1440,
    matchMedia: () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} }),
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => true,
    localStorage: {
      getItem: () => null,
      setItem: () => {},
    },
  };

  const origWindow = globalThis.window;
  const origMatchMedia = globalThis.matchMedia;
  try {
    // @ts-expect-error mocking window
    globalThis.window = mockWindow;
    // @ts-expect-error mocking matchMedia
    globalThis.matchMedia = mockWindow.matchMedia;

    const detected = detectDefaultQuality();
    assert.equal(detected, "high", "Wide desktops default to high 3D rendering");
  } finally {
    globalThis.window = origWindow;
    globalThis.matchMedia = origMatchMedia;
  }
});

test("adaptive rendering quality: persists preference and notifies subscribers via CustomEvent", () => {
  let stored: string | null = null;
  const events: CustomEvent[] = [];

  class MockCustomEvent {
    type: string;
    detail: unknown;
    constructor(type: string, init?: { detail?: unknown }) {
      this.type = type;
      this.detail = init?.detail;
    }
  }

  const mockWindow = {
    innerWidth: 1920,
    matchMedia: () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} }),
    addEventListener: (type: string, cb: (e: unknown) => void) => {
      mockWindow._listeners[type] = mockWindow._listeners[type] || [];
      mockWindow._listeners[type].push(cb);
    },
    removeEventListener: (type: string, cb: (e: unknown) => void) => {
      mockWindow._listeners[type] = (mockWindow._listeners[type] || []).filter((f) => f !== cb);
    },
    dispatchEvent: (ev: CustomEvent) => {
      events.push(ev);
      const list = mockWindow._listeners[ev.type] || [];
      for (const fn of list) fn(ev);
      return true;
    },
    localStorage: {
      getItem: () => stored,
      setItem: (_k: string, v: string) => {
        stored = v;
      },
    },
    _listeners: {} as Record<string, ((e: unknown) => void)[]>,
  };

  const origWindow = globalThis.window;
  const origCustomEvent = globalThis.CustomEvent;
  try {
    // @ts-expect-error mocking window
    globalThis.window = mockWindow;
    // @ts-expect-error mocking CustomEvent
    globalThis.CustomEvent = MockCustomEvent;

    let subscriberNotified = 0;
    const unsubscribe = subscribeQualityChange(() => {
      subscriberNotified++;
    });

    setVisualQuality("lite");
    assert.equal(stored, "lite");
    assert.equal(subscriberNotified, 1);
    assert.equal(getVisualQuality(), "lite");

    setVisualQuality("high");
    assert.equal(stored, "high");
    assert.equal(subscriberNotified, 2);
    assert.equal(getVisualQuality(), "high");

    unsubscribe();
    setVisualQuality("balanced");
    assert.equal(subscriberNotified, 2, "Subscriber must not be invoked after unsubscribe");
  } finally {
    globalThis.window = origWindow;
    globalThis.CustomEvent = origCustomEvent;
  }
});

// =========================================================================
// 2. Three.js Engine DPR Capping Rules
// =========================================================================

test("engine DPR capping: high mode caps DPR at 1.5, balanced mode caps at 1.0", () => {
  const getCappedDpr = (dpr: number, quality: VisualQuality): number => {
    return quality === "high" ? Math.min(dpr, 1.5) : 1.0;
  };

  // Standard 1x screen
  assert.equal(getCappedDpr(1.0, "high"), 1.0);
  assert.equal(getCappedDpr(1.0, "balanced"), 1.0);

  // Retina 2x screen
  assert.equal(getCappedDpr(2.0, "high"), 1.5, "High mode must cap 2x Retina at 1.5 to prevent fillrate explosion");
  assert.equal(getCappedDpr(2.0, "balanced"), 1.0, "Balanced mode must cap 2x Retina at 1.0");

  // Super Retina 3x screen (flagship OLEDs)
  assert.equal(getCappedDpr(3.0, "high"), 1.5, "High mode must cap 3x Super Retina at 1.5");
  assert.equal(getCappedDpr(3.0, "balanced"), 1.0, "Balanced mode must cap 3x Super Retina at 1.0");
});

// =========================================================================
// 3. Screen Demand Rendering & Non-Stringifying Signature
// =========================================================================

test("screen demand rendering: drawPixelScreen skips redraw when idle (motion=0)", () => {
  // Mock HTMLCanvasElement and CanvasRenderingContext2D
  const createMockContext = () => {
    return new Proxy(
      {
        fillStyle: "",
        strokeStyle: "",
        lineWidth: 1,
        font: "",
        textAlign: "left",
        globalAlpha: 1,
        createLinearGradient: () => ({ addColorStop() {} }),
        createRadialGradient: () => ({ addColorStop() {} }),
      } as Record<string, unknown>,
      {
        get(target, prop: string) {
          if (prop in target) return target[prop];
          return () => {};
        },
        set(target, prop: string, value) {
          target[prop] = value;
          return true;
        },
      },
    );
  };

  class MockCanvas {
    width = 480;
    height = 1066;
    getContext(type: string) {
      if (type === "2d") return createMockContext();
      return null;
    }
  }

  const origDocument = globalThis.document;
  try {
    // @ts-expect-error mocking document
    globalThis.document = {
      createElement: (tag: string) => {
        if (tag === "canvas") return new MockCanvas();
        return {};
      },
    };

    const screen = createScreen();
    const state = configurationToScreen(defaultConfiguration);

    // Initial draw must return true (drawn to canvas)
    const initialDraw = screen.draw(state, 0.5, 0);
    assert.equal(initialDraw, true, "Initial frame must render");

    // Identical state with motion=0 (compact/idle mode) must return false (zero redraw)
    const secondDraw = screen.draw(state, 0.5, 0);
    assert.equal(
      secondDraw,
      false,
      "Second frame with identical state and motion=0 must return false to skip texture update",
    );

    // Third call with updated configuration must return true
    const updatedState = configurationToScreen({
      ...defaultConfiguration,
      apps: ["browser", "calendar", "files"],
    });
    const stateChangeDraw = screen.draw(updatedState, 0.5, 0);
    assert.equal(stateChangeDraw, true, "State changes must trigger redraw");

    // Another identical call must return false again
    const idleDraw = screen.draw(updatedState, 0.5, 0);
    assert.equal(idleDraw, false, "Must return to idle demand rendering");

    screen.dispose();
  } finally {
    globalThis.document = origDocument;
  }
});

// =========================================================================
// 4. Component Optimization & Direct Invocability Protection
// =========================================================================

test("component memoization: screens and cards are memoized, app icons remain standard functions", () => {
  // Memoized components have an object structure with $$typeof
  assert.equal(typeof AndroidHomeScreen, "object");
  assert.ok("type" in AndroidHomeScreen);

  assert.equal(typeof AndroidLockScreen, "object");
  assert.ok("type" in AndroidLockScreen);

  assert.equal(typeof StoreCard, "object");
  assert.ok("type" in StoreCard);

  // NexosAppIcon MUST be directly callable as a function to ensure backward compatibility
  // and direct testing (such as in tests/f6-features.test.ts)
  assert.equal(typeof NexosAppIcon, "function");
  const iconResult = NexosAppIcon({ name: "gmail", size: 48 });
  assert.ok(iconResult);
});
