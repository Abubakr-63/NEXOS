"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, Folder, Sparkles, Cpu, Layers, Smartphone } from "lucide-react";
import {
  paginatedProjectsResponseSchema,
  projectsResponseSchema,
  romConfigurationSchema,
  type ROMConfiguration,
  type PublicUser,
} from "@rom-hub/contracts";
import { projectAPI } from "@/lib/project-api";
import { PixelExperience } from "./pixel/pixel-experience";
import { useTranslation } from "@/lib/i18n";
import "./workspace-pages.css";

type Project = {
  id: string;
  configuration: ROMConfiguration | null;
  updatedAt: string;
  revision: number;
};

function useProjectLibrary(limit: number, recent = false) {
  const [items, setItems] = useState<Project[]>([]),
    [cursor, setCursor] = useState<string | null>(null);
  const [status, setStatus] = useState("Loading saved projects…"),
    [busy, setBusy] = useState(true);
  const controller = useRef<AbortController | null>(null),
    pending = useRef(false);
  const load = useCallback(
    async (after?: string) => {
      if (pending.current) return;
      pending.current = true;
      const request = new AbortController();
      controller.current = request;
      try {
        const query = new URLSearchParams({
          pagination: "cursor",
          limit: String(limit),
          ...(after ? { cursor: after } : {}),
        });
        const response = await projectAPI(
          recent ? "projects" : `projects?${query}`,
          "GET",
          undefined,
          request.signal,
        );
        const data = recent
          ? {
              items: projectsResponseSchema
                .parse(response)
                .items.slice(0, limit),
              pagination: { hasMore: false, nextCursor: null },
            }
          : paginatedProjectsResponseSchema.parse(response);
        if (request.signal.aborted) return;
        const projected = data.items.map((p) => {
          const result = romConfigurationSchema.safeParse(p.configuration);
          return {
            id: p.id,
            updatedAt: p.updatedAt,
            revision: p.revision,
            configuration: result.success ? result.data : null,
          };
        });
        setItems((previous) =>
          after
            ? [
                ...previous,
                ...projected.filter(
                  (p) => !previous.some((old) => old.id === p.id),
                ),
              ]
            : projected,
        );
        setCursor(data.pagination.hasMore ? data.pagination.nextCursor : null);
        setStatus("");
      } catch (error) {
        if (!request.signal.aborted)
          setStatus(
            error instanceof Error ? error.message : "Projects unavailable.",
          );
      } finally {
        pending.current = false;
        if (!request.signal.aborted) setBusy(false);
      }
    },
    [limit, recent],
  );
  useEffect(() => {
    const initial = setTimeout(() => void load(), 0);
    return () => {
      clearTimeout(initial);
      controller.current?.abort();
      pending.current = false;
    };
  }, [load]);
  return {
    items,
    cursor,
    status,
    busy,
    more: () => {
      setBusy(true);
      void load(cursor ?? undefined);
    },
  };
}

function ProjectCards({ items }: { items: Project[] }) {
  const { t, format } = useTranslation("projects");

  return (
    <div className="craft-grid">
      {items.map((p) => (
        <Link
          prefetch={false}
          className="craft-card"
          key={p.id}
          href={`/projects/${p.id}`}
        >
          <Folder size={22} />
          <h2>{p.configuration?.name ?? t("needsReview")}</h2>
          <p>
            {p.configuration?.preset ?? t("storedDraft")} · {t("revision", { revision: p.revision })}
          </p>
          <small>{t("edited", { date: format.date(p.updatedAt) })}</small>
          <span>{t("openProject")}</span>
        </Link>
      ))}
    </div>
  );
}

