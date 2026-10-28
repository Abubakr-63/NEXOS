"use client";
import Link from "next/link";
import {
  GlassCard,
  SectionHeader,
  StatusIndicator,
  FloatingToolbar,
  PrimaryButton,
  SecondaryButton,
} from "./design-system";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  defaultConfiguration,
  romConfigurationSchema,
  type ROMConfiguration,
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

type Project = {
  id: string;
  configuration: ROMConfiguration;
  revision: number;
};
type Device = {
  id: string;
  name: string;
  codename: string;
  variants: { id: string; modelNumber: string; region: string }[];
};
async function api(path: string, method = "GET", body?: unknown) {
  const response = await fetch(`/api/v1/${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const data = await response.json();
  if (!response.ok)
    throw new Error(data.error?.message?.toString() || "Request failed");
  return data;
}
const steps = [
  "Device",
  "Android Base",
  "ROM Identity",
  "Appearance",
  "Applications",
  "Performance",
  "Kernel",
  "Advanced Options",
  "Installation",
  "Review & Build",
];
export function Studio({ id }: { id?: string }) {
  const router = useRouter();
  const [config, setConfig] = useState<ROMConfiguration>(defaultConfiguration);
  const [project, setProject] = useState<Project>();
  const [devices, setDevices] = useState<Device[]>([]);
  const [step, setStep] = useState(0);
  const [message, setMessage] = useState(
    "Draft changes are unsaved. Sign in to save to your account.",
  );
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(!id);
  const [result, setResult] = useState<{
    status: string;
    blockingIssues: string[];
  }>();
  const [history, setHistory] = useState<ROMConfiguration[]>([]);
  useEffect(() => {
    let active = true;
    api("devices")
      .then((d) => {
        if (active) setDevices(d.items);
      })
      .catch(() => {
        if (active)
          setMessage(
            "Device catalog unavailable. Start the API and database to select a variant.",
          );
      });
    if (id)
      api(`projects/${id}`)
        .then((p) => {
          if (active) {
            setProject(p);
            setConfig(p.configuration);
            setLoaded(true);
            setMessage(`Saved revision ${p.revision}`);
          }
        })
        .catch((e) => {
          if (active) setMessage(e.message);
        });
    return () => {
      active = false;
    };
  }, [id]);
  function change(patch: Partial<ROMConfiguration>) {
    setHistory((h) => [...h.slice(-19), config]);
    setConfig((c) => ({ ...c, ...patch }));
    setResult(undefined);
    setMessage("Unsaved changes");
  }
  async function save(validate = false) {
    setBusy(true);
    try {
      const parsed = romConfigurationSchema.parse(config);
      const saved = await api(
        project ? `projects/${project.id}` : "projects",
        project ? "PATCH" : "POST",
        project
          ? { configuration: parsed, revision: project.revision }
          : parsed,
      );
      setProject(saved);
      setMessage(`Saved revision ${saved.revision}`);
      if (validate)
        setResult(await api(`projects/${saved.id}/validate`, "POST", {}));
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
    a.download = "romcraft-configuration.json";
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <div className="craft-page">
      <div className="craft-heading">
        <div>
          <span className="craft-kicker">YOUR ANDROID, REIMAGINED</span>
          <h1>Make it yours.</h1>
          <p>One workspace. An Android experience designed by you.</p>
        </div>
        <PrimaryButton disabled={busy || !loaded} onClick={() => save()}>
          <Save size={16} /> Save draft
        </PrimaryButton>
      </div>
      <div className="craft-status" role="status">
        {message} <Link href="/login">Account →</Link>
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
              <p>
                Select the exact hardware variant. Catalog entries are
                unverified and are not build-ready.
              </p>
              <label className="craft-field">
                Device variant
                <select
                  value={config.variantId}
                  onChange={(e) => change({ variantId: e.target.value })}
                >
                  <option value="unselected">Choose your device</option>
                  {devices.flatMap((d) =>
                    d.variants.map((v) => (
                      <option key={v.id} value={v.id}>
                        {d.name} · {d.codename} · {v.modelNumber} · {v.region} —
                        Unknown
                      </option>
                    )),
                  )}
                </select>
              </label>
              <div className="craft-notice">
                <ShieldCheck /> Compatibility requires evidence for this exact
                variant.
              </div>
            </>
          )}
          {step === 1 && (
            <>
              <p>
                No maintained Android base has been registered for this variant.
              </p>
              <div className="craft-notice">
                AOSP and LineageOS integrations require pinned manifests, device
                trees, vendor dependencies and license review.
              </div>
            </>
          )}
          {step === 2 && (
            <label className="craft-field">
              ROM name
              <input
                maxLength={60}
                value={config.name}
                onChange={(e) => change({ name: e.target.value })}
              />
            </label>
          )}
          {step === 3 && (
            <>
              <p>A little color. A completely different feeling.</p>
              <label className="craft-field">
                Accent color
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
                Dark appearance
              </label>
            </>
          )}
          {step === 4 && (
            <>
              <p>
                Choose application roles for your configuration. Verified,
                licensed packages will be required before embedding apps.
              </p>
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
                APK uploads unavailable until isolated package inspection and
                threat scanning are integrated.
              </div>
            </>
          )}
          {step === 5 && (
            <>
              <p>
                Save a configuration intention. Presets do not apply unverified
                performance changes.
              </p>
              <label className="craft-field">
                Preset
                <select
                  value={config.preset}
                  onChange={(e) =>
                    change({
                      preset: e.target.value as ROMConfiguration["preset"],
                    })
                  }
                >
                  {romConfigurationSchema.shape.preset.options.map((p) => (
                    <option key={p}>{p}</option>
                  ))}
                </select>
              </label>
              <div className="craft-notice">
                Thermal protection stays enabled. No overclocking, voltage
                changes or performance claims.
              </div>
            </>
          )}
          {step === 6 && (
            <p>
              No verified compatible kernel is available. Kernel selection is
              blocked until device and base compatibility are evidenced.
            </p>
          )}
          {step === 7 && (
            <>
              <p>
                Portable, versioned configuration. Importing replaces this
                draft; save to persist it.
              </p>
              <button className="button secondary" onClick={download}>
                <Download size={15} /> Export JSON
              </button>
              <label className="craft-field">
                Import configuration
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
                        "Invalid configuration. Import a valid ROMCRAFT JSON file under 16 KB.",
                      );
                    }
                  }}
                />
              </label>
            </>
          )}
          {step === 8 && (
            <>
              <p>
                No verified installation procedure exists for this
                configuration.
              </p>
              <div className="craft-notice">
                Bootloader unlocking can erase data. Device-specific firmware,
                backup, recovery and installation guidance must be reviewed
                before any flashing.
              </div>
            </>
          )}
          {step === 9 && (
            <>
              <p>
                {config.name} · {config.preset} · {config.apps.length}{" "}
                application roles
              </p>
              <button
                className="button primary"
                disabled={busy || !loaded}
                onClick={() => save(true)}
              >
                Save & validate
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
                Cloud builds unavailable. No ROM compiler or verified build
                manifest is configured.
              </div>
              <button className="button secondary" disabled>
                Build unavailable
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
                  setMessage("Unsaved changes");
                }
              }}
            >
              Undo
            </SecondaryButton>
            {step < 9 && (
              <button
                className="button primary"
                onClick={() => setStep(step + 1)}
              >
                Continue <ArrowRight size={16} />
              </button>
            )}
          </FloatingToolbar>
        </section>
        <aside className="studio-preview">
          <div className="craft-kicker">LIVE PREVIEW</div>
          <div
            className={`android-preview ${config.darkMode ? "" : "preview-light"}`}
            style={{ "--phone-accent": config.accent } as React.CSSProperties}
          >
            <div className="camera-dot" />
            <div className="phone-status">
              9:41 <span>◒ ▰</span>
            </div>
            <div className="android-clock">
              09
              <br />
              41
            </div>
            <p>Tuesday, October 27</p>
            <div className="android-widget">
              <span>YOUR SPACE</span>
              <h3>{config.name || "My Android"}</h3>
              <p>A fresh perspective.</p>
            </div>
            <div className="android-apps">
              {config.apps.map((a, i) => (
                <div key={a}>
                  <span>{["◎", "▦", "▱", ">_"][i]}</span>
                  <small>{a}</small>
                </div>
              ))}
            </div>
            <div className="gesture-bar" />
          </div>
          <p>
            Visual approximation
            <br />
            Actual device rendering may differ.
          </p>
        </aside>
      </div>
    </div>
  );
}
export function Projects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [status, setStatus] = useState("Loading your projects…");
  useEffect(() => {
    api("projects")
      .then((d) => {
        setProjects(d.items);
        setStatus(
          d.items.length ? "" : "Your first Android experience starts here.",
        );
      })
      .catch((e) => setStatus(e.message));
  }, []);
  return (
    <div className="craft-page">
      <div className="craft-heading">
        <div>
          <span className="craft-kicker">YOUR WORKSPACE</span>
          <h1>My projects</h1>
          <p>Pick up where you left off.</p>
        </div>
        <Link className="button primary" href="/projects/new">
          New ROM <ArrowRight size={16} />
        </Link>
      </div>
      <p role="status">{status}</p>
      <div className="craft-grid">
        {projects.map((p) => (
          <Link className="craft-card" key={p.id} href={`/builder/${p.id}`}>
            <Layers />
            <h2>{p.configuration.name}</h2>
            <p>
              {p.configuration.preset} · Revision {p.revision}
            </p>
            <span>Open builder →</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
export function Welcome() {
  return (
    <div className="craft-page welcome-page">
      <div className="welcome-heading">
        <div>
          <span className="craft-kicker">YOUR NEXT CHAPTER</span>
          <h2>A space to make it yours.</h2>
        </div>
        <span className="welcome-edition">ROMCRAFT / STUDIO 01</span>
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
