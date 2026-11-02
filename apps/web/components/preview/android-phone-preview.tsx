"use client";

import React, { useState } from "react";
import type { ROMConfiguration } from "@rom-hub/contracts";
import { PreviewTransition } from "./preview-transition";
import "./phone-preview.css";

export type AndroidPhonePreviewProps = {
  configuration?: Partial<ROMConfiguration>;
  unlocked?: boolean;
  compact?: boolean;
  interactive?: boolean;
  onAppClick?: (appId: string) => void;
  className?: string;
  contextText?: string;
};

export function AndroidPhonePreview({
  configuration,
  unlocked: controlledUnlocked,
  compact = false,
  interactive = true,
  onAppClick,
  className = "",
  contextText,
}: AndroidPhonePreviewProps) {
  const [internalUnlocked, setInternalUnlocked] = useState(false);
  const isUnlocked = controlledUnlocked !== undefined ? controlledUnlocked : internalUnlocked;

  const accent = configuration?.accent ?? "#38bdf8";
  const dark = configuration?.darkMode ?? true;
  const projectName = configuration?.name ?? "NEXOS Android";
  const apps = configuration?.apps ?? ["browser", "files"];

  return (
    <div
      className={`android-phone-chassis ${compact ? "chassis-compact" : ""} ${className}`}
      data-unlocked={isUnlocked}
    >
      {/* Side Hardware Buttons */}
      <div className="hardware-btn volume-up" aria-hidden="true" />
      <div className="hardware-btn volume-down" aria-hidden="true" />
      <div className="hardware-btn power-btn" aria-hidden="true" />

      {/* Outer Aluminum Bezel Frame */}
      <div className="phone-outer-frame">
        {/* Inner Screen Display Glass */}
        <div className="phone-screen-glass">
          {/* Top Camera Punch Hole & Speaker */}
          <div className="phone-hardware-notch">
            <div className="camera-lens" aria-hidden="true" />
          </div>

          {/* Interactive Screen Content with Smooth Unlock Transition */}
          <PreviewTransition
            unlocked={isUnlocked}
            accent={accent}
            dark={dark}
            selectedApps={apps}
            projectName={projectName}
            onAppClick={onAppClick}
            onUnlockToggle={interactive ? () => setInternalUnlocked(!isUnlocked) : undefined}
          />
        </div>
      </div>

      {/* Screen reflection highlight */}
      <div className="screen-reflection" aria-hidden="true" />

      {/* Context caption if present */}
      {contextText && (
        <div className="preview-caption">
          <span>{contextText}</span>
        </div>
      )}
    </div>
  );
}
