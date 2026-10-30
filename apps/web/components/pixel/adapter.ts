import {
  defaultConfiguration,
  type ROMConfiguration,
} from "@rom-hub/contracts";
export type PixelScreenState = {
  name: string;
  accent: string;
  dark: boolean;
  apps: readonly string[];
  preset: string;
  unlocked: boolean;
  draft: boolean;
};
export function configurationToScreen(
  configuration: ROMConfiguration = defaultConfiguration,
  unlocked = false,
): PixelScreenState {
  const order = ["browser", "calendar", "files", "terminal"];
  return {
    name: configuration.name,
    accent: configuration.accent,
    dark: configuration.darkMode,
    apps: order.filter((app) =>
      configuration.apps.includes(app as ROMConfiguration["apps"][number]),
    ),
    preset: configuration.preset,
    unlocked,
    draft: true,
  };
}
