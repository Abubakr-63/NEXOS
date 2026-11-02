"use client";

import React, { useSyncExternalStore } from "react";
import { AndroidLockScreen } from "./android-lock-screen";
import { AndroidHomeScreen } from "./android-home-screen";

export type PreviewTransitionProps = {
  unlocked: boolean;
  accent?: string;
  dark?: boolean;
  time?: string;
  selectedApps?: readonly string[];
  projectName?: string;
  onAppClick?: (appId: string) => void;
  onUnlockToggle?: () => void;
};

const subscribeMotion = (callback: () => void) => {
  if (typeof window === "undefined") return () => {};
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  mq.addEventListener("change", callback);
  return () => mq.removeEventListener("change", callback);
};

const getMotionSnapshot = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const getServerSnapshot = () => false;

export function PreviewTransition({
  unlocked,
  accent = "#38bdf8",
  dark = true,
  time = "09:41",
  selectedApps = [],
  projectName = "NEXOS ROM",
  onAppClick,
  onUnlockToggle,
}: PreviewTransitionProps) {
  const reducedMotion = useSyncExternalStore(
    subscribeMotion,
    getMotionSnapshot,
    getServerSnapshot,
  );

  return (
    <div
      className={`preview-screen-stage ${unlocked ? "is-unlocked" : "is-locked"} ${
        reducedMotion ? "reduced-motion" : ""
      }`}
      aria-live="polite"
    >
      {/* Background wallpaper layer */}
      <div
        className="screen-wallpaper"
        style={
          {
            "--preview-accent": accent,
          } as React.CSSProperties
        }
        data-theme={dark ? "dark" : "light"}
      >
        <div className="wallpaper-orb orb-1" />
        <div className="wallpaper-orb orb-2" />
        <div className="wallpaper-noise" />
      </div>

      {/* Home Screen (rendered underneath or revealed on unlock) */}
      <div className="stage-layer home-layer" aria-hidden={!unlocked}>
        <AndroidHomeScreen
          accent={accent}
          dark={dark}
          time={time}
          selectedApps={selectedApps}
          projectName={projectName}
          onAppClick={onAppClick}
        />
      </div>

      {/* Lock Screen (slides upward and fades when unlocked) */}
      <div className="stage-layer lock-layer" aria-hidden={unlocked}>
        <AndroidLockScreen
          accent={accent}
          dark={dark}
          time={time}
          projectName={projectName}
          onUnlockRequest={onUnlockToggle}
        />
      </div>
    </div>
  );
}
