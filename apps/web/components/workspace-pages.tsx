"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, Folder, Sparkles } from "lucide-react";
import {
  paginatedProjectsResponseSchema,
  projectsResponseSchema,
  romConfigurationSchema,
  type ROMConfiguration,
  type PublicUser,
} from "@rom-hub/contracts";
import { projectAPI } from "@/lib/project-api";
import { PixelExperience } from "./pixel/pixel-experience";
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
          <h2>{p.configuration?.name ?? "Configuration needs review"}</h2>
          <p>
            {p.configuration?.preset ?? "Stored draft"} · Revision {p.revision}
          </p>
          <small>Edited {new Date(p.updatedAt).toLocaleDateString()}</small>
          <span>Open project →</span>
        </Link>
      ))}
    </div>
  );
}
export function ProjectLibrary() {
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
  return (
    <div className="craft-page project-library">
      <div className="craft-heading">
        <div>
          <span className="craft-kicker">SAVED CONFIGURATIONS</span>
          <h1>My projects</h1>
          <p>Your project library. Every draft, in one place.</p>
        </div>
        <Link className="button primary" href="/projects/new">
          New ROM <ArrowRight size={16} />
        </Link>
      </div>
      <div className="library-tools">
        <label className="craft-field">
          Search loaded projects
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Project name"
          />
        </label>
        <label className="craft-field">
          Sort loaded projects
          <select value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="recent">Recently edited</option>
            <option value="name">Name</option>
          </select>
        </label>
      </div>
      <p role="status">
        {library.status ||
          `${library.items.length} projects loaded${library.cursor ? "; more available" : ""}`}
      </p>
      <ProjectCards items={shown} />
      {!library.busy && !library.status && !shown.length && (
        <section className="panel">
          <h2>{query ? "No loaded projects match" : "A fresh canvas"}</h2>
          <p>
            {query
              ? "Try another name, or load more projects below."
              : "Create your first saved Android configuration."}
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
            ? "Loading…"
            : library.cursor
              ? "Load more projects"
              : "Retry projects"}
        </button>
      )}
    </div>
  );
}
export function Overview({ user }: { user: PublicUser }) {
  const library = useProjectLibrary(6, true),
    latest = library.items[0];
  return (
    <div className="craft-page overview-page">
      <section className="workspace-hero">
        <span className="craft-kicker">YOUR ANDROID. YOUR RULES.</span>
        <h1>Welcome back, {user.username}.</h1>
        <p>
          A place for your next Android idea. Shape your configuration, save
          your progress and return when inspiration finds you.
        </p>
        <div className="settings-actions">
          <Link href="/projects/new" className="button primary">
            Create ROM <Sparkles size={16} />
          </Link>
          {latest && (
            <Link
              prefetch={false}
              href={`/builder/${latest.id}`}
              className="button secondary"
            >
              Continue last project <ArrowRight size={16} />
            </Link>
          )}
        </div>
      </section>
      <div className="workspace-facts">
        <section className="panel">
          <span className="craft-kicker">LATEST SAVED DRAFT</span>
          <h2>
            {latest?.configuration?.name ?? "Your first idea starts here"}
          </h2>
          <p>
            {latest
              ? `Revision ${latest.revision} · Edited ${new Date(latest.updatedAt).toLocaleDateString()}`
              : "Saved project activity will appear here."}
          </p>
        </section>
        <section className="panel">
          <span className="craft-kicker">BUILD READINESS</span>
          <h2>Configuration comes first.</h2>
          <p>
            Drafts can be saved and edited. Device compatibility and cloud
            compilation remain unverified.
          </p>
        </section>
      </div>
      <div className="craft-section-title">
        <h2>Recently edited</h2>
        <Link href="/projects">View project library →</Link>
      </div>
      <p role="status">{library.status}</p>
      <ProjectCards items={library.items.slice(0, 3)} />
      {!library.busy && !library.status && !library.items.length && (
        <p>No project activity yet. Start with Create ROM.</p>
      )}
    </div>
  );
}
export function Profile({ user }: { user: PublicUser }) {
  const library = useProjectLibrary(6, true),
    [selected, setSelected] = useState("");
  const project =
    library.items.find((p) => p.id === selected) ?? library.items[0];
  return (
    <div className="craft-page">
      <div className="craft-heading">
        <div>
          <span className="craft-kicker">YOUR NEXOS IDENTITY</span>
          <h1>Your profile</h1>
          <p>Your ideas and the drafts you are shaping.</p>
        </div>
        <Link className="button secondary" href="/settings">
          Manage settings
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
                {user.role} · Email{" "}
                {user.emailVerifiedAt ? "verified" : "not verified"}
              </p>
            </div>
          </div>
          <h2>Recent project activity</h2>
          <p role="status">{library.status}</p>
          <ProjectCards items={library.items.slice(0, 3)} />
          {!library.busy && !library.status && !project && (
            <p>No saved projects yet. Your recent drafts will appear here.</p>
          )}
        </section>
        <aside>
          <label className="craft-field">
            Preview a recent project
            <select
              value={project?.id ?? ""}
              disabled={!library.items.length}
              onChange={(e) => setSelected(e.target.value)}
            >
              {!library.items.length && (
                <option value="">No saved project</option>
              )}
              {library.items.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.configuration?.name ?? "Configuration needs review"}
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
                ? `${project.configuration?.name ?? "Draft"} · Revision ${project.revision}`
                : "Concept preview · no saved configuration selected"
            }
          />
        </aside>
      </div>
    </div>
  );
}
