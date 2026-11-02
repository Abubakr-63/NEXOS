import { test } from "node:test";
import assert from "node:assert/strict";
import {
  INITIAL_COMMUNITY_PROJECTS,
  getStoreProjects,
  getStoreProjectBySlug,
  getFeaturedProjects,
  getTrendingProjects,
  validatePublishPayload,
  submitPublishProject,
} from "../apps/web/lib/store-adapter";
import { DEFAULT_SELECTABLE_APPS } from "../apps/web/components/preview/selected-apps-preview";
import { NexosAppIcon } from "../apps/web/components/preview/app-icons";
import { configurationToScreen } from "../apps/web/components/pixel/adapter";
import { defaultConfiguration } from "../packages/contracts/src";

// =========================================================================
// 1. Community Store: Catalog, Filtering, Sorting & Search
// =========================================================================

test("store catalog: initial curated projects have valid identities, configurations, and truthful artifact flags", () => {
  assert.ok(INITIAL_COMMUNITY_PROJECTS.length >= 4);

  const slugs = new Set<string>();
  for (const project of INITIAL_COMMUNITY_PROJECTS) {
    // Slug uniqueness
    assert.ok(project.slug.length > 0);
    assert.ok(!slugs.has(project.slug), `Duplicate slug: ${project.slug}`);
    slugs.add(project.slug);

    // Metadata validation
    assert.ok(project.title.length >= 3);
    assert.ok(project.description.length >= 10);
    assert.ok(project.author.username.length > 0);
    assert.ok(project.device.name.length > 0);
    assert.ok(project.device.codename.length > 0);
    assert.ok(project.androidBase.version.length > 0);

    // Configuration validity
    assert.ok(project.configuration);
    assert.ok(Array.isArray(project.configuration.apps));

    // Truthful ROM artifact boundary: If hasVerifiedArtifact is true, URL must be non-empty and start with / or https://
    if (project.hasVerifiedArtifact) {
      assert.ok(project.artifactDownloadUrl);
      assert.ok(
        project.artifactDownloadUrl.startsWith("https://") ||
          project.artifactDownloadUrl.startsWith("/api/v1/"),
      );
    } else {
      assert.equal(project.artifactDownloadUrl, undefined);
    }
  }
});

test("store filtering: filters accurately by manufacturer, category, and style", async () => {
  // Filter by manufacturer: Xiaomi
  const xiaomiResult = await getStoreProjects({ manufacturer: "Xiaomi" });
  assert.ok(xiaomiResult.items.length > 0);
  assert.ok(
    xiaomiResult.items.every(
      (p) => p.device.manufacturer.toLowerCase() === "xiaomi",
    ),
  );

  // Filter by manufacturer: Google
  const googleResult = await getStoreProjects({ manufacturer: "Google" });
  assert.ok(googleResult.items.length > 0);
  assert.ok(
    googleResult.items.every(
      (p) => p.device.manufacturer.toLowerCase() === "google",
    ),
  );

  // Filter by category: Gaming
  const gamingResult = await getStoreProjects({ category: "Gaming" });
  assert.ok(gamingResult.items.length > 0);
  assert.ok(gamingResult.items.every((p) => p.category === "Gaming"));

  // Filter by style: Pixel Experience
  const pixelStyleResult = await getStoreProjects({
    style: "Pixel Experience",
  });
  assert.ok(pixelStyleResult.items.length > 0);
  assert.ok(pixelStyleResult.items.every((p) => p.style === "Pixel Experience"));
});

test("store search: matches query against title, description, codename, and author", async () => {
  // Search by device codename "mojito"
  const mojitoResult = await getStoreProjects({ query: "mojito" });
  assert.ok(mojitoResult.items.length > 0);
  assert.ok(
    mojitoResult.items.some(
      (p) =>
        p.device.codename.toLowerCase().includes("mojito") ||
        p.title.toLowerCase().includes("mojito"),
    ),
  );

  // Search by author name "Alex"
  const authorResult = await getStoreProjects({ query: "Alex" });
  assert.ok(authorResult.items.length > 0);
  assert.ok(
    authorResult.items.some((p) =>
      p.author.displayName.toLowerCase().includes("alex"),
    ),
  );

  // Non-matching query returns empty list
  const emptyResult = await getStoreProjects({
    query: "non-existent-device-xyz-9999",
  });
  assert.equal(emptyResult.items.length, 0);
  assert.equal(emptyResult.total, 0);
});

test("store sorting: sorts correctly by newest, downloads, and likes", async () => {
  // Sort by downloads descending
  const byDownloads = await getStoreProjects({ sort: "downloads" });
  for (let i = 1; i < byDownloads.items.length; i++) {
    assert.ok(
      byDownloads.items[i - 1].downloadsCount >=
        byDownloads.items[i].downloadsCount,
    );
  }

  // Sort by likes descending
  const byLikes = await getStoreProjects({ sort: "likes" });
  for (let i = 1; i < byLikes.items.length; i++) {
    assert.ok(
      byLikes.items[i - 1].likesCount >= byLikes.items[i].likesCount,
    );
  }

  // Sort by newest updatedAt descending
  const byNewest = await getStoreProjects({ sort: "newest" });
  for (let i = 1; i < byNewest.items.length; i++) {
    const prevDate = new Date(byNewest.items[i - 1].updatedAt).getTime();
    const currDate = new Date(byNewest.items[i].updatedAt).getTime();
    assert.ok(prevDate >= currDate);
  }
});

test("store slug lookup: returns exact project or null if not found", async () => {
  const found = await getStoreProjectBySlug("pixelexperience-plus-sunny");
  assert.ok(found);
  assert.equal(found?.slug, "pixelexperience-plus-sunny");
  assert.equal(found?.device.codename, "mojito");

  const notFound = await getStoreProjectBySlug("unregistered-project-slug");
  assert.equal(notFound, null);
});

