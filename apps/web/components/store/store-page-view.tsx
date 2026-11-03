"use client";

import React, { useEffect, useState } from "react";
import { StoreHeader } from "./store-header";
import { StoreGrid } from "./store-grid";
import {
  getStoreProjects,
  getFeaturedProjects,
  type StoreProject,
  type StoreFilterOptions,
} from "@/lib/store-adapter";
import "./store.css";

export function StorePageView() {
  const [query, setQuery] = useState("");
  const [manufacturer, setManufacturer] = useState("all");
  const [category, setCategory] = useState("all");
  const [sort, setSort] = useState<StoreFilterOptions["sort"]>("trending");

  const [projects, setProjects] = useState<StoreProject[]>([]);
  const [featured, setFeatured] = useState<StoreProject[]>([]);
  const [loading, setLoading] = useState(true);

  // Load featured projects once
  useEffect(() => {
    getFeaturedProjects().then(setFeatured);
  }, []);

  // Filter projects whenever query or filters change
  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      getStoreProjects({
        query,
        manufacturer,
        category,
        sort,
      })
        .then((res) => {
          if (active) {
            setProjects(res.items);
            setLoading(false);
          }
        })
        .catch(() => {
          if (active) setLoading(false);
        });
    }, 150);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query, manufacturer, category, sort]);

  function handleQueryChange(q: string) {
    setQuery(q);
  }

  function handleManufacturerChange(m: string) {
    setManufacturer(m);
    setLoading(true);
  }

  function handleCategoryChange(c: string) {
    setCategory(c);
    setLoading(true);
  }

  function handleSortChange(s: StoreFilterOptions["sort"]) {
    setSort(s);
    setLoading(true);
  }

  function handleClearFilters() {
    setQuery("");
    setManufacturer("all");
    setCategory("all");
    setSort("trending");
    setLoading(true);
  }

  const isFiltered = query !== "" || manufacturer !== "all" || category !== "all";

  return (
    <div className="store-page">
      <StoreHeader
        searchQuery={query}
        onSearchChange={handleQueryChange}
        manufacturer={manufacturer}
        onManufacturerChange={handleManufacturerChange}
        category={category}
        onCategoryChange={handleCategoryChange}
        sort={sort ?? "trending"}
        onSortChange={handleSortChange}
      />

      <StoreGrid
        projects={projects}
        featuredProjects={featured}
        loading={loading}
        onClearFilters={handleClearFilters}
        isFiltered={isFiltered}
      />
    </div>
  );
}
