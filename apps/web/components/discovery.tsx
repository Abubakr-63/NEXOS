"use client";
import Link from "next/link";
import { useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Search,
  SlidersHorizontal,
  Smartphone,
  Layers,
  Wrench,
  Cpu,
  GitBranch,
  Check,
  X,
} from "lucide-react";
import { Badge } from "@rom-hub/ui";
import { projects, devices } from "@/lib/catalog";
const tabs = ["All projects", "ROMs", "Recoveries", "Kernels"];
export function Discovery({ section = "overview" }: { section?: string }) {
  const initial =
    section === "roms"
      ? "ROMs"
      : section === "recoveries"
        ? "Recoveries"
        : section === "kernels"
          ? "Kernels"
          : "All projects";
  const [tab, setTab] = useState(initial);
  const [query, setQuery] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [channel, setChannel] = useState("All channels");
  const [sort, setSort] = useState("recent");
  const [device, setDevice] = useState("");
  const kind =
    tab === "ROMs"
      ? "ROM"
      : tab === "Recoveries"
        ? "RECOVERY"
        : tab === "Kernels"
          ? "KERNEL"
          : "";
  const results = projects
    .filter(
      (p) =>
        (!kind || p.kind === kind) &&
        (!query ||
          `${p.name} ${p.tags.join(" ")}`
            .toLowerCase()
            .includes(query.toLowerCase())) &&
        (channel === "All channels" || p.channel === channel) &&
        (!device || p.device === device),
    )
    .sort((a, b) =>
      sort === "name"
        ? a.name.localeCompare(b.name)
        : b.date.localeCompare(a.date),
    );
  const overview = section === "overview";
  return (
    <div className="page-content">
      <div className="page-heading">
        <div>
          <div className="eyebrow">
            <span /> THE ANDROID DEVELOPMENT ECOSYSTEM
          </div>
          <h1>
            {overview
              ? "Your device. More possibilities."
              : section === "explore"
                ? "Find your next experience."
                : `Explore ${initial.toLowerCase()}.`}
          </h1>
          <p>
            Discover independent Android projects. Find your community. Build
            what’s next.
          </p>
        </div>
        <Link className="button secondary heading-action" href="/studio">
          <CodeIcon />
          Developer Studio
          <ArrowUpRight size={15} />
        </Link>
      </div>
      {overview && (
        <section className="hero">
          <div className="hero-grid" />
          <div className="hero-copy">
            <Badge className="hero-badge">
              <span className="status-dot" /> OPEN SOURCE. OPEN POSSIBILITIES.
            </Badge>
            <h2>
              A new life for
              <br />
              the device you love<span>.</span>
            </h2>
            <p>
              Go beyond stock. Explore ROMs, recoveries, and kernels
              <br className="desktop-break" /> built by people who believe your
              device should be yours.
            </p>
            <div className="hero-actions">
              <Link className="button primary" href="/explore">
                Explore projects <ArrowRight size={17} />
              </Link>
              <Link className="hero-link" href="/devices">
                <Smartphone size={17} />
                Find your device
              </Link>
            </div>
            <span className="hero-note">
              Community powered. Independently built.
            </span>
          </div>
          <div className="hero-art" aria-hidden="true">
            <div className="orbit orbit-one" />
            <div className="orbit orbit-two" />
            <div className="orbit orbit-three" />
            <div className="art-cross cross-one">+</div>
            <div className="art-cross cross-two">+</div>
            <div className="floating-chip chip-android">
              ANDROID <span>↗</span>
            </div>
            <div className="phone phone-back">
              <div className="phone-camera" />
            </div>
            <div className="phone phone-front">
              <div className="phone-camera" />
              <div className="phone-screen">
                <div className="phone-time">
                  09<span>:</span>41
                </div>
                <div className="phone-date">TUESDAY, OCTOBER 27</div>
                <div className="screen-orb" />
                <div className="phone-dock">
                  <span />
                  <span />
                  <span />
                  <span />
                </div>
                <div className="phone-line" />
              </div>
            </div>
            <div className="floating-chip chip-freedom">
              <span className="status-dot" /> Made to be yours.
            </div>
            <span className="art-caption">UNLOCK A DIFFERENT PERSPECTIVE</span>
          </div>
        </section>
      )}
      <div className="catalog-stats">
        {[
          {
            icon: Layers,
            title: "Custom ROMs",
            text: "A fresh take on Android",
            count: "04",
            href: "/roms",
          },
          {
            icon: Wrench,
            title: "Recoveries",
            text: "Tools for a clean start",
            count: "01",
            href: "/recoveries",
          },
          {
            icon: Cpu,
            title: "Kernels",
            text: "Closer to the hardware",
            count: "01",
            href: "/kernels",
          },
          {
            icon: Smartphone,
            title: "Devices",
            text: "Find your starting point",
            count: "03",
            href: "/devices",
          },
        ].map((s) => (
          <Link href={s.href} className="stat-card" key={s.title}>
            <span className="stat-icon">
              <s.icon size={21} />
            </span>
            <div>
              <h3>{s.title}</h3>
              <p>{s.text}</p>
            </div>
            <span className="stat-count">
              {s.count}
              <ArrowUpRight size={12} />
            </span>
          </Link>
        ))}
      </div>
      <div className="catalog-layout">
        <section className="catalog-main">
          <div className="section-heading">
            <div>
              <h2>
                {overview ? "Discover your next build" : "Project directory"}
                <span className="count-pill">{projects.length}</span>
              </h2>
              <p>Independent projects. A world of possibilities.</p>
            </div>
            <span className="demo-label">DEMO CATALOG</span>
          </div>
          <div
            className="catalog-tabs"
            role="tablist"
            aria-label="Project type"
          >
            {tabs.map((t) => (
              <button
                role="tab"
                aria-selected={tab === t}
                className={tab === t ? "selected" : ""}
                onClick={() => setTab(t)}
                key={t}
              >
                {t}
              </button>
            ))}
          </div>
          <div className="catalog-controls">
            <label className="search-field">
              <Search size={16} />
              <input
                placeholder="Search projects…"
                aria-label="Search catalog"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              {query && (
                <button
                  className="icon-button"
                  onClick={() => setQuery("")}
                  aria-label="Clear search"
                >
                  <X size={14} />
                </button>
              )}
            </label>
            <button
              className={`button filter-button ${filterOpen ? "filter-active" : ""}`}
              onClick={() => setFilterOpen((v) => !v)}
              aria-expanded={filterOpen}
            >
              <SlidersHorizontal size={15} />
              Filters
              {channel !== "All channels" && <span className="nav-dot" />}
            </button>
            <label className="sort-label">
              <span className="sr-only">Sort projects</span>
              <select value={sort} onChange={(e) => setSort(e.target.value)}>
                <option value="recent">Recently updated</option>
                <option value="name">Name A–Z</option>
              </select>
            </label>
          </div>
          {filterOpen && (
            <div className="filter-panel">
              <label>
                Release channel
                <select
                  value={channel}
                  onChange={(e) => setChannel(e.target.value)}
                >
                  {["All channels", "Stable", "Beta", "Nightly"].map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </label>
              <button
                className="text-button"
                onClick={() => {
                  setChannel("All channels");
                  setDevice("");
                  setQuery("");
                }}
              >
                Reset filters
              </button>
            </div>
          )}
          {device && (
            <button className="device-filter" onClick={() => setDevice("")}>
              {device}
              <X size={14} />
            </button>
          )}
          <div className="project-grid">
            {results.map((p) => (
              <Link
                href={`/projects/${p.slug}`}
                className="project-card"
                key={p.slug}
              >
                <div className="project-card-top">
                  <span className={`project-icon ${p.color}`}>
                    {p.monogram}
                  </span>
                  <Badge
                    className={p.channel === "Stable" ? "stable" : "neutral"}
                  >
                    <span />
                    {p.channel}
                  </Badge>
                  <ArrowUpRight size={16} className="card-arrow" />
                </div>
                <div className="project-title">
                  <h3>{p.name}</h3>
                  <span>
                    {p.kind === "ROM"
                      ? "ROM"
                      : p.kind === "RECOVERY"
                        ? "RECOVERY"
                        : "KERNEL"}
                  </span>
                </div>
                <p className="project-description">{p.description}</p>
                <div className="tags">
                  {p.tags.slice(0, 2).map((tag) => (
                    <span key={tag}>{tag}</span>
                  ))}
                </div>
                <div className="project-meta">
                  <span>
                    <GitBranch size={13} />
                    {p.android}
                  </span>
                  <span>v{p.version}</span>
                </div>
              </Link>
            ))}
          </div>
          {!results.length && (
            <div className="empty-state">
              <Search size={25} />
              <h3>No matching projects</h3>
              <p>Try a different search or reset your filters.</p>
              <button
                className="button secondary"
                onClick={() => {
                  setQuery("");
                  setChannel("All channels");
                  setDevice("");
                  setTab("All projects");
                }}
              >
                Reset filters
              </button>
            </div>
          )}
          <div className="catalog-caption">
            <span>
              Showing {results.length} of {projects.length} demonstration
              projects
            </span>
            <span>All compatibility is unverified</span>
          </div>
        </section>
        <aside className="discovery-aside">
          <section className="device-finder">
            <span className="aside-icon">
              <Smartphone size={22} />
            </span>
            <h3>Start with your device.</h3>
            <p>The right build starts with the right hardware.</p>
            <label className="sr-only" htmlFor="device-select">
              Select a demonstration device
            </label>
            <select
              id="device-select"
              value={device}
              onChange={(e) => setDevice(e.target.value)}
            >
              <option value="">Select your device</option>
              {devices.map((d) => (
                <option key={d.id}>{d.name}</option>
              ))}
            </select>
            <Link href="/devices">
              Browse all devices <ArrowRight size={14} />
            </Link>
          </section>
          <section className="principles-card">
            <div className="aside-section-title">
              <span className="small-orbit">✧</span>
              <h3>Explore with confidence</h3>
            </div>
            <p>
              Better information.
              <br />
              More informed decisions.
            </p>
            {[
              "Exact device variants",
              "Transparent project details",
              "Evidence-based compatibility",
            ].map((t) => (
              <div className="principle" key={t}>
                <Check size={14} />
                {t}
              </div>
            ))}
            <div className="integrity-note">
              A checksum confirms file integrity. It does not establish that a
              file is safe.
            </div>
          </section>
          <a
            href="https://source.android.com/docs/setup/start"
            className="getting-started"
            target="_blank"
            rel="noreferrer"
          >
            <span>NEW TO CUSTOM ANDROID?</span>
            <h3>
              A little curiosity.
              <br />A whole new world.
            </h3>
            <p>
              Start with the AOSP documentation <ArrowUpRight size={15} />
            </p>
          </a>
        </aside>
      </div>
      <div className="preview-note">
        <span className="status-dot" />
        <p>
          <strong>A foundation for what’s next.</strong> This preview uses
          fictional projects and devices. No builds are available for download.
        </p>
        <Link href="/studio">
          View project status <ArrowRight size={14} />
        </Link>
      </div>
    </div>
  );
}
function CodeIcon() {
  return (
    <span aria-hidden="true" className="code-icon">
      &lt;/&gt;
    </span>
  );
}
