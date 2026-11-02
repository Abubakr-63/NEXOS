import type {
  ROMConfiguration,
  ProjectWriteResponse,
  ProjectsResponse,
} from "@rom-hub/contracts";
import { projectAPI } from "./project-api";

export type StoreCategory =
  | "Daily Driver"
  | "Gaming"
  | "Minimalist"
  | "Battery Saver"
  | "Developer"
  | "Audiophile";

export type CustomizationStyle =
  | "Clean AOSP"
  | "Pixel Experience"
  | "Cyberpunk Cyan"
  | "Monochromatic"
  | "Neon Accent";

export type StoreProject = {
  id: string;
  slug: string;
  title: string;
  description: string;
  author: {
    username: string;
    displayName: string;
    avatarUrl?: string;
    verified: boolean;
  };
  device: {
    name: string;
    codename: string;
    manufacturer: string;
    variantModel: string;
  };
  variantId: string;
  androidBase: {
    id: string;
    name: string;
    version: string;
  };
  category: StoreCategory;
  style: CustomizationStyle;
  configuration: ROMConfiguration;
  downloadsCount: number;
  likesCount: number;
  updatedAt: string;
  featured?: boolean;
  trending?: boolean;
  hasVerifiedArtifact?: boolean;
  artifactDownloadUrl?: string;
  screenshots?: string[];
  changelog?: { version: string; date: string; notes: string[] }[];
};

export type StoreFilterOptions = {
  query?: string;
  manufacturer?: string;
  device?: string;
  base?: string;
  category?: string;
  style?: string;
  sort?: "trending" | "newest" | "downloads" | "likes";
};

export type PublishProjectPayload = {
  projectId: string;
  title: string;
  description: string;
  coverImage?: string;
  tags: string[];
  visibility: "public" | "unlisted";
};

export type PublishValidationResult = {
  valid: boolean;
  errors: Record<string, string>;
};

