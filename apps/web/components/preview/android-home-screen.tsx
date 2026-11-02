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

export function AndroidHomeScreen({
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
      <div className="preview-at-a-glance home-glance">
        <div className="glance-top">
          <span className="glance-date">{date}</span>
          <span className="glance-divider">·</span>
          <span className="glance-weather">{weather}</span>
        </div>
        {projectName && <div className="glance-project-pill">{projectName}</div>}
      </div>

      {/* Main Apps Grid */}
      <div className="homescreen-scroll-area">
        <AppIconGrid selectedApps={selectedApps} onAppClick={onAppClick} />
      </div>

      {/* Google Search Pill */}
      <div className="google-search-pill" role="search" aria-label="Google search bar">
        <div className="search-g">
          <GoogleGIcon size={24} />
        </div>
        <span className="search-placeholder">Search apps & web...</span>
        <div className="search-actions">
          <Mic size={18} className="search-icon mic" />
          <Camera size={18} className="search-icon lens" />
        </div>
      </div>

      {/* Bottom Favorite App Dock */}
      <div className="homescreen-dock" aria-label="Favorite applications">
        <button
          type="button"
          className="dock-item"
          title="Phone"
          aria-label="Phone"
          onClick={() => onAppClick?.("phone")}
        >
          <PhoneAppIcon size={44} />
        </button>
        <button
          type="button"
          className="dock-item"
          title="Messages"
          aria-label="Messages"
          onClick={() => onAppClick?.("messages")}
        >
          <MessagesAppIcon size={44} />
        </button>
        <button
          type="button"
          className="dock-item"
          title="Chrome"
          aria-label="Chrome Browser"
          onClick={() => onAppClick?.("browser")}
        >
          <ChromeBrowserIcon size={44} />
        </button>
        <button
          type="button"
          className="dock-item"
          title="Camera"
          aria-label="Camera"
          onClick={() => onAppClick?.("camera")}
        >
          <CameraAppIcon size={44} />
        </button>
      </div>

      {/* Bottom Gesture Navigation Bar */}
      <div className="homescreen-footer">
        <div className="gesture-bar" />
      </div>
    </div>
  );
}
