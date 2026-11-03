"use client";

import React from "react";
import { AppIconGrid } from "./app-icon-grid";
import { GoogleGIcon, PhoneAppIcon, MessagesAppIcon, ChromeBrowserIcon, CameraAppIcon } from "./app-icons";
import { Mic, Camera } from "lucide-react";

export type HomeScreenProps = {
  accent?: string;
  dark?: boolean;
  time?: string;
  date?: string;
  weather?: string;
  selectedApps?: readonly string[];
  projectName?: string;
  onAppClick?: (appId: string) => void;
};

export const AndroidHomeScreen = React.memo(function AndroidHomeScreen({
  accent = "#38bdf8",
  dark = true,
  time = "09:41",
  date = "Thu, Oct 29",
  weather = "21°C",
  selectedApps = [],
  projectName = "NEXOS ROM",
  onAppClick,
}: HomeScreenProps) {
  return (
    <div
      className="android-homescreen"
      style={
        {
          "--preview-accent": accent,
        } as React.CSSProperties
      }
      data-theme={dark ? "dark" : "light"}
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
      <div className="preview-glance-widget">
        <span className="glance-date">{date}</span>
        <div className="glance-weather">
          <span>{weather}</span>
          <span className="weather-icon">☀️</span>
        </div>
      </div>

      {/* Google Search Bar Pill */}
      <div className="preview-search-bar" role="search" aria-label="Search apps and web">
        <div className="search-pill-content">
          <GoogleGIcon size={20} className="google-g" />
          <span className="search-placeholder">Search apps & web</span>
          <div className="search-actions">
            <Mic size={16} className="search-action-icon text-slate-400" />
            <Camera size={16} className="search-action-icon text-slate-400" />
          </div>
        </div>
      </div>

      {/* Dynamic Staggered App Icons Grid */}
      <div className="preview-apps-area">
        <AppIconGrid selectedApps={selectedApps} onAppClick={onAppClick} />
      </div>

      {/* Floating System Feature Pill */}
      <div className="preview-project-pill">
        <span className="pill-dot" />
        <span className="pill-title truncate max-w-[140px]">{projectName}</span>
      </div>

      {/* Bottom Pinned App Dock (4 standard slots: Phone, Messages, Chrome, Camera) */}
      <div className="preview-dock-container" aria-label="Pinned dock apps">
        <div className="dock-glass-shelf">
          <button
            type="button"
            className="dock-icon-btn"
            onClick={() => onAppClick?.("phone")}
            aria-label="Phone"
          >
            <PhoneAppIcon size={46} />
          </button>
          <button
            type="button"
            className="dock-icon-btn"
            onClick={() => onAppClick?.("messages")}
            aria-label="Messages"
          >
            <MessagesAppIcon size={46} />
          </button>
          <button
            type="button"
            className="dock-icon-btn"
            onClick={() => onAppClick?.("browser")}
            aria-label="Chrome Browser"
          >
            <ChromeBrowserIcon size={46} />
          </button>
          <button
            type="button"
            className="dock-icon-btn"
            onClick={() => onAppClick?.("camera")}
            aria-label="Camera"
          >
            <CameraAppIcon size={46} />
          </button>
        </div>
      </div>

      {/* Bottom Gesture Navigation Bar */}
      <div className="homescreen-footer">
        <div className="gesture-bar" />
      </div>
    </div>
  );
});