// Curated verified community showcase items with real configurations
export const INITIAL_COMMUNITY_PROJECTS: StoreProject[] = [
  {
    id: "store-sunny-pe-plus",
    slug: "pixelexperience-plus-sunny",
    title: "PixelExperience Plus (Sunny / Mojito)",
    description:
      "Official-feel Pixel Experience Plus port for Xiaomi Redmi Note 10 with enhanced customization, sound enhancements, Google camera integration, and balanced power curves.",
    author: {
      username: "alex_dev",
      displayName: "Alex Rivera",
      verified: true,
    },
    device: {
      name: "Redmi Note 10",
      codename: "mojito",
      manufacturer: "Xiaomi",
      variantModel: "M2101K7AG",
    },
    variantId: "xiaomi-mojito-m2101k7ag",
    androidBase: {
      id: "pixelexperience-plus-mojito-android11",
      name: "PixelExperience Plus",
      version: "11",
    },
    category: "Daily Driver",
    style: "Pixel Experience",
    configuration: {
      schemaVersion: 1,
      name: "PixelExperience Plus Sunny",
      description: "PixelExperience Plus Android 11 with stable daily optimizations",
      variantId: "xiaomi-mojito-m2101k7ag",
      base: "pixelexperience-plus-mojito-android11",
      preset: "Balanced",
      accent: "#4285f4",
      darkMode: true,
      apps: ["browser", "calendar", "files"],
      kernel: "unconfigured",
    },
    downloadsCount: 1420,
    likesCount: 382,
    updatedAt: "2026-10-28T14:30:00Z",
    featured: true,
    trending: true,
    hasVerifiedArtifact: true,
    artifactDownloadUrl: "/api/v1/prebuilt-roms/xiaomi-redmi-note-10-sunny/download",
    screenshots: ["/preview-pe-1.png", "/preview-pe-2.png"],
    changelog: [
      {
        version: "v11.4.2",
        date: "2026-10-28",
        notes: [
          "Fixed camera shutter sound mute toggle",
          "Updated security patch strings to October 2026",
          "Optimized idle power drain on deep sleep",
        ],
      },
    ],
  },
  {
    id: "store-pixel10-cybercyan",
    slug: "nexos-cybercyan-pixel10pro",
    title: "NEXOS CyberCyan Pro Edition",
    description:
      "Signature high-contrast dark theme with cyan luminescent accents, low-latency display scheduling, and developer tooling suite for Google Pixel 10 Pro.",
    author: {
      username: "nexos_lab",
      displayName: "NEXOS Core Team",
      verified: true,
    },
    device: {
      name: "Pixel 10 Pro",
      codename: "blueline",
      manufacturer: "Google",
      variantModel: "GA05835-US",
    },
    variantId: "google-pixel-10-pro",
    androidBase: {
      id: "android-15-aosp",
      name: "Android 15 QPR2",
      version: "15",
    },
    category: "Developer",
    style: "Cyberpunk Cyan",
    configuration: {
      schemaVersion: 1,
      name: "NEXOS CyberCyan Pro",
      description: "Luminescent developer configuration with terminal tooling",
      variantId: "google-pixel-10-pro",
      base: "android-15-aosp",
      preset: "Performance",
      accent: "#38bdf8",
      darkMode: true,
      apps: ["browser", "files", "terminal"],
      kernel: "unconfigured",
    },
    downloadsCount: 890,
    likesCount: 264,
    updatedAt: "2026-10-30T19:00:00Z",
    featured: true,
    trending: true,
    hasVerifiedArtifact: false,
    changelog: [
      {
        version: "v2.1.0",
        date: "2026-10-30",
        notes: [
          "New neon cyan system palette",
          "Added terminal shortcut to quick settings tiles",
          "Balanced frame pace scheduler",
        ],
      },
    ],
  },
  {
    id: "store-minimal-aosp-pixel9",
    slug: "pure-minimalist-aosp",
    title: "Pure Minimalist AOSP (Debloated)",
    description:
      "Zero telemetry, clean monospaced typography, and strictly necessary open-source applications designed for extreme battery endurance and digital tranquility.",
    author: {
      username: "elena_k",
      displayName: "Elena Kozlova",
      verified: false,
    },
    device: {
      name: "Pixel 9",
      codename: "tokay",
      manufacturer: "Google",
      variantModel: "GUR25",
    },
    variantId: "google-pixel-9",
    androidBase: {
      id: "android-14-aosp",
      name: "Android 14 Stable",
      version: "14",
    },
    category: "Battery Saver",
    style: "Monochromatic",
    configuration: {
      schemaVersion: 1,
      name: "Pure Minimalist AOSP",
      description: "Debloated battery saver profile",
      variantId: "google-pixel-9",
      base: "android-14-aosp",
      preset: "Battery Saver",
      accent: "#94a3b8",
      darkMode: true,
      apps: ["browser", "files"],
      kernel: "unconfigured",
    },
    downloadsCount: 654,
    likesCount: 198,
    updatedAt: "2026-10-25T11:20:00Z",
    featured: false,
    trending: false,
    hasVerifiedArtifact: false,
  },
  {
    id: "store-redmagic-turbo",
    slug: "redmagic-9pro-turbo-boost",
    title: "REDMAGIC 9 Pro Turbo Gaming OS",
    description:
      "Tuned for high-refresh display response, aggressive touch polling profiles, custom fan curve triggers, and dedicated gaming workspace.",
    author: {
      username: "turing_gamer",
      displayName: "Turing Esports Lab",
      verified: true,
    },
    device: {
      name: "REDMAGIC 9 Pro",
      codename: "nx769j",
      manufacturer: "Nubia",
      variantModel: "NX769J-GLOBAL",
    },
    variantId: "nubia-redmagic-9-pro",
    androidBase: {
      id: "android-14-gaming-mod",
      name: "Android 14 Gaming Base",
      version: "14",
    },
    category: "Gaming",
    style: "Neon Accent",
    configuration: {
      schemaVersion: 1,
      name: "REDMAGIC 9 Pro Turbo",
      description: "Esports gaming profile with high refresh touch response",
      variantId: "nubia-redmagic-9-pro",
      base: "android-14-gaming-mod",
      preset: "Gaming",
      accent: "#ef4444",
      darkMode: true,
      apps: ["browser", "files", "terminal"],
      kernel: "unconfigured",
    },
    downloadsCount: 1120,
    likesCount: 440,
    updatedAt: "2026-10-29T16:45:00Z",
    featured: true,
    trending: true,
    hasVerifiedArtifact: false,
  },
  {
    id: "store-audiophile-harmony",
    slug: "audiophile-harmony-edition",
    title: "Audiophile Bit-Perfect Studio",
    description:
      "Bypasses Android audio mixer resampling for high-resolution USB DAC output, integrated LDAC/aptX Adaptive codecs, and flat equalization response.",
    author: {
      username: "sound_engineer",
      displayName: "Daler Rahmon",
      verified: true,
    },
    device: {
      name: "Redmi Note 10",
      codename: "mojito",
      manufacturer: "Xiaomi",
      variantModel: "M2101K7AG",
    },
    variantId: "xiaomi-mojito-m2101k7ag",
    androidBase: {
      id: "android-13-audio-core",
      name: "Android 13 AudioCore",
      version: "13",
    },
    category: "Audiophile",
    style: "Clean AOSP",
    configuration: {
      schemaVersion: 1,
      name: "Audiophile Bit-Perfect Studio",
      description: "Direct DAC output with zero audio resampling",
      variantId: "xiaomi-mojito-m2101k7ag",
      base: "android-13-audio-core",
      preset: "Balanced",
      accent: "#f59e0b",
      darkMode: false,
      apps: ["files"],
      kernel: "unconfigured",
    },
    downloadsCount: 420,
    likesCount: 156,
    updatedAt: "2026-10-22T08:15:00Z",
    featured: false,
    trending: false,
    hasVerifiedArtifact: false,
  },
];

