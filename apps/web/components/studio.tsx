"use client";
import Link from "next/link";
import { PixelExperience } from "./pixel/pixel-experience";
import {
  GlassCard,
  SectionHeader,
  StatusIndicator,
  FloatingToolbar,
  PrimaryButton,
  SecondaryButton,
} from "./design-system";
import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  formatAPIErrorMessage,
  defaultConfiguration,
  romConfigurationSchema,
  type ROMConfiguration,
  type StoredProjectView as Project,
  type CatalogDevice as Device,
  type DevicesResponse,
  type ProjectDetailResponse,
  type ProjectWriteResponse,
  type CompatibilityResponse,
} from "@rom-hub/contracts";
import {
  ArrowRight,
  Smartphone,
  Palette,
  Boxes,
  ShieldCheck,
  Cpu,
  Layers,
  Download,
  Save,
} from "lucide-react";
import { useTranslation } from "@/lib/i18n";

async function api<T>(
  path: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  const response = await fetch(`/api/v1/${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const data = await response.json();
  if (!response.ok)
    throw new Error(
      formatAPIErrorMessage(data, "Request failed", "stringified"),
    );
  return data as T;
}

export function Studio({ id }: { id?: string }) {
  const router = useRouter();
  const { t } = useTranslation("romStudio");
  const { t: tc } = useTranslation("common");

  const steps = useMemo(
    () => [
      t("steps.0"),
      t("steps.1"),
      t("steps.2"),
      t("steps.3"),
      t("steps.4"),
      t("steps.5"),
      t("steps.6"),
      t("steps.7"),
      t("steps.8"),
      t("steps.9"),
    ],
    [t],
  );

  const [config, setConfig] = useState<ROMConfiguration>(defaultConfiguration);
  const [project, setProject] = useState<Project>();
  const [devices, setDevices] = useState<Device[]>([]);
  const [step, setStep] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(!id);
  const [result, setResult] = useState<CompatibilityResponse>();
  const [history, setHistory] = useState<ROMConfiguration[]>([]);

  useEffect(() => {
    let active = true;
    api<DevicesResponse>("devices")
      .then((d) => {
        if (active) setDevices(d.items);
      })
      .catch(() => {
        if (active)
          setMessage(t("catalogUnavailable"));
      });
    if (id)
      api<ProjectDetailResponse>(`projects/${id}`)
        .then((p) => {
          if (active) {
            setProject(p);
            setConfig(p.configuration);
            setLoaded(true);
            setMessage(t("savedRevision", { revision: p.revision }));
          }
        })
        .catch((e) => {
          if (active) setMessage(e.message);
        });
    return () => {
      active = false;
    };
  }, [id, t]);

  function change(patch: Partial<ROMConfiguration>) {
    setHistory((h) => [...h.slice(-19), config]);
    setConfig((c) => ({ ...c, ...patch }));
    setResult(undefined);
    setMessage(t("unsavedChangesShort"));
  }

  async function save(validate = false) {
    setBusy(true);
    try {
      const parsed = romConfigurationSchema.parse(config);
      const saved = await api<ProjectWriteResponse>(
        project ? `projects/${project.id}` : "projects",
        project ? "PATCH" : "POST",
        project
          ? { configuration: parsed, revision: project.revision }
          : parsed,
      );
      setProject(saved);
      setMessage(t("savedRevision", { revision: saved.revision }));
      if (validate)
        setResult(
          await api<CompatibilityResponse>(
            `projects/${saved.id}/validate`,
            "POST",
            {},
          ),
        );
      if (!id) router.replace(`/builder/${saved.id}`);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Unable to save");
    } finally {
      setBusy(false);
    }
  }

  function download() {
    const blob = new Blob([JSON.stringify(config, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "nexos-configuration.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  const effectiveStatus = message ?? t("unsavedChanges");

  return (
    <div className="craft-page">
      <div className="craft-heading">
        <div>
          <span className="craft-kicker">{t("kicker")}</span>
          <h1>{t("heading")}</h1>
          <p>{t("subheading")}</p>
        </div>
        <PrimaryButton disabled={busy || !loaded} onClick={() => save()}>
          <Save size={16} /> {t("saveDraft")}
        </PrimaryButton>
      </div>
      <div className="craft-status" role="status">
        {effectiveStatus}{" "}
        <Link prefetch={false} href="/login">
          {tc("actions")} →
        </Link>
      </div>
      <div className="studio-layout">
        <nav className="studio-steps" aria-label="Builder steps">
          {steps.map((name, i) => (
            <button
              key={name}
              aria-current={step === i ? "step" : undefined}
              onClick={() => setStep(i)}
            >
              <span>{String(i + 1).padStart(2, "0")}</span>
              {name}
            </button>
          ))}
        </nav>
        <section className="studio-editor">
          <div className="craft-kicker">
            CONFIGURATION / {String(step + 1).padStart(2, "0")}
          </div>
          <h2>{steps[step]}</h2>
          {step === 0 && (
            <>
              <p>{t("deviceHeader")}</p>
              <label className="craft-field">
                {t("deviceHeader")}
                <select
                  value={config.variantId}
                  onChange={(e) => change({ variantId: e.target.value })}
                >
                  <option value="unselected">{t("chooseYourDevice")}</option>
                  {devices.flatMap((d) =>
                    d.variants.map((v) => (
                      <option key={v.id} value={v.id}>
                        {d.name} · {d.codename} · {v.modelNumber} · {v.region}
                      </option>
                    )),
                  )}
                </select>
              </label>
              <div className="craft-notice">
                <ShieldCheck /> {t("deviceCompatibilityWarning")}
              </div>
            </>
          )}
          {step === 1 && (
            <>
              <p>{t("step1Description")}</p>
              <div className="craft-notice">
                {t("step1Notice")}
              </div>
            </>
          )}
          {step === 2 && (
            <label className="craft-field">
              {t("identityHeader")}
              <input
                maxLength={60}
                value={config.name}
                onChange={(e) => change({ name: e.target.value })}
              />
            </label>
          )}
          {step === 3 && (
            <>
              <p>{t("step3Description")}</p>
              <label className="craft-field">
                {t("accentColor")}
                <input
                  type="color"
                  value={config.accent}
                  onChange={(e) => change({ accent: e.target.value })}
                />
              </label>
              <div className="color-swatches">
                {["#70d6ed", "#a99bff", "#eeb9cf", "#c6db9b", "#f3be83"].map(
                  (c) => (
                    <button
                      key={c}
                      style={{ background: c }}
                      aria-label={`Use accent ${c}`}
                      onClick={() => change({ accent: c })}
                    />
                  ),
                )}
              </div>
              <label className="craft-check">
                <input
                  type="checkbox"
                  checked={config.darkMode}
                  onChange={(e) => change({ darkMode: e.target.checked })}
                />{" "}
                {t("darkAppearance")}
              </label>
            </>
          )}
          {step === 4 && (
            <>
              <p>{t("step4Description")}</p>
              {(["browser", "calendar", "files", "terminal"] as const).map(
                (app) => (
                  <label className="craft-check" key={app}>
                    <input
                      type="checkbox"
                      checked={config.apps.includes(app)}
                      onChange={(e) =>
                        change({
                          apps: e.target.checked
                            ? [...config.apps, app]
                            : config.apps.filter((a) => a !== app),
                        })
                      }
                    />
                    {app}
                  </label>
                ),
              )}
              <div className="craft-notice">
                {t("apkUploadNotice")}
              </div>
            </>
          )}
          {step === 5 && (
            <>
              <p>{t("step5Description")}</p>
              <label className="craft-field">
                {t("performancePreset")}
                <select
                  value={config.preset}
                  onChange={(e) =>
                    change({
                      preset: e.target.value as ROMConfiguration["preset"],
                    })
                  }
                >
                  {romConfigurationSchema.shape.preset.options.map((p) => (
                    <option key={p} value={p}>
                      {p === "Balanced"
                        ? t("balanced")
                        : p === "Performance"
                          ? t("performance")
                          : t("battery")}
                    </option>
                  ))}
                </select>
              </label>
              <div className="craft-notice">
                {t("thermalProtectionNotice")}
              </div>
            </>
          )}
          {step === 6 && (
            <p>{t("step6Description")}</p>
          )}
          {step === 7 && (
            <>
              <p>{t("step7Description")}</p>
              <button className="button secondary" onClick={download}>
                <Download size={15} /> {t("export")}
              </button>
              <label className="craft-field">
                {t("importConfiguration")}
                <input
                  type="file"
                  accept="application/json,.json"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    try {
                      if (file.size > 16384)
                        throw new Error("Configuration exceeds 16 KB");
                      change(
                        romConfigurationSchema.parse(
                          JSON.parse(await file.text()),
                        ),
                      );
                    } catch {
                      setMessage(
                        "Invalid configuration. Import a valid NEXOS JSON file under 16 KB.",
                      );
                    }
                  }}
                />
              </label>
            </>
          )}
          {step === 8 && (
            <>
              <p>{t("step8Description")}</p>
              <div className="craft-notice">
                {t("bootloaderNotice")}
              </div>
            </>
          )}
          {step === 9 && (
            <>
              <p>
                {config.name} · {config.preset} · {config.apps.length} roles
              </p>
              <button
                className="button primary"
                disabled={busy || !loaded}
                onClick={() => save(true)}
              >
                {t("saveAndValidate")}
              </button>
              {result && (
                <div className="craft-notice">
                  <strong>{result.status}</strong>
                  <ul>
                    {result.blockingIssues.map((issue) => (
                      <li key={issue}>{issue}</li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="craft-notice">
                {t("cloudBuildsUnavailable")}
              </div>
              <button className="button secondary" disabled>
                {t("buildUnavailable")}
              </button>
            </>
          )}
          <FloatingToolbar className="studio-actions">
            <SecondaryButton
              disabled={!history.length}
              onClick={() => {
                const previous = history.at(-1);
                if (previous) {
                  setConfig(previous);
                  setHistory((h) => h.slice(0, -1));
                  setResult(undefined);
                  setMessage(t("unsavedChangesShort"));
                }
              }}
            >
              {t("undo")}
            </SecondaryButton>
            {step < 9 && (
              <button
                className="button primary"
                onClick={() => setStep(step + 1)}
              >
                {tc("next")} <ArrowRight size={16} />
              </button>
            )}
          </FloatingToolbar>
        </section>
        <aside className="studio-preview">
          <div className="craft-kicker">{t("livePreviewKicker")}</div>
          <PixelExperience
            configuration={config}
            authenticated
            compact
            review={step === 9}
            context={`Preset: ${config.preset}. Kernel unconfigured; compatibility unverified.`}
          />
          <p className="pixel-draft-summary">
            <strong>{config.name}</strong> ·{" "}
            {config.darkMode ? "Dark" : "Light"}
            <br />
            {config.apps.join(", ")}
            <br />
            {t("visualConceptNotice")}
          </p>
        </aside>
      </div>
    </div>
  );
}

export { ProjectLibrary as Projects } from "./workspace-pages";

export function Welcome() {
  return (
    <div className="craft-page welcome-page">
      <div className="welcome-heading">
        <div>
          <span className="craft-kicker">YOUR NEXT CHAPTER</span>
          <h2>A space to make it yours.</h2>
        </div>
        <span className="welcome-edition">NEXOS / STUDIO 01</span>
      </div>
      <section className="craft-hero">
        <div>
          <span className="craft-pill">A new kind of personal computing</span>
          <h1>
            Your phone.
            <br />
            Your Android.
            <br />
            <em>Your rules.</em>
          </h1>
          <p>
            Turn your ideas into an Android configuration.
            <br />
            Choose your device, find your style, and make it yours.
          </p>
          <Link className="button primary" href="/projects/new">
            Create your ROM <ArrowRight size={17} />
          </Link>
          <Link className="craft-text-link" href="/projects">
            Open workspace ↗
          </Link>
          <div className="hero-availability">
            <StatusIndicator>Configuration studio available</StatusIndicator>
            <small>Cloud compilation not yet configured</small>
          </div>
        </div>
        <div
          className="hero-device-scene"
          aria-label="Decorative Android appearance preview"
        >
          <div className="device-orbit orbit-one" />
          <div className="device-orbit orbit-two" />
          <div className="design-float float-top">
            <Palette size={17} />
            <span>
              A little color.<small>A whole new feeling.</small>
            </span>
            <div className="mini-swatches">
              <i />
              <i />
              <i />
            </div>
          </div>
          <div className="showcase-phone">
            <div className="showcase-camera" />
            <div className="showcase-status">
              <span>9:41</span>
              <span>◒ ▰</span>
            </div>
            <div className="showcase-wallpaper" />
            <div className="showcase-clock">
              09<span>41</span>
            </div>
            <p>YOUR ANDROID. REIMAGINED.</p>
            <div className="showcase-widget">
              <span>MAKE ROOM FOR</span>
              <strong>Possibilities.</strong>
              <div className="showcase-widget-line" />
            </div>
            <div className="showcase-apps">
              <Smartphone />
              <Boxes />
              <Palette />
              <Layers />
            </div>
            <div className="showcase-gesture" />
          </div>
          <div className="design-float float-bottom">
            <ShieldCheck size={21} />
            <span>
              Designed by you.<small>Grounded in compatibility.</small>
            </span>
          </div>
          <span className="preview-caption">
            VISUAL CONCEPT · NOT A DEVICE RENDER
          </span>
        </div>
      </section>
      <SectionHeader
        eyebrow="THE CREATIVE PROCESS"
        title="From an idea to your Android."
        description="A thoughtful workflow, one step at a time."
        action={<span className="section-aside">FOUR STEPS. ONE VISION.</span>}
      />
      <div className="craft-grid">
        {[
          [
            Smartphone,
            "01",
            "Choose your foundation",
            "Start with your exact device variant.",
          ],
          [
            Palette,
            "02",
            "Find your signature",
            "Explore colors, appearance and app selections.",
          ],
          [
            ShieldCheck,
            "03",
            "Check every detail",
            "Review compatibility before any build.",
          ],
          [
            Cpu,
            "04",
            "Prepare for compilation",
            "Builds unlock only with verified infrastructure.",
          ],
        ].map(([Icon, n, title, description]) => {
          const I = Icon as typeof Boxes;
          return (
            <GlassCard className="craft-card" key={String(n)}>
              <div className="craft-card-top">
                <I size={22} />
                <span>{String(n)}</span>
              </div>
              <h3>{String(title)}</h3>
              <p>{String(description)}</p>
            </GlassCard>
          );
        })}
      </div>
    </div>
  );
}
