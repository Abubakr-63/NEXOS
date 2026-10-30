"use client";
import dynamic from "next/dynamic";
import { useSyncExternalStore } from "react";
import type { ROMConfiguration } from "@rom-hub/contracts";
import "./pixel.css";
export type ExperienceProps = {
  configuration?: ROMConfiguration;
  authenticated?: boolean;
  success?: boolean;
  compact?: boolean;
  review?: boolean;
  mode?: "login" | "register";
  context?: string;
};
const DesktopExperience = dynamic(
  () =>
    import("./desktop-experience").then((module) => module.DesktopExperience),
  { ssr: false },
);
const mobileQuery = "(max-width: 950px), (hover: none) and (pointer: coarse)";
function subscribe(callback: () => void) {
  const media = matchMedia(mobileQuery);
  media.addEventListener("change", callback);
  return () => media.removeEventListener("change", callback);
}
const mobileSnapshot = () => matchMedia(mobileQuery).matches;
const serverSnapshot = () => true;
/** Mobile never renders the dynamic component, so its engine/model/film chunks are never requested. */
export function PixelExperience(props: ExperienceProps) {
  const disabled = useSyncExternalStore(
    subscribe,
    mobileSnapshot,
    serverSnapshot,
  );
  if (disabled)
    return props.compact ? (
      <div className="pixel-mobile-summary">
        <strong>{props.configuration?.name ?? "Configuration preview"}</strong>
        <p>
          {props.context ?? "Your selected settings remain available below."}
        </p>
        <p>
          Text preview · 3D is disabled on mobile. Compilation remains
          unavailable.
        </p>
      </div>
    ) : null;
  return <DesktopExperience {...props} />;
}
