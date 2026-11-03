"use client";

import React, { useState } from "react";
import type { StoreProject } from "@/lib/store-adapter";
import { StoreCard } from "./store-card";
import { Sparkles, TrendingUp, Grid, Inbox } from "lucide-react";
import { useTranslation } from "@/lib/i18n";

export type StoreGridProps = {
  projects: StoreProject[];
  featuredProjects: StoreProject[];
  loading?: boolean;
  onClearFilters?: () => void;
  isFiltered?: boolean;
};

export function StoreGrid({
  projects,
  featuredProjects,
  loading = false,
  onClearFilters,
  isFiltered = false,
}: StoreGridProps) {
  const { t } = useTranslation("store");
  const [bookmarks, setBookmarks] = useState<Set<string>>(new Set());

  function handleBookmarkToggle(id: string) {
    setBookmarks((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (loading && projects.length === 0) {
    return (
      <div className="store-loading-state" role="status" aria-label="Loading projects">
        <p className="text-slate-400 text-sm mb-4">{t("loadingStore")}</p>
        <div className="store-grid">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="store-card animate-pulse opacity-50" style={{ height: 320 }} />
          ))}
        </div>
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="text-center py-16 px-4 bg-slate-900/40 rounded-2xl border border-white/5 my-8">
        <Inbox size={48} className="mx-auto text-slate-500 mb-4" />
        <h3 className="text-lg font-semibold text-slate-200 mb-2">{t("noProjectsFound")}</h3>
        <p className="text-sm text-slate-400 max-w-md mx-auto mb-6">
          {t("noProjectsDescription")}
        </p>
        {isFiltered && (
          <button type="button" className="store-btn secondary" onClick={onClearFilters}>
            {t("clearFilters")}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="store-sections">
      {/* Featured Section (when not actively searching) */}
      {!isFiltered && featuredProjects.length > 0 && (
        <section className="mb-10" aria-labelledby="featured-projects-heading">
          <h2 id="featured-projects-heading" className="store-section-title">
            <Sparkles size={20} />
            <span>{t("featuredProjects")}</span>
          </h2>
          <div className="store-grid">
            {featuredProjects.map((p) => (
              <StoreCard
                key={p.id}
                project={p}
                isBookmarked={bookmarks.has(p.id)}
                onBookmarkToggle={handleBookmarkToggle}
              />
            ))}
          </div>
        </section>
      )}

      {/* Main Catalog Grid */}
      <section aria-labelledby="all-projects-heading">
        <h2 id="all-projects-heading" className="store-section-title">
          {isFiltered ? <Grid size={20} /> : <TrendingUp size={20} />}
          <span>{isFiltered ? t("filteredProjects") : t("allProjects")}</span>
          <span className="text-xs font-normal text-slate-400 ml-2">
            ({projects.length})
          </span>
        </h2>
        <div className="store-grid">
          {projects.map((p) => (
            <StoreCard
              key={p.id}
              project={p}
              isBookmarked={bookmarks.has(p.id)}
              onBookmarkToggle={handleBookmarkToggle}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