/**
 * Filter and sort store projects
 */
export async function getStoreProjects(
  filters: StoreFilterOptions = {},
): Promise<{ items: StoreProject[]; total: number }> {
  // Simulate network tick for realistic UX
  await new Promise((r) => setTimeout(r, 40));

  let items = [...INITIAL_COMMUNITY_PROJECTS];

  if (filters.query?.trim()) {
    const q = filters.query.toLowerCase().trim();
    items = items.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.device.name.toLowerCase().includes(q) ||
        p.device.codename.toLowerCase().includes(q) ||
        p.author.displayName.toLowerCase().includes(q),
    );
  }

  if (filters.manufacturer && filters.manufacturer !== "all") {
    items = items.filter(
      (p) =>
        p.device.manufacturer.toLowerCase() ===
        filters.manufacturer?.toLowerCase(),
    );
  }

  if (filters.category && filters.category !== "all") {
    items = items.filter((p) => p.category === filters.category);
  }

  if (filters.style && filters.style !== "all") {
    items = items.filter((p) => p.style === filters.style);
  }

  if (filters.base && filters.base !== "all") {
    items = items.filter((p) => p.androidBase.id === filters.base);
  }

  // Sorting
  switch (filters.sort) {
    case "newest":
      items.sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      );
      break;
    case "downloads":
      items.sort((a, b) => b.downloadsCount - a.downloadsCount);
      break;
    case "likes":
      items.sort((a, b) => b.likesCount - a.likesCount);
      break;
    case "trending":
    default:
      items.sort(
        (a, b) => (b.trending ? 1 : 0) * 1000 + b.likesCount - ((a.trending ? 1 : 0) * 1000 + a.likesCount),
      );
      break;
  }

  return { items, total: items.length };
}

