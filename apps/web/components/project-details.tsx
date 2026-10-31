"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  projectMetadataSchema,
  type ProjectDetailResponse,
  type ProjectWriteResponse,
} from "@rom-hub/contracts";
import {
  GlassPanel,
  PrimaryButton,
  SecondaryButton,
  StatusIndicator,
} from "./design-system";
import { projectAPI } from "@/lib/project-api";
import { useTranslation } from "@/lib/i18n";

export function ProjectDetails({ id }: { id: string }) {
  const { t, format } = useTranslation("projects");
  const { t: tc } = useTranslation("common");
  const [project, setProject] = useState<ProjectDetailResponse>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  const [pending, setPending] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    projectAPI<ProjectDetailResponse>(
      `projects/${encodeURIComponent(id)}`,
      "GET",
      undefined,
      controller.signal,
    )
      .then((data) => {
        setProject(data);
        setName(data.configuration.name);
        setDescription(data.configuration.description ?? "");
        if (new URLSearchParams(window.location.search).get("created") === "1")
          setMessage(t("projectCreatedSuccess"));
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [id, t]);

  async function save(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!project || pending) return;
    setPending(true);
    setError("");
    setMessage("");
    try {
      const metadata = projectMetadataSchema.parse({ name, description });
      const saved = await projectAPI<ProjectWriteResponse>(
        `projects/${encodeURIComponent(id)}`,
        "PATCH",
        {
          configuration: { ...project.configuration, ...metadata },
          revision: project.revision,
        },
      );
      setProject({ ...project, ...saved });
      setEditing(false);
      setMessage(t("projectUpdatedSuccess"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update project.");
    } finally {
      setPending(false);
    }
  }

  if (loading)
    return (
      <div className="craft-page project-overview">
        <p role="status">{t("loadingProject")}</p>
      </div>
    );
  if (!project)
    return (
      <div className="craft-page project-overview">
        <h1>{t("projectUnavailable")}</h1>
        <p role="alert" className="form-status">
          {error}
        </p>
        <div className="settings-actions">
          <Link className="button secondary" href="/projects">
            {t("title")}
          </Link>
          <Link className="button primary" href="/login">
            {tc("actions")}
          </Link>
        </div>
      </div>
    );
  const config = project.configuration;
  const variant = project.deviceVariant;

  return (
    <div className="craft-page project-overview">
      <Link className="back-link" href="/projects">
        {t("backToProjects")}
      </Link>
      <div className="craft-heading">
        <div>
          <span className="craft-kicker">{t("projectOverview")}</span>
          <h1>{config.name}</h1>
          <p>{t("draftSaved", { revision: project.revision })}</p>
        </div>
        <SecondaryButton
          onClick={() => {
            setEditing(!editing);
            setName(config.name);
            setDescription(config.description ?? "");
            setError("");
          }}
          disabled={pending}
        >
          {editing ? t("cancelEditing") : t("editProject")}
        </SecondaryButton>
      </div>
      {message && (
        <div role="status" className="craft-status">
          {message}
        </div>
      )}
      {error && (
        <p role="alert" className="form-status">
          {error}
        </p>
      )}
      <div className="detail-grid">
        <GlassPanel className="panel">
          <h2>{t("projectDetails")}</h2>
          {editing ? (
            <form onSubmit={save}>
              <fieldset
                disabled={pending}
                style={{ border: 0, padding: 0, minWidth: 0 }}
              >
                <label className="craft-field">
                  {t("searchPlaceholder")}
                  <input
                    required
                    maxLength={60}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </label>
                <label className="craft-field">
                  {t("searchPlaceholder")} (optional)
                  <textarea
                    className="project-description-input"
                    rows={4}
                    maxLength={2000}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </label>
                <PrimaryButton type="submit" disabled={pending}>
                  {pending ? t("saving") : t("saveChanges")}
                </PrimaryButton>
              </fieldset>
            </form>
          ) : (
            <>
              <p className="project-description-text">
                {config.description || t("noDescription")}
              </p>
              <dl className="detail-list project-facts">
                <dt>{t("manufacturer")}</dt>
                <dd>
                  {variant?.device.manufacturer.name ??
                    "Not selected / no longer available"}
                </dd>
                <dt>{t("device")}</dt>
                <dd>
                  {variant
                    ? `${variant.device.name} (${variant.device.codename})`
                    : config.variantId}
                </dd>
                <dt>{t("exactVariant")}</dt>
                <dd>
                  {variant
                    ? `${variant.modelNumber} · ${variant.region}`
                    : "Unavailable"}
                </dd>
                <dt>{t("androidBase")}</dt>
                <dd>
                  {config.base === "unconfigured"
                    ? "Unconfigured"
                    : project.androidBase
                      ? `${project.androidBase.name} · Android ${project.androidBase.androidVersion}`
                      : `${config.base}`}
                </dd>
                <dt>{t("configStatus")}</dt>
                <dd>DRAFT</dd>
                <dt>{t("compatibility")}</dt>
                <dd>{project.compatibility?.status ?? "UNKNOWN"}</dd>
                <dt>{t("lastUpdated")}</dt>
                <dd>
                  <time dateTime={project.updatedAt}>
                    {format.dateTime(project.updatedAt)}
                  </time>
                </dd>
              </dl>
            </>
          )}
        </GlassPanel>
        <GlassPanel className="panel">
          <h2>{t("compatibility")}</h2>
          <StatusIndicator muted>
            {t("draftOnlyCompilationUnavailable")}
          </StatusIndicator>
          {variant?.device.deprecatedAt && (
            <div className="craft-notice">
              {t("deprecatedNotice")}
            </div>
          )}
          {variant && (
            <div className="craft-notice">
              Identification: {variant.catalogStatus ?? "UNVERIFIED"}. Source:{" "}
              {variant.sourceStatus ?? "UNREVIEWED"}. NEXOS build: NOT_VERIFIED.
              {variant.officialSourceUrl && (
                <p>
                  <a
                    href={variant.officialSourceUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Identification source ↗
                  </a>
                </p>
              )}
            </div>
          )}
          {variant?.device.isDemo && (
            <div className="craft-notice">
              {t("demoNotice")}
            </div>
          )}
          <p>{project.compatibility?.explanation}</p>
          <div className="craft-notice">
            {t("catalogNotEvidence")}
          </div>
          <Link className="button secondary" href={`/builder/${project.id}`}>
            {t("openEditor")}
          </Link>
        </GlassPanel>
      </div>
    </div>
  );
}
