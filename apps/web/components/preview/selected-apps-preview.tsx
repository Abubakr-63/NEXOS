"use client";

import React from "react";
import { NexosAppIcon } from "./app-icons";
import { X, Plus } from "lucide-react";

export type SelectedAppsPreviewProps = {
  selectedApps: readonly string[];
  allAvailableApps?: { id: string; name: string; iconName?: string }[];
  onToggleApp?: (appId: string) => void;
  maxApps?: number;
};

export const DEFAULT_SELECTABLE_APPS = [
  { id: "browser", name: "Chrome Browser", iconName: "browser" },
  { id: "calendar", name: "Google Calendar", iconName: "calendar" },
  { id: "files", name: "Files Manager", iconName: "files" },
  { id: "terminal", name: "NEXOS Terminal", iconName: "terminal" },
];

export function SelectedAppsPreview({
  selectedApps,
  allAvailableApps = DEFAULT_SELECTABLE_APPS,
  onToggleApp,
  maxApps = 4,
}: SelectedAppsPreviewProps) {
  return (
    <div className="selected-apps-widget" aria-label="Selected system applications">
      <div className="selected-apps-header">
        <span className="widget-title">Selected Applications</span>
        <span className="apps-count-badge">
          {selectedApps.length} / {maxApps}
        </span>
      </div>

      <div className="selected-apps-grid">
        {allAvailableApps.map((app) => {
          const isSelected = selectedApps.includes(app.id);
          return (
            <button
              key={app.id}
              type="button"
              className={`app-selection-card ${isSelected ? "is-selected" : ""}`}
              onClick={() => onToggleApp?.(app.id)}
              aria-pressed={isSelected}
            >
              <div className="app-card-icon">
                <NexosAppIcon name={app.iconName ?? app.id} size={36} />
              </div>
              <div className="app-card-info">
                <span className="app-name">{app.name}</span>
                <span className="app-status">
                  {isSelected ? "Included in build" : "Click to add"}
                </span>
              </div>
              <div className="app-card-action">
                {isSelected ? (
                  <span className="action-pill remove" title="Remove">
                    <X size={14} />
                  </span>
                ) : (
                  <span className="action-pill add" title="Add">
                    <Plus size={14} />
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
