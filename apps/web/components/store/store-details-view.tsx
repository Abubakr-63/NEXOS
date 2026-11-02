"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { StoreProject } from "@/lib/store-adapter";
import { copyConfigurationToDraft } from "@/lib/store-adapter";
import { AndroidPhonePreview } from "../preview";
import { NexosAppIcon } from "../preview/app-icons";
import {
  Download,
  Copy,
  Bookmark,
  CheckCircle2,
  Smartphone,
  Layers,
  Sparkles,
  ArrowLeft,
  AlertTriangle,
  History,
} from "lucide-react";
import { useTranslation } from "@/lib/i18n";

export function StoreDetailsView({ project }: { project: StoreProject }) {
  const router = useRouter();
  const { t } = useTranslation("store");

  const [copying, setCopying] = useState(false);
  const [copyError, setCopyError] = useState("");
  const [bookmarked, setBookmarked] = useState(false);
  const [unlockedPhone, setUnlockedPhone] = useState(true);

  async function handleUseConfiguration() {
    if (copying) return;
    setCopying(true);
    setCopyError("");
    try {
      const draft = await copyConfigurationToDraft(project.configuration);
      router.push(`/builder/${draft.id}?importedFrom=${encodeURIComponent(project.slug)}`);
    } catch (err) {
      setCopyError(err instanceof Error ? err.message : "Failed to copy configuration");
      setCopying(false);
    }
  }

  return (
    <div className="store-page">
      {/* Back button */}
      <div className="mb-6">
        <Link href="/store" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors">
          <ArrowLeft size={16} />
          <span>{t("backToStore")}</span>
        </Link>
      </div>

      <div className="project-details-container">
        {/* Left Column: Details */}
        <div className="details-main">
          <div className="details-hero-card">
            <div className="details-hero-header">
              <div className="badge-row">
                <span className="store-badge">{project.category}</span>
                <span className="store-badge">{project.style}</span>
                {project.featured && (
                  <span className="store-badge featured">
                    <Sparkles size={12} className="inline mr-1" />
                    {t("featuredBadge")}
                  </span>
                )}
                {project.hasVerifiedArtifact && (
                  <span className="store-badge verified">
                    <CheckCircle2 size={12} className="inline mr-1" />
                    {t("romVerifiedBadge")}
                  </span>
                )}
              </div>

              {/* Author Chip */}
              <div className="author-chip">
                <span className="author-avatar">
                  {project.author.displayName.slice(0, 1).toUpperCase()}
                </span>
                <span className="author-name">{project.author.displayName}</span>
                {project.author.verified && (
                  <CheckCircle2 size={14} className="author-verified-icon" />
                )}
              </div>
            </div>

            <h1 className="details-title">{project.title}</h1>
            <p className="details-desc">{project.description}</p>

            {/* Specifications Grid */}
            <div className="details-spec-grid">
              <div className="spec-card">
                <span className="spec-card-label">{t("targetDevice")}</span>
                <div className="flex items-center gap-2 mt-1">
                  <Smartphone size={16} className="text-sky-400" />
                  <span className="spec-card-value">
                    {project.device.manufacturer} {project.device.name}
                  </span>
                </div>
                <span className="text-xs text-slate-400 block mt-1">
                  Model: {project.device.variantModel} ({project.device.codename})
                </span>
              </div>

              <div className="spec-card">
                <span className="spec-card-label">{t("androidBase")}</span>
                <div className="flex items-center gap-2 mt-1">
                  <Layers size={16} className="text-sky-400" />
                  <span className="spec-card-value">{project.androidBase.name}</span>
                </div>
                <span className="text-xs text-slate-400 block mt-1">
                  Android {project.androidBase.version}
                </span>
              </div>

              <div className="spec-card">
                <span className="spec-card-label">{t("performancePreset")}</span>
                <span className="spec-card-value block mt-1">
                  {project.configuration.preset}
                </span>
                <span className="text-xs text-slate-400 block mt-1">
                  {project.configuration.darkMode ? "Dark Mode" : "Light Mode"}
                </span>
              </div>

              <div className="spec-card">
                <span className="spec-card-label">{t("accentColor")}</span>
                <div className="flex items-center gap-2 mt-1">
                  <span
                    className="w-4 h-4 rounded-full border border-white/20 inline-block"
                    style={{ backgroundColor: project.configuration.accent }}
                  />
                  <span className="spec-card-value">{project.configuration.accent}</span>
                </div>
              </div>
            </div>

            {/* Included Applications */}
            <div className="my-6">
              <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-3">
                {t("includedApplications")}
              </h3>
              <div className="flex flex-wrap gap-3">
                {project.configuration.apps.map((app) => (
                  <div
                    key={app}
                    className="flex items-center gap-2.5 px-3 py-2 bg-slate-900/60 border border-white/10 rounded-xl"
                  >
                    <NexosAppIcon name={app} size={28} />
                    <span className="text-sm font-medium text-slate-200 capitalize">
                      {app}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Truthful Compilation Notice */}
            <div className="truthful-notice-banner">
              <AlertTriangle size={18} />
              <div>
                <strong>{t("truthfulNoticeTitle")}</strong>
                <p className="mt-1 text-xs text-slate-400">
                  {t("truthfulNoticeText")}
                </p>
              </div>
            </div>

            {/* Action Bar */}
            <div className="details-actions-bar">
              <button
                type="button"
                className="store-btn primary flex-1"
                onClick={handleUseConfiguration}
                disabled={copying}
              >
                <Copy size={16} />
                <span>{copying ? t("copyingConfig") : t("useConfiguration")}</span>
              </button>

              {project.hasVerifiedArtifact && project.artifactDownloadUrl ? (
                <a
                  href={project.artifactDownloadUrl}
                  className="store-btn secondary"
                  download
                >
                  <Download size={16} />
                  <span>{t("downloadRomZip")}</span>
                </a>
              ) : (
                <button
                  type="button"
                  className="store-btn secondary opacity-60 cursor-not-allowed"
                  disabled
                  title={t("downloadUnavailableTooltip")}
                >
                  <Download size={16} />
                  <span>{t("downloadRomUnavailable")}</span>
                </button>
              )}

              <button
                type="button"
                className={`store-btn secondary icon-only ${bookmarked ? "bookmarked" : ""}`}
                onClick={() => setBookmarked(!bookmarked)}
                aria-pressed={bookmarked}
                title={bookmarked ? t("savedProject") : t("saveProject")}
              >
                <Bookmark size={18} fill={bookmarked ? "currentColor" : "none"} />
              </button>
            </div>

            {copyError && <p className="text-xs text-rose-400 mt-2">{copyError}</p>}
          </div>

          {/* Changelog Section */}
          {project.changelog && project.changelog.length > 0 && (
            <div className="bg-slate-900/60 border border-white/10 rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <History size={18} className="text-sky-400" />
                <h3 className="text-base font-semibold text-slate-200">{t("changelogTitle")}</h3>
              </div>
              <div className="space-y-4">
                {project.changelog.map((log) => (
                  <div key={log.version} className="border-l-2 border-sky-500/40 pl-4 py-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-sm text-sky-300">{log.version}</span>
                      <span className="text-xs text-slate-500">· {log.date}</span>
                    </div>
                    <ul className="list-disc list-inside text-xs text-slate-400 space-y-1">
                      {log.notes.map((n, i) => (
                        <li key={i}>{n}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Interactive Phone Preview */}
        <aside className="sticky top-8">
          <div className="text-center mb-3">
            <span className="craft-kicker">{t("interactivePreview")}</span>
          </div>
          <AndroidPhonePreview
            configuration={project.configuration}
            unlocked={unlockedPhone}
            interactive={true}
            contextText={`${project.device.name} · ${project.androidBase.name}`}
          />
          <div className="text-center mt-3">
            <button
              type="button"
              className="text-xs text-sky-400 hover:underline"
              onClick={() => setUnlockedPhone(!unlockedPhone)}
            >
              {unlockedPhone ? t("lockPreviewPhone") : t("unlockPreviewPhone")}
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}
