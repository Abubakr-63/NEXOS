"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Smartphone } from "lucide-react";
import {
  defaultConfiguration,
  type ROMConfiguration,
} from "@rom-hub/contracts";
import { configurationToScreen } from "./adapter";
import { FILM_DURATION, filmScenes, sampleFilm } from "./film";
import {
  animationClock,
  configurationEvent,
  type SceneEvent,
} from "./orchestrator";
import type { PixelEngine } from "./engine";
import "./pixel.css";

export function DesktopExperience({
  configuration,
  success = false,
  compact = false,
  review = false,
  mode = "login",
  context,
  authenticated = false,
}: {
  configuration?: ROMConfiguration;
  success?: boolean;
  compact?: boolean;
  review?: boolean;
  mode?: "login" | "register";
  context?: string;
  authenticated?: boolean;
}) {
  const canvas = useRef<HTMLCanvasElement>(null),
    engine = useRef<PixelEngine | null>(null);
  const stop = useRef<(() => void) | null>(null);
  const [chapter, setChapter] = useState(compact ? 2 : 0);
  const [fallback, setFallback] = useState(false),
    [ready, setReady] = useState(false);
  const [visible, setVisible] = useState(false),
    [reduced, setReduced] = useState(false);
  const [notice, setNotice] = useState("");
  const screenState = useMemo(
    () =>
      configurationToScreen(
        configuration ?? {
          ...defaultConfiguration,
          name: mode === "register" ? "Your Android journey" : "Welcome back",
          accent: chapter === 5 ? "#38bdf8" : "#60a5fa",
          darkMode: chapter !== 5,
          apps:
            chapter >= 2
              ? [
                  ...defaultConfiguration.apps.filter((a) => a !== "calendar"),
                  "calendar",
                ]
              : defaultConfiguration.apps.filter((a) => a !== "calendar"),
        },
        success || authenticated,
      ),
    [configuration, chapter, mode, success, authenticated],
  );
  const stateRef = useRef(screenState),
    previous = useRef(screenState);
  const previousReview = useRef(false);

  useEffect(() => {
    const preference = matchMedia("(prefers-reduced-motion: reduce)");
    const changed = () => {
      setReduced(preference.matches);
      if (preference.matches) setNotice("");
    };
    changed();
    preference.addEventListener("change", changed);
    return () => preference.removeEventListener("change", changed);
  }, []);

  useEffect(() => {
    let active = true,
      loading = false;
    const element = canvas.current;
    if (!element) return;
    const lost = (event: Event) => {
      event.preventDefault();
      stop.current?.();
      engine.current?.active(false);
      if (active) {
        setFallback(true);
        setReady(false);
      }
    };
    const restored = async () => {
      if (!active) return;
      engine.current?.dispose();
      engine.current = null;
      try {
        const { createPixelEngine } = await import("./engine");
        if (!active) return;
        const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
        engine.current = createPixelEngine(
          element,
          stateRef.current,
          reduce,
          compact,
        );
        if (compact || reduce) engine.current.seek(1 / 3);
        else
          engine.current.film(location.pathname === "/register" ? 31 / 43 : 0);
        setFallback(false);
        setReady(true);
      } catch {
        if (active) setFallback(true);
      }
    };
    element.addEventListener("webglcontextlost", lost);
    element.addEventListener("webglcontextrestored", restored);
    const observer = new IntersectionObserver(
      async (entries) => {
        const inView = entries.some((entry) => entry.isIntersecting);
        setVisible(inView);
        if (!inView) setNotice("");
        engine.current?.active(inView);
        if (!inView || loading || engine.current) return;
        loading = true;
        try {
          await new Promise<void>((resolve) => {
            if ("requestIdleCallback" in window)
              window.requestIdleCallback(() => resolve(), { timeout: 1000 });
            else setTimeout(resolve, 0);
          });
          if (!active) return;
          const { createPixelEngine } = await import("./engine");
          if (!active) return;
          engine.current = createPixelEngine(
            element,
            stateRef.current,
            matchMedia("(prefers-reduced-motion: reduce)").matches,
            compact,
          );
          (element as unknown as { __pixelEngine: PixelEngine | null }).__pixelEngine =
            engine.current;
          if (compact || matchMedia("(prefers-reduced-motion: reduce)").matches)
            engine.current.seek(1 / 3);
          else
            engine.current.film(
              location.pathname === "/register" ? 31 / 43 : 0,
            );
          setReady(true);
        } catch {
          if (active) setFallback(true);
        }
      },
      { rootMargin: "0px" },
    );
    observer.observe(element);
    return () => {
      active = false;
      stop.current?.();
      observer.disconnect();
      element.removeEventListener("webglcontextlost", lost);
      element.removeEventListener("webglcontextrestored", restored);
      engine.current?.dispose();
      engine.current = null;
    };
  }, [compact]);

  useEffect(() => {
    stateRef.current = screenState;
    engine.current?.update(screenState);
  }, [screenState]);

  useEffect(() => {
    engine.current?.motion(reduced);
  }, [reduced]);

  // Single replaceable cinematic clock. Form state is independent of this clock.
  useEffect(() => {
    if (!ready || compact || !visible) return;
    stop.current?.();
    if (reduced) {
      engine.current?.seek(1 / 3);
      return;
    }
    let last = -1;
    stop.current = animationClock(Number.POSITIVE_INFINITY, (elapsed) => {
      const value =
        ((elapsed + (mode === "register" ? 31000 : 0)) % FILM_DURATION) /
        FILM_DURATION;
      engine.current?.film(value);
      const next = sampleFilm(value).chapter;
      if (next !== last) {
        last = next;
        setChapter(next);
      }
    });
    return () => stop.current?.();
  }, [ready, compact, mode, reduced, visible]);

  // Event-driven reactive camera animation for Create ROM / Studio settings
  useEffect(() => {
    const event = configurationEvent(previous.current, screenState);
    previous.current = screenState;
    const enteringReview = review && !previousReview.current;
    const leavingReview = !review && previousReview.current;
    previousReview.current = review;
    if (!compact || !ready || !visible) return;
    const action: SceneEvent | null = enteringReview ? "review" : event;
    if (!action) {
      if (leavingReview) {
        stop.current?.();
        engine.current?.seek(1 / 3);
        engine.current?.zoom(1);
      }
      return;
    }
    stop.current?.();
    engine.current?.zoom(1);
    engine.current?.seek(1 / 3);
    if (reduced) return;

    // Replacing a running event always applies the latest screen state, then returns to rest.
    let announced = false;
    stop.current = animationClock(
      action === "review" ? 3400 : 2800,
      (elapsed) => {
        if (!announced) {
          announced = true;
          setNotice(
            action === "calendar-added"
              ? "Calendar added"
              : action === "calendar-removed"
                ? "Calendar removed"
                : action === "appearance"
                  ? "Appearance updated"
                  : action === "performance"
                    ? "Performance preset updated"
                    : action === "review"
                      ? "Reviewing your draft"
                      : "Preview updated",
          );
        }
        if (action === "review" && elapsed < 1100) {
          engine.current?.seek(1);
          engine.current?.view("three-quarter");
        } else if (action === "appearance" && elapsed < 1200) {
          engine.current?.seek(0.36);
        } else {
          engine.current?.seek(
            action === "performance" && elapsed < 1100 ? 4 / 6 : 1 / 3,
          );
        }
        const focus = [
          "calendar-added",
          "calendar-removed",
          "applications",
        ].includes(action);
        engine.current?.zoom(focus && elapsed < 1600 ? 1.2 : 1);
        if (elapsed >= (action === "review" ? 3400 : 2800)) {
          engine.current?.seek(1 / 3);
          engine.current?.zoom(1);
          setNotice("");
        }
      },
    );
  }, [screenState, compact, ready, review, reduced, visible]);

  useEffect(() => {
    if (!visible || reduced) {
      stop.current?.();
      engine.current?.zoom(1);
      if (compact) engine.current?.seek(1 / 3);
    }
  }, [visible, reduced, compact]);

  return (
    <div
      className={`pixel-story${compact ? " pixel-compact" : ""}`}
      data-chapter={chapter}
      data-mode={mode}
    >
      <div className="pixel-stage">
        <div className="pixel-heading">
          <span>NEXOS / ANDROID, REIMAGINED</span>
          <span>
            {compact
              ? "CONFIGURATION CONCEPT"
              : "PIXEL-INSPIRED / NEXOS STUDY"}
          </span>
        </div>
        <div className="pixel-viewport">
          <canvas
            ref={canvas}
            aria-label={
              compact
                ? "Autonomous generic configuration concept"
                : "Autonomous NEXOS concept smartphone film"
            }
            role="img"
          />
          {(!ready || fallback) && (
            <div className="pixel-fallback" role="status">
              <Smartphone size={80} strokeWidth={0.7} />
              <p>
                {fallback
                  ? "3D preview unavailable on this device."
                  : "Preparing the product scene…"}
              </p>
              <small>
                Your account and configuration controls remain available.
              </small>
            </div>
          )}
          <span className="pixel-model-label">
            {compact
              ? "Generic concept · not a model of your selected device"
              : "Reference-inspired visualization · hardware effects are illustrative"}
          </span>
          <span className="pixel-confirmation" role="status">
            {notice}
          </span>
        </div>
        {!compact && (
          <div className="pixel-copy">
            <span>
              {mode === "register"
                ? "CREATE YOUR ANDROID JOURNEY"
                : "YOUR ANDROID. YOUR RULES."}
            </span>
            <h2>{filmScenes[chapter].label}</h2>
            <p>{filmScenes[chapter].detail}</p>
          </div>
        )}
        {compact && context && <p className="pixel-context">{context}</p>}
        <p className="pixel-concept-note">
          {compact
            ? "Draft visualization. Compilation and compatibility remain unverified."
            : "An automatic NEXOS interface concept. No settings are saved here."}
        </p>
      </div>
    </div>
  );
}