export function ProjectLibrary() {
  const { t } = useTranslation("projects");
  const { t: tc } = useTranslation("common");
  const library = useProjectLibrary(20);
  const [query, setQuery] = useState(""),
    [sort, setSort] = useState("recent");
  const shown = library.items
    .filter((p) =>
      (p.configuration?.name ?? "")
        .toLowerCase()
        .includes(query.trim().toLowerCase()),
    )
    .sort((a, b) =>
      sort === "name"
        ? (a.configuration?.name ?? "").localeCompare(
            b.configuration?.name ?? "",
          )
        : b.updatedAt.localeCompare(a.updatedAt),
    );

  const statusText = library.status === "Loading saved projects…"
    ? t("loading")
    : library.status ||
      t("projectsLoaded", {
        count: library.items.length,
        more: !!library.cursor,
      });

  return (
    <div className="craft-page project-library">
      <div className="craft-heading">
        <div>
          <span className="craft-kicker">{t("kicker")}</span>
          <h1>{t("title")}</h1>
          <p>{t("subtitle")}</p>
        </div>
        <Link className="button primary" href="/projects/new">
          {t("newRom")} <ArrowRight size={16} />
        </Link>
      </div>
      <div className="library-tools">
        <label className="craft-field">
          {t("searchLabel")}
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("searchPlaceholder")}
          />
        </label>
        <label className="craft-field">
          {t("sortLabel")}
          <select value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="recent">{t("sortRecent")}</option>
            <option value="name">{t("sortName")}</option>
          </select>
        </label>
      </div>
      <p role="status">{statusText}</p>
      <ProjectCards items={shown} />
      {!library.busy && !library.status && !shown.length && (
        <section className="panel">
          <h2>{query ? t("emptySearchTitle") : t("emptyLibraryTitle")}</h2>
          <p>
            {query
              ? t("emptySearchDesc")
              : t("emptyLibraryDesc")}
          </p>
        </section>
      )}
      {(library.cursor || (library.status && !library.busy)) && (
        <button
          className="button secondary"
          disabled={library.busy}
          onClick={library.more}
        >
          {library.busy
            ? tc("loading")
            : library.cursor
              ? t("loadMore")
              : t("retryProjects")}
        </button>
      )}
    </div>
  );
}

export function Overview({ user }: { user: PublicUser }) {
  const { t, format } = useTranslation("overview");
  const library = useProjectLibrary(6, true),
    latest = library.items[0];

  return (
    <div className="craft-page overview-page">
      <section className="workspace-hero">
        <span className="craft-kicker">{t("kicker")}</span>
        <h1>{t("welcome", { username: user.username })}</h1>
        <p>{t("description")}</p>
        <div className="hero-stats-row">
          <div className="hero-stat-pill">
            <span />
            {library.items.length > 0
              ? t("savedDrafts", { count: library.items.length })
              : t("studioReady")}
          </div>
          {latest && (
            <div className="hero-stat-pill">
              <span />
              {t("latest", {
                name: latest.configuration?.name || "Draft",
                revision: latest.revision,
              })}
            </div>
          )}
          <div className="hero-stat-pill">
            <span />
            {t("aospBaseline")}
          </div>
        </div>
        <div className="settings-actions">
          <Link href="/projects/new" className="button primary">
            {t("createRom")} <Sparkles size={16} />
          </Link>
          {latest && (
            <Link
              prefetch={false}
              href={`/builder/${latest.id}`}
              className="button secondary"
            >
              {t("continueProject")} <ArrowRight size={16} />
            </Link>
          )}
        </div>
      </section>

      {/* Superconscious Animated Feature Panels */}
      <section className="super-feature-section" aria-label="Studio capabilities">
        <div className="super-feature-grid">
          <article className="super-feature-card">
            <div className="feature-icon-badge" aria-hidden="true">
              <Cpu size={22} />
            </div>
            <h3>{t("featureMatrixTitle")}</h3>
            <p>{t("featureMatrixDesc")}</p>
            <div className="feature-micro-ui">
              <div className="micro-ui-item">
                <span>{t("featureMatrixItem")}</span>
                <small>{t("featureMatrixSub")}</small>
              </div>
              <div className="micro-ui-bar">
                <div style={{ width: "88%" }} />
              </div>
            </div>
          </article>

          <article className="super-feature-card">
            <div className="feature-icon-badge" aria-hidden="true">
              <Smartphone size={22} />
            </div>
            <h3>{t("featurePreviewTitle")}</h3>
            <p>{t("featurePreviewDesc")}</p>
            <div className="feature-micro-ui">
              <div className="micro-ui-item">
                <span>{t("featurePreviewItem")}</span>
                <small>{t("featurePreviewSub")}</small>
              </div>
              <div className="micro-ui-bar">
                <div style={{ width: "95%" }} />
              </div>
            </div>
          </article>

          <article className="super-feature-card">
            <div className="feature-icon-badge" aria-hidden="true">
              <Layers size={22} />
            </div>
            <h3>{t("featureVerifyTitle")}</h3>
            <p>{t("featureVerifyDesc")}</p>
            <div className="feature-micro-ui">
              <div className="micro-ui-item">
                <span>{t("featureVerifyItem")}</span>
                <small>{t("featureVerifySub")}</small>
              </div>
              <div className="micro-ui-bar">
                <div style={{ width: "100%" }} />
              </div>
            </div>
          </article>
        </div>
      </section>

      <div className="workspace-facts">
        <section className="panel">
          <span className="craft-kicker">{t("latestDraftKicker")}</span>
          <h2>
            {latest?.configuration?.name ?? t("firstIdeaStarts")}
          </h2>
          <p>
            {latest
              ? t("draftInfo", {
                  revision: latest.revision,
                  date: format.date(latest.updatedAt),
                })
              : t("noSavedDrafts")}
          </p>
        </section>
        <section className="panel">
          <span className="craft-kicker">{t("buildReadinessKicker")}</span>
          <h2>{t("buildReadinessTitle")}</h2>
          <p>{t("buildReadinessDesc")}</p>
        </section>
      </div>
      <div className="craft-section-title">
        <h2>{t("recentlyEdited")}</h2>
        <Link href="/projects">{t("viewLibrary")}</Link>
      </div>
      <p role="status">
        {library.status === "Loading saved projects…" ? t("loading") : library.status}
      </p>
      <ProjectCards items={library.items.slice(0, 3)} />
      {!library.busy && !library.status && !library.items.length && (
        <p>{t("noActivity")}</p>
      )}
    </div>
  );
}

