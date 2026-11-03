"use client";

import dynamic from "next/dynamic";
import React, { useSyncExternalStore } from "react";
import type { ROMConfiguration } from "@rom-hub/contracts";
import { AndroidPhonePreview } from "../preview/android-phone-preview";
import {
  getVisualQuality,
  subscribeQualityChange,
  type VisualQuality,
} from "@/lib/rendering-quality";
import "./pixel.css";

export type ExperienceProps = {
  configuration?: ROMConfiguration;
  authenticated?: boolean;
  success?: boolean;
  compact?: boolean;
  review?: boolean;
  mode?: "login" | "register";
  context?: string;
  unlocked?: boolean;
};

const DesktopExperience = dynamic(
  () =>
    import("./desktop-experience").then((module) => module.DesktopExperience),
  { ssr: false },
);

/**
 * Adaptive Phone Visualization Experience.
 *
 * Tiering:
 * - "lite" (mobile smartphones, tablets with coarse pointers, or user Lite mode):
 *   Renders the lightweight 2D AndroidPhonePreview (SVG app icons, CSS transitions, 0 WebGL overhead).
 * - "balanced" / "high":
 *   Renders DesktopExperience (3D Three.js WebGL canvas with capped DPR and demand rendering).
 */
export function PixelExperience(props: ExperienceProps) {
  const quality: VisualQuality = useSyncExternalStore(
    subscribeQualityChange,
    getVisualQuality,
    () => "lite", // Server snapshot: defaults to lightweight 2D
  );

  if (quality === "lite") {
    return (
      <div className="pixel-mobile-wrapper">
        <AndroidPhonePreview
          configuration={props.configuration}
          unlocked={props.unlocked}
          compact={props.compact}
          interactive={false}
          contextText={props.context}
        />
      </div>
    );
  }

  return <DesktopExperience {...props} quality={quality} />;
}
