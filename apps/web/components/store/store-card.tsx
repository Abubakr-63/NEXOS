"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { StoreProject } from "../../lib/store-adapter";
import { copyConfigurationToDraft } from "../../lib/store-adapter";
import {
  Download,
  Heart,
  Smartphone,
  Layers,
  ArrowRight,
  Bookmark,
  Sparkles,
  CheckCircle2,
  Copy,
} from "lucide-react";
import { useTranslation } from "../../lib/i18n";

export const StoreCard = React.memo(function StoreCard({
  project,
  onBookmarkToggle,
  isBookmarked = false,
}: {
  project: StoreProject;
  onBookmarkToggle?: (projectId: string) => void;
  isBookmarked?: boolean;
}) {
  const router = useRouter();
  const { t } = useTranslation("store");

  const [copying, setCopying] = useState(false);
  const [copyError, setCopyError] = useState("");
  const [likes, setLikes] = useState(project.likesCount);
  const [liked, setLiked] = useState(false);

  async function handleUseConfiguration(e: React.MouseEvent) {
    e.preventDefault();
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

  function handleLike(e: React.MouseEvent) {
    e.preventDefault();
    if (!liked) {
      setLikes((l) => l + 1);
      setLiked(true);
    } else {
      setLikes((l) => l - 1);
      setLiked(false);
    }
  }

  function handleBookmark(e: React.MouseEvent) {
    e.preventDefault();
    onBookmarkToggle?.(project.id);
  }

  return (
    <div
      className="store-card"
      style={{ "--card-accent": project.configuration.accent } as React.CSSProperties}
    >
      {/* Top Banner with Badges */}
      <div className="store-card-banner">
        <div className="badge-row">
          <span className="store-badge">{project.category}</span>
          <span className="store-badge">{project.style}</span>
          {project.featured && (
            <span className="store-badge featured">
              <Sparkles size={11} style={{ display: "inline", marginRight: 3 }} />
              {t("featuredBadge")}
            </span>
          )}
          {project.hasVerifiedArtifact && (
            <span className="store-badge verified">
              <CheckCircle2 size={11} style={{ display: "inline", marginRight: 3 }} />
              {t("romVerifiedBadge")}
            </span>
          )}
        </div>
      </div>

      {/* Card Content Body */}
      <div className="store-card-body">
        {/* Author info */}
        <div className="author-chip">
          <span className="author-avatar" aria-hidden="true">
            {project.author.displayName.slice(0, 1).toUpperCase()}
          </span>
          <span className="author-name">{project.author.displayName}</span>
          {project.author.verified && (
            <CheckCircle2
              size={13}
              className="author-verified-icon"
              aria-label="Verified Creator"
            />
          )}
        </div>

        {/* Project Title & Description */}
        <h3 className="store-card-title">
          <Link href={`/store/${project.slug}`} className="hover:underline">
            {project.title}
          </Link>
        </h3>
        <p className="store-card-desc">{project.description}</p>

        {/* Specs: Device & Base */}
        <div className="store-card-specs">
          <span className="spec-pill" title="Target Device">
            <Smartphone size={13} />
            {project.device.name}
          </span>
          <span className="spec-pill" title="Android Base">
            <Layers size={13} />
            {project.androidBase.name}
          </span>
        </div>

        {/* Metrics: Downloads & Likes */}
        <div className="store-card-metrics">
          <div className="metric-item">
            <Download size={13} />
            <span>{project.downloadsCount.toLocaleString()} {t("downloads")}</span>
          </div>
          <button
            type="button"
            className={`metric-item hover:opacity-80 transition-opacity bg-transparent border-0 cursor-pointer ${liked ? "text-rose-400" : ""}`}
            onClick={handleLike}
            aria-label={`${likes} likes`}
          >
            <Heart size={13} fill={liked ? "currentColor" : "none"} />
            <span>{likes}</span>
          </button>
        </div>

        {/* Error notification if copy fails */}
        {copyError && <p className="text-xs text-rose-400 mb-2">{copyError}</p>}

        {/* Card Actions with Icons + Labels */}
        <div className="store-card-actions">
          <Link href={`/store/${project.slug}`} className="store-btn secondary">
            <span>{t("viewDetails")}</span>
            <ArrowRight size={14} />
          </Link>

          <button
            type="button"
            className="store-btn primary"
            onClick={handleUseConfiguration}
            disabled={copying}
            title={t("useConfigTitle")}
          >
            <Copy size={14} />
            <span>{copying ? t("copyingConfig") : t("useConfiguration")}</span>
          </button>

          <button
            type="button"
            className={`store-btn secondary icon-only ${isBookmarked ? "bookmarked" : ""}`}
            onClick={handleBookmark}
            title={isBookmarked ? t("savedProject") : t("saveProject")}
            aria-label={isBookmarked ? t("savedProject") : t("saveProject")}
            aria-pressed={isBookmarked}
          >
            <Bookmark size={15} fill={isBookmarked ? "currentColor" : "none"} />
          </button>
        </div>
      </div>
    </div>
  );
});