export function Profile({ user }: { user: PublicUser }) {
  const { t } = useTranslation("profile");
  const library = useProjectLibrary(6, true),
    [selected, setSelected] = useState("");
  const project =
    library.items.find((p) => p.id === selected) ?? library.items[0];

  return (
    <div className="craft-page">
      <div className="craft-heading">
        <div>
          <span className="craft-kicker">{t("kicker")}</span>
          <h1>{t("title")}</h1>
          <p>{t("subtitle")}</p>
        </div>
        <Link className="button secondary" href="/settings">
          {t("manageSettings")}
        </Link>
      </div>
      <div className="profile-layout">
        <section>
          <div className="panel profile-identity">
            <span className="identity-avatar" aria-hidden="true">
              {user.username.slice(0, 2).toUpperCase()}
            </span>
            <div>
              <h2>{user.username}</h2>
              <p>
                {user.role} · {t("emailStatus", {
                  status: user.emailVerifiedAt ? t("verified") : t("notVerified"),
                })}
              </p>
            </div>
          </div>
          <div className="hero-stats-row" style={{ marginBottom: "24px" }}>
            <div className="hero-stat-pill">
              <span />
              {t("savedProjectsCount", { count: library.items.length })}
            </div>
            {project && (
              <div className="hero-stat-pill">
                <span />
                {t("currentDraft", { revision: project.revision })}
              </div>
            )}
            <div className="hero-stat-pill">
              <span />
              {t("memberBadge")}
            </div>
          </div>
          <h2>{t("recentActivity")}</h2>
          <p role="status">
            {library.status === "Loading saved projects…" ? t("loading") : library.status}
          </p>
          <ProjectCards items={library.items.slice(0, 3)} />
          {!library.busy && !library.status && !project && (
            <p>{t("noProjects")}</p>
          )}
        </section>
        <aside>
          <label className="craft-field">
            {t("previewProject")}
            <select
              value={project?.id ?? ""}
              disabled={!library.items.length}
              onChange={(e) => setSelected(e.target.value)}
            >
              {!library.items.length && (
                <option value="">{t("noSavedProjectOption")}</option>
              )}
              {library.items.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.configuration?.name ?? t("needsReview")}
                </option>
              ))}
            </select>
          </label>
          <PixelExperience
            compact
            authenticated
            configuration={project?.configuration ?? undefined}
            context={
              project
                ? `${project.configuration?.name ?? "Draft"} · ${t("currentDraft", { revision: project.revision })}`
                : t("conceptPreviewNoConfig")
            }
          />
        </aside>
      </div>
    </div>
  );
}
