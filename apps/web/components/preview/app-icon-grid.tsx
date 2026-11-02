"use client";

import React from "react";
import { NexosAppIcon } from "./app-icons";

export type AppItem = {
  id: string;
  name: string;
  iconName?: string;
  isUserSelected?: boolean;
};

export const DEFAULT_ANDROID_APPS: AppItem[] = [
  { id: "gmail", name: "Gmail", iconName: "gmail" },
  { id: "calendar", name: "Calendar", iconName: "calendar" },
  { id: "meet", name: "Meet", iconName: "meet" },
  { id: "drive", name: "Drive", iconName: "drive" },
  { id: "docs", name: "Docs", iconName: "docs" },
  { id: "maps", name: "Maps", iconName: "maps" },
  { id: "photos", name: "Photos", iconName: "photos" },
  { id: "playstore", name: "Play Store", iconName: "playstore" },
];

export function AppIconGrid({
  selectedApps = [],
  onAppClick,
}: {
  selectedApps?: readonly string[];
  onAppClick?: (appId: string) => void;
}) {
  // Combine core apps with user-selected apps
  const appList = React.useMemo(() => {
    const list: AppItem[] = [...DEFAULT_ANDROID_APPS];

    // Ensure selected apps (browser, files, terminal, etc.) are present
    selectedApps.forEach((appId) => {
      const existing = list.find((a) => a.id === appId);
      if (existing) {
        existing.isUserSelected = true;
      } else {
        const title = appId.charAt(0).toUpperCase() + appId.slice(1);
        list.push({
          id: appId,
          name: title,
          iconName: appId,
          isUserSelected: true,
        });
      }
    });

    return list;
  }, [selectedApps]);

  return (
    <div className="preview-app-grid" role="grid" aria-label="Home screen applications">
      {appList.map((app, index) => {
        const isSelected = selectedApps.includes(app.id);
        return (
          <button
            key={app.id}
            type="button"
            className={`grid-app-item ${isSelected ? "selected-app" : ""}`}
            style={{ animationDelay: `${index * 40}ms` }}
            onClick={() => onAppClick?.(app.id)}
            title={app.name}
            aria-label={app.name}
          >
            <div className="icon-wrapper">
              <NexosAppIcon name={app.iconName ?? app.id} size={44} />
              {isSelected && <span className="app-badge-dot" />}
            </div>
            <span className="app-label">{app.name}</span>
          </button>
        );
      })}
    </div>
  );
}
