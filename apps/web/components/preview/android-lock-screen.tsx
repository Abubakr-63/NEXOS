"use client";

import React from "react";
import { Lock } from "lucide-react";

export type LockScreenProps = {
  accent?: string;
  dark?: boolean;
  time?: string;
  date?: string;
  weather?: string;
  projectName?: string;
  onUnlockRequest?: () => void;
};

export function AndroidLockScreen({
  accent = "#38bdf8",
  dark = true,
  time = "09:41",
  date = "Thursday, October 29",
  weather = "21°C · Clear",
  projectName = "NEXOS Android",
  onUnlockRequest,
}: LockScreenProps) {
  const [hours, minutes] = time.split(":");

  return (
    <div
      className="android-lockscreen"
      style={
        {
          "--preview-accent": accent,
        } as React.CSSProperties
      }
      data-theme={dark ? "dark" : "light"}
      onClick={onUnlockRequest}
    >
      {/* Top Status Bar */}
      <div className="preview-status-bar">
        <span className="status-time">{time}</span>
        <div className="status-icons">
          <span className="status-badge">5G</span>
          <span className="status-battery" aria-label="Battery 100%">
            <span className="battery-fill" style={{ width: "100%" }} />
          </span>
        </div>
      </div>

      {/* At A Glance Widget */}
      <div className="preview-at-a-glance">
        <span className="glance-date">{date}</span>
        <span className="glance-weather">{weather}</span>
      </div>

      {/* Signature Pixel Dual-Row Lock Clock */}
      <div className="lockscreen-clock-container" aria-label={`Current time: ${time}`}>
        <div className="clock-digits hours">{hours}</div>
        <div className="clock-digits minutes">{minutes}</div>
      </div>

      {/* Notification / Project Banner */}
      {projectName && (
        <div className="lockscreen-card">
          <span className="card-kicker">NEXOS SYSTEM INTENT</span>
          <h4 className="card-title">{projectName}</h4>
          <p className="card-subtitle">Ready to configure · Swipe up to unlock</p>
        </div>
      )}

      {/* Bottom Lock Icon & Hint */}
      <div className="lockscreen-footer">
        <div className="lock-glyph-ring" aria-label="Device locked">
          <Lock size={20} className="lock-glyph" />
        </div>
        <span className="unlock-hint">Swipe up or edit apps to unlock</span>
        <div className="gesture-bar" />
      </div>
    </div>
  );
}
