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

export const AndroidLockScreen = React.memo(function AndroidLockScreen({
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
        <span className="glance-calendar">{date} · {weather}</span>
      </div>

      {/* Signature Android Dual-Row Lockscreen Clock */}
      <div className="lockscreen-clock-container" aria-label={`Current time ${time}`}>
        <div className="clock-hours">{hours ?? "09"}</div>
        <div className="clock-minutes">{minutes ?? "41"}</div>
      </div>

      {/* Lockscreen Full Date */}
      <div className="lockscreen-date-label">
        <span>{date.toUpperCase()}</span>
      </div>

      {/* Notification Card / Project Indicator */}
      <div className="lockscreen-notification">
        <div className="notif-header">
          <span className="notif-pill-kicker">NEXOS SYSTEM</span>
          <span className="notif-time">now</span>
        </div>
        <div className="notif-body">
          <strong>{projectName}</strong>
          <p>Ready to customize. Tap to explore applications.</p>
        </div>
      </div>

      {/* Bottom Padlock & Unlock Prompt */}
      <div className="lockscreen-footer">
        <div className="lock-icon-pill" title="Tap to unlock">
          <Lock size={18} className="lock-svg" />
        </div>
        <span className="swipe-hint">Swipe up or tap to unlock</span>
        <div className="gesture-bar" />
      </div>
    </div>
  );
});