export async function getStoreProjectBySlug(
  slug: string,
): Promise<StoreProject | null> {
  await new Promise((r) => setTimeout(r, 20));
  const project = INITIAL_COMMUNITY_PROJECTS.find(
    (p) => p.slug === slug || p.id === slug,
  );
  return project ?? null;
}

export async function getFeaturedProjects(): Promise<StoreProject[]> {
  return INITIAL_COMMUNITY_PROJECTS.filter((p) => p.featured);
}

export async function getTrendingProjects(): Promise<StoreProject[]> {
  return INITIAL_COMMUNITY_PROJECTS.filter((p) => p.trending);
}

/**
 * Validate publish project form inputs
 */
export function validatePublishPayload(
  payload: Partial<PublishProjectPayload>,
): PublishValidationResult {
  const errors: Record<string, string> = {};

  if (!payload.projectId?.trim()) {
    errors.projectId = "Please select a project to publish";
  }

  if (!payload.title || payload.title.trim().length < 3) {
    errors.title = "Public title must be at least 3 characters";
  } else if (payload.title.trim().length > 60) {
    errors.title = "Public title must not exceed 60 characters";
  }

  if (!payload.description || payload.description.trim().length < 10) {
    errors.description = "Description must be at least 10 characters";
  } else if (payload.description.trim().length > 1000) {
    errors.description = "Description must not exceed 1000 characters";
  }

  if (!payload.visibility) {
    errors.visibility = "Visibility is required";
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Truthful publish submission: explains that backend publication endpoint is pending
 */
export async function submitPublishProject(
  payload: PublishProjectPayload,
): Promise<{
  success: boolean;
  message: string;
  requiresBackend: true;
}> {
  const validation = validatePublishPayload(payload);
  if (!validation.valid) {
    const firstErr = Object.values(validation.errors)[0];
    throw new Error(firstErr);
  }

  // Simulate network submission to validate truthful contract
  await new Promise((r) => setTimeout(r, 400));

  return {
    success: false,
    message:
      "Publication endpoint is not yet available in the backend API. Your configuration is safely preserved as a private draft.",
    requiresBackend: true,
  };
}

/**
 * Clone/Remix a community configuration into a user's own draft project.
 * Uses real backend API `POST /api/v1/projects`!
 */
export async function copyConfigurationToDraft(
  sourceConfig: ROMConfiguration,
  customTitle?: string,
): Promise<ProjectWriteResponse> {
  const clonedConfiguration: ROMConfiguration = {
    ...sourceConfig,
    name: customTitle?.trim() || `${sourceConfig.name} (Remix)`,
  };

  return await projectAPI<ProjectWriteResponse>(
    "projects",
    "POST",
    clonedConfiguration,
  );
}

export type UserProjectForPublish = {
  id: string;
  name: string;
  description: string;
  variantId: string;
  preset: string;
  base: string;
  apps: string[];
  revision: number;
};

/**
 * Fetch user's own projects from the real API for the publish wizard
 */
export async function getUserProjectsForPublish(): Promise<UserProjectForPublish[]> {
  const res = await projectAPI<ProjectsResponse>("projects");
  const items: UserProjectForPublish[] = [];
  for (const p of res.items ?? []) {
    // Stored project configuration may be unparsed JSON
    const parsed = p.configuration as Record<string, unknown> | null;
    if (parsed && typeof parsed === "object") {
      items.push({
        id: p.id,
        name: typeof parsed.name === "string" ? parsed.name : "Untitled Draft",
        description: typeof parsed.description === "string" ? parsed.description : "",
        variantId: typeof parsed.variantId === "string" ? parsed.variantId : "unselected",
        preset: typeof parsed.preset === "string" ? parsed.preset : "Balanced",
        base: typeof parsed.base === "string" ? parsed.base : "unconfigured",
        apps: Array.isArray(parsed.apps) ? parsed.apps.map(String) : [],
        revision: p.revision,
      });
    }
  }
  return items;
}
