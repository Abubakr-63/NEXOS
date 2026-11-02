"use client";

import React from "react";
import Link from "next/link";
import { Store, Upload, Search } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import type { StoreFilterOptions } from "@/lib/store-adapter";

export type StoreHeaderProps = {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  manufacturer: string;
  onManufacturerChange: (m: string) => void;
  category: string;
  onCategoryChange: (c: string) => void;
  sort: string;
  onSortChange: (s: StoreFilterOptions["sort"]) => void;
};

export function StoreHeader({
  searchQuery,
  onSearchChange,
  manufacturer,
  onManufacturerChange,
  category,
  onCategoryChange,
  sort,
  onSortChange,
}: StoreHeaderProps) {
  const { t } = useTranslation("store");

  return (
    <div className="store-header-container">
      <header className="store-header">
        <div className="store-header-info">
          <span className="craft-kicker flex items-center gap-1.5">
            <Store size={14} className="text-sky-400" />
            {t("headerKicker")}
          </span>
          <h1>{t("headerTitle")}</h1>
          <p>{t("headerSubtitle")}</p>
        </div>

        <div className="store-header-actions">
          <Link href="/store/publish" className="store-btn primary" title={t("publishProject")}>
            <Upload size={16} />
            <span>{t("publishProject")}</span>
          </Link>
        </div>
      </header>

      {/* Toolbar: Search & Quick Filters */}
      <div className="store-toolbar" role="region" aria-label="Store search and filters">
        <div className="store-search-box">
          <Search size={16} className="text-slate-400" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={t("searchPlaceholder")}
            aria-label={t("searchPlaceholder")}
          />
        </div>

        <div className="store-filter-group">
          {/* Manufacturer filter */}
          <select
            className="store-select"
            value={manufacturer}
            onChange={(e) => onManufacturerChange(e.target.value)}
            aria-label="Filter by manufacturer"
          >
            <option value="all">{t("allManufacturers")}</option>
            <option value="Google">Google</option>
            <option value="Xiaomi">Xiaomi</option>
            <option value="Nubia">Nubia</option>
          </select>

          {/* Category filter */}
          <select
            className="store-select"
            value={category}
            onChange={(e) => onCategoryChange(e.target.value)}
            aria-label="Filter by category"
          >
            <option value="all">{t("allCategories")}</option>
            <option value="Daily Driver">{t("categoryDailyDriver")}</option>
            <option value="Gaming">{t("categoryGaming")}</option>
            <option value="Minimalist">{t("categoryMinimalist")}</option>
            <option value="Battery Saver">{t("categoryBatterySaver")}</option>
            <option value="Developer">{t("categoryDeveloper")}</option>
            <option value="Audiophile">{t("categoryAudiophile")}</option>
          </select>

          {/* Sort order */}
          <select
            className="store-select"
            value={sort}
            onChange={(e) => onSortChange(e.target.value as StoreFilterOptions["sort"])}
            aria-label="Sort projects"
          >
            <option value="trending">{t("sortTrending")}</option>
            <option value="newest">{t("sortNewest")}</option>
            <option value="downloads">{t("sortDownloads")}</option>
            <option value="likes">{t("sortLikes")}</option>
          </select>
        </div>
      </div>
    </div>
  );
}