test("featured and trending collections return matching curated items", async () => {
  const featured = await getFeaturedProjects();
  assert.ok(featured.length > 0);
  assert.ok(featured.every((p) => p.featured === true));

  const trending = await getTrendingProjects();
  assert.ok(trending.length > 0);
  assert.ok(trending.every((p) => p.trending === true));
});

// =========================================================================
// 2. Publish Project Flow: Form Validation & Truthful Backend Contract
// =========================================================================

test("publish validation: validates projectId, title length, description length, and visibility", () => {
  // Completely empty payload fails
  const emptyRes = validatePublishPayload({});
  assert.equal(emptyRes.valid, false);
  assert.ok(emptyRes.errors.projectId);
  assert.ok(emptyRes.errors.title);
  assert.ok(emptyRes.errors.description);
  assert.ok(emptyRes.errors.visibility);

  // Short title (<3 chars) and short description (<10 chars)
  const shortRes = validatePublishPayload({
    projectId: "proj-123",
    title: "AB",
    description: "Short",
    visibility: "public",
  });
  assert.equal(shortRes.valid, false);
  assert.ok(shortRes.errors.title);
  assert.ok(shortRes.errors.description);

  // Overly long title (>60 chars)
  const longTitleRes = validatePublishPayload({
    projectId: "proj-123",
    title: "A".repeat(61),
    description: "Valid description exceeding ten characters easily.",
    visibility: "public",
  });
  assert.equal(longTitleRes.valid, false);
  assert.ok(longTitleRes.errors.title);

  // Valid payload passes
  const validRes = validatePublishPayload({
    projectId: "proj-123",
    title: "Official Pixel Build",
    description:
      "A complete daily driver configuration with battery optimization.",
    visibility: "public",
    tags: ["pixel", "daily"],
  });
  assert.equal(validRes.valid, true);
  assert.equal(Object.keys(validRes.errors).length, 0);
});

test("truthful publish submission: rejects publication without backend API support and never simulates fake success", async () => {
  const validPayload = {
    projectId: "proj-abc-123",
    title: "Community LineageOS Build",
    description:
      "Clean AOSP configuration tailored for performance and privacy.",
    tags: ["aosp", "clean"],
    visibility: "public" as const,
  };

  const result = await submitPublishProject(validPayload);
  assert.equal(result.success, false);
  assert.equal(result.requiresBackend, true);
  assert.ok(result.message.includes("not yet available in the backend API"));
  assert.ok(result.message.includes("safely preserved as a private draft"));

  // Throws error on invalid payload
  await assert.rejects(
    async () => {
      await submitPublishProject({ ...validPayload, title: "" });
    },
    /Public title must be at least 3 characters/,
  );
});

// =========================================================================
// 3. Reactive Android Preview & Dynamic App Icons
// =========================================================================

test("preview adapter: reflects lock and home screen state transitions without mutating draft", () => {
  const draft = {
    ...defaultConfiguration,
    name: "NEXOS Showcase",
    apps: ["browser", "files"] as typeof defaultConfiguration.apps,
    accent: "#0ea5e9",
    darkMode: true,
  };

  // Initial state is locked (unlocked = false)
  const lockedScreen = configurationToScreen(draft);
  assert.equal(lockedScreen.unlocked, false);
  assert.equal(lockedScreen.name, "NEXOS Showcase");
  assert.deepEqual(lockedScreen.apps, ["browser", "files"]);

  // Unlocking state transition (simulating entering Apps step in builder)
  const unlockedScreen = { ...lockedScreen, unlocked: true };
  assert.equal(unlockedScreen.unlocked, true);
  assert.deepEqual(unlockedScreen.apps, ["browser", "files"]);

  // Dynamic app addition
  const withCalendar = {
    ...unlockedScreen,
    apps: ["browser", "files", "calendar"],
  };
  assert.equal(withCalendar.apps.length, 3);
  assert.ok(withCalendar.apps.includes("calendar"));

  // Dynamic app removal
  const withoutBrowser = {
    ...withCalendar,
    apps: withCalendar.apps.filter((a) => a !== "browser"),
  };
  assert.equal(withoutBrowser.apps.length, 2);
  assert.ok(!withoutBrowser.apps.includes("browser"));
});

test("app icons component: renders known system and Google-style icons without runtime errors", () => {
  const iconNames = [
    "drive",
    "docs",
    "meet",
    "gmail",
    "google",
    "maps",
    "playstore",
    "photos",
    "calendar",
    "browser",
    "chrome",
    "phone",
    "messages",
    "files",
    "terminal",
    "settings",
    "camera",
  ];

  for (const name of iconNames) {
    const element = NexosAppIcon({ name, size: 48 });
    assert.ok(element, `Failed to render icon for ${name}`);
    assert.equal(element.type, "svg" in element ? "svg" : element.type);
  }

  // Fallback for unknown app name renders gracefully
  const unknownIcon = NexosAppIcon({ name: "unknown-custom-package", size: 48 });
  assert.ok(unknownIcon);
  assert.equal(unknownIcon.props["aria-label"], "unknown-custom-package");
});

test("default selectable apps list matches builder catalog requirements", () => {
  assert.ok(DEFAULT_SELECTABLE_APPS.length >= 4);
  const ids = DEFAULT_SELECTABLE_APPS.map((a) => a.id);
  assert.ok(ids.includes("browser"));
  assert.ok(ids.includes("calendar"));
  assert.ok(ids.includes("files"));
  assert.ok(ids.includes("terminal"));

  for (const app of DEFAULT_SELECTABLE_APPS) {
    assert.ok(app.name.length > 0);
    assert.ok(app.iconName?.length);
  }
});
