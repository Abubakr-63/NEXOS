"use client";
import type {
  ProjectWriteResponse,
  AuthenticationResponse,
  ManufacturersResponse,
  AndroidBasesResponse,
  DevicesResponse,
} from "@rom-hub/contracts";
import Link from "next/link";
import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  defaultConfiguration,
  projectMetadataSchema,
  romConfigurationSchema,
  type ROMConfiguration,
} from "@rom-hub/contracts";
import {
  PrimaryButton,
  SecondaryButton,
  StatusIndicator,
} from "./design-system";
import {
  projectAPI,
  type CatalogDevice,
  type AndroidBaseOption,
} from "@/lib/project-api";
import { useTranslation } from "@/lib/i18n";
import { PixelExperience } from "./pixel/pixel-experience";
import { PrebuiltRomCard } from "./prebuilt-rom-card";
import { SelectedAppsPreview } from "./preview";
import {
  FileText,
  Smartphone,
  Layers,
  Grid,
  ClipboardCheck,
  ArrowRight,
  ArrowLeft,
  Wand2,
  CheckCircle2,
  Download,
  ShieldCheck,
  Palette,
  Search,
} from "lucide-react";
import "./workspace-pages.css";

const STEP_ICONS = [
  FileText,
  Smartphone,
  Layers,
  Grid,
  ClipboardCheck,
];

// In-memory catalog cache to avoid duplicate API requests during search & filtering
const devicesCache = new Map<string, DevicesResponse>();

export function ProjectCreation() {
  const router = useRouter();
  const { t } = useTranslation("projectCreation");
  const { t: tc } = useTranslation("common");

  const steps = useMemo(
    () => [
      t("steps.0"),
      t("steps.1"),
      t("steps.2"),
      t("steps.3"),
      t("steps.4"),
    ],
    [t],
  );

  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [manufacturers, setManufacturers] = useState<
    { id: string; name: string }[]
  >([]);
  const [manufacturerId, setManufacturerId] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [catalog, setCatalog] = useState<{
    items: CatalogDevice[];
    total: number;
  }>({ items: [], total: 0 });
  const [device, setDevice] = useState<CatalogDevice>();
  const [variantId, setVariantId] = useState("");
  const [base, setBase] = useState("");
  const [bases, setBases] = useState<AndroidBaseOption[]>([]);
  const [apps, setApps] = useState<ROMConfiguration["apps"]>(["browser", "files"]);
  const [accent, setAccent] = useState("#38bdf8");
  const [darkMode, setDarkMode] = useState(true);

  const [catalogError, setCatalogError] = useState("");
  const [manufacturersLoading, setManufacturersLoading] = useState(true);
  const [deviceError, setDeviceError] = useState("");
  const [baseError, setBaseError] = useState("");
  const [loading, setLoading] = useState(true);
  const [baseLoading, setBaseLoading] = useState(true);
  const [signedIn, setSignedIn] = useState(false);
  const [accountStatus, setAccountStatus] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    projectAPI<AuthenticationResponse>(
      "auth/me",
      "GET",
      undefined,
      controller.signal,
    )
      .then(() => {
        setSignedIn(true);
        setAccountStatus(null);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setAccountStatus(e.message);
      });
    projectAPI<ManufacturersResponse>(
      "manufacturers",
      "GET",
      undefined,
      controller.signal,
    )
      .then((data) => setManufacturers(data.items))
      .catch((e) => {
        if (!controller.signal.aborted) setCatalogError(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setManufacturersLoading(false);
      });
    projectAPI<AndroidBasesResponse>(
      "android-bases",
      "GET",
      undefined,
      controller.signal,
    )
      .then((data) => setBases(data.items))
      .catch((e) => {
        if (!controller.signal.aborted) setBaseError(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setBaseLoading(false);
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const cacheKey = `${manufacturerId}:${query.trim()}:${page}`;
    const cached = devicesCache.get(cacheKey);
    if (cached) {
      const cacheTimer = setTimeout(() => {
        setCatalog(cached);
        setDeviceError("");
        setLoading(false);
      }, 0);
      return () => clearTimeout(cacheTimer);
    }

    const timer = setTimeout(() => {
      const params = new URLSearchParams({
        q: query,
        page: String(page),
        limit: "12",
        ...(manufacturerId ? { manufacturerId } : {}),
      });
      projectAPI<DevicesResponse>(
        `devices?${params}`,
        "GET",
        undefined,
        controller.signal,
      )
        .then((data) => {
          devicesCache.set(cacheKey, data);
          setCatalog(data);
          setDeviceError("");
        })
        .catch((e) => {
          if (!controller.signal.aborted) setDeviceError(e.message);
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [manufacturerId, query, page]);

  const variant = device?.variants.find((v) => v.id === variantId);

  const isSunnyDevice = Boolean(
    device &&
      (device.codename === "mojito" || device.slug === "xiaomi-mojito") &&
      variant?.modelNumber === "M2101K7AG",
  );

  const previewConfig = useMemo(
    () => ({
      ...defaultConfiguration,
      name: name.trim() || "My Android",
      description,
      variantId: variantId || defaultConfiguration.variantId,
      base: base || defaultConfiguration.base,
      apps,
      accent,
      darkMode,
    }),
    [name, description, variantId, base, apps, accent, darkMode],
  );

  const previewContext = useMemo(
    () =>
      `${device ? `${device.name} · ${variant?.modelNumber || "Variant"}` : "No device selected"}. Base: ${base === "pixelexperience-plus-mojito-android11" ? "PixelExperience Plus · Android 11" : bases.find((item) => item.id === base)?.name ?? (base === "unconfigured" ? "Unconfigured" : "Draft")}.`,
    [device, variant, base, bases],
  );

  function handleToggleApp(appId: string) {
    const validApp = appId as ROMConfiguration["apps"][number];
    setApps((prev) =>
      prev.includes(validApp)
        ? prev.filter((a) => a !== validApp)
        : [...prev, validApp],
    );
  }

  function next() {
    setError("");
    if (step === 0) {
      const result = projectMetadataSchema.safeParse({ name, description });
      if (!result.success) {
        setError(result.error.issues.map((i) => i.message).join(". "));
        return;
      }
    }
    if (step === 1 && (!device || !variant)) {
      setError(t("stepValidationError1"));
      return;
    }
    if (step === 2 && !base) {
      setError(t("stepValidationError2"));
      return;
    }
    if (step === 3 && apps.length === 0) {
      setError(t("stepValidationErrorApps"));
      return;
    }
    setStep((s) => Math.min(4, s + 1));
  }

  async function submit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (step < 4) {
      next();
      return;
    }
    if (pending) return;
    setPending(true);
    setError("");
    try {
      const configuration = romConfigurationSchema.parse({
        ...defaultConfiguration,
        name,
        description,
        variantId,
        base,
        apps,
        accent,
        darkMode,
      });
      const saved = await projectAPI<ProjectWriteResponse>(
        "projects",
        "POST",
        configuration,
      );
      router.push(`/projects/${saved.id}?created=1`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to create project.");
      setPending(false);
    }
  }

  const effectiveAccountStatus = accountStatus !== null
    ? accountStatus
    : signedIn
      ? t("accountStatusSignedIn")
      : t("accountStatusChecking");

  return (
    <div className="craft-page project-workflow">
      <div className="craft-heading">
        <div>
          <span className="craft-kicker">{t("pageKicker")}</span>
          <h1>{t("pageTitle")}</h1>
          <p>{t("pageSubtitle")}</p>
        </div>
      </div>
      <div className="craft-status" role="status">
        {effectiveAccountStatus}
        {!signedIn && <Link href="/login">{tc("actions")} →</Link>}
      </div>
      <div className="studio-layout">
        {/* Left-side Step Navigation with Icons */}
        <nav className="studio-steps" aria-label="Project creation steps">
          {steps.map((label, index) => {
            const isCompleted = index < step;
            const isActive = index === step;
            const StepIcon = STEP_ICONS[index] ?? Wand2;
            return (
              <button
                type="button"
                key={label}
                disabled={pending || index > step}
                aria-current={isActive ? "step" : undefined}
                className={`flex items-center gap-2.5 text-left w-full transition-all ${
                  isActive ? "text-sky-400 font-semibold" : isCompleted ? "text-slate-200" : "text-slate-400"
                }`}
                onClick={() => {
                  setStep(index);
                  setError("");
                }}
              >
                <span
                  className={`inline-flex items-center justify-center w-7 h-7 rounded-lg text-xs font-bold transition-all ${
                    isActive
                      ? "bg-sky-500/20 text-sky-400 border border-sky-400/40 shadow-sm"
                      : isCompleted
                        ? "bg-emerald-500/20 text-emerald-400 border border-emerald-400/30"
                        : "bg-slate-800/60 text-slate-400 border border-white/5"
                  }`}
                >
                  {isCompleted ? <CheckCircle2 size={15} /> : <StepIcon size={15} />}
                </span>
                <span className="truncate">{label}</span>
              </button>
            );
          })}
        </nav>

        {/* Central Editor Section */}
        <section className="studio-editor">
          <div className="flex items-center gap-2 mb-1">
            <span className="craft-kicker">
              {t("stepOf", { current: step + 1, total: 5 })}
            </span>
          </div>
          <h2>{steps[step]}</h2>
          <form onSubmit={submit}>
            <fieldset
              disabled={pending}
              style={{ border: 0, padding: 0, minWidth: 0 }}
            >
              {/* Step 0: Identity */}
              {step === 0 && (
                <>
                  <label className="craft-field">
                    <span className="flex items-center gap-1.5 font-medium">
                      <FileText size={15} className="text-sky-400" />
                      {t("projectName")}
                    </span>
                    <input
                      required
                      autoComplete="off"
                      maxLength={60}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder={t("projectNamePlaceholder")}
                    />
                  </label>
                  <label className="craft-field">
                    <span>{t("description")}</span>
                    <textarea
                      maxLength={2000}
                      rows={4}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="project-description-input"
                      placeholder={t("descriptionPlaceholder")}
                    />
                  </label>
                </>
              )}

              {/* Step 1: Device */}
              {step === 1 && (
                <>
                  <p>{t("deviceSubtitle")}</p>
                  {catalogError && (
                    <p role="alert" className="form-status">
                      {catalogError}
                    </p>
                  )}
                  <label className="craft-field">
                    <span className="flex items-center gap-1.5 font-medium">
                      <Smartphone size={15} className="text-sky-400" />
                      {t("manufacturerFilter")}
                    </span>
                    <select
                      required
                      value={manufacturerId}
                      disabled={manufacturersLoading || !!catalogError}
                      onChange={(e) => {
                        setManufacturerId(e.target.value);
                        setDevice(undefined);
                        setVariantId("");
                        setQuery("");
                        setPage(1);
                        setLoading(true);
                      }}
                    >
                      <option value="">{t("allManufacturers")}</option>
                      {manufacturers.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  {manufacturersLoading && (
                    <p role="status">{t("loadingManufacturers")}</p>
                  )}

                  <label className="craft-field">
                    <span className="flex items-center gap-1.5 font-medium">
                      <Search size={15} className="text-sky-400" />
                      {t("searchDevice")}
                    </span>
                    <input
                      type="search"
                      value={query}
                      placeholder={t("searchDevicePlaceholder")}
                      onChange={(e) => {
                        setQuery(e.target.value);
                        setPage(1);
                        setLoading(true);
                      }}
                    />
                  </label>

                  {deviceError ? (
                    <p className="form-status" role="alert">
                      {deviceError}
                    </p>
                  ) : loading ? (
                    <p role="status">{t("loadingDevices")}</p>
                  ) : (
                    <>
                      <label className="craft-field">
                        <span>{t("deviceTitle")}</span>
                        <select
                          value={device?.id ?? ""}
                          required
                          disabled={!manufacturerId}
                          onChange={(e) => {
                            setDevice(
                              catalog.items.find(
                                (d) => d.id === e.target.value,
                              ),
                            );
                            setVariantId("");
                          }}
                        >
                          <option value="">{t("selectDevicePrompt")}</option>
                          {device &&
                            !catalog.items.some((d) => d.id === device.id) && (
                              <option value={device.id}>
                                {device.name} · {device.codename}
                              </option>
                            )}
                          {catalog.items.map((d) => (
                            <option key={d.id} value={d.id}>
                              {d.name} · {d.codename} ·{" "}
                              {d.catalogStatus ?? "UNVERIFIED"}
                            </option>
                          ))}
                        </select>
                      </label>
                      {catalog.items.length === 0 && (
                        <p role="status">
                          {t("noDevicesFound")}
                        </p>
                      )}
                      <div className="settings-actions">
                        <SecondaryButton
                          type="button"
                          disabled={page === 1}
                          onClick={() => {
                            setPage((p) => p - 1);
                            setLoading(true);
                          }}
                        >
                          <ArrowLeft size={14} />
                          {t("previousDevices")}
                        </SecondaryButton>
                        <span>{t("pageNumber", { page })}</span>
                        <SecondaryButton
                          type="button"
                          disabled={page * 12 >= catalog.total}
                          onClick={() => {
                            setPage((p) => p + 1);
                            setLoading(true);
                          }}
                        >
                          <span>{t("moreDevices")}</span>
                          <ArrowRight size={14} />
                        </SecondaryButton>
                      </div>
                    </>
                  )}

                  {device && (
                    <div className="mt-4 p-4 bg-slate-900/60 border border-white/10 rounded-xl space-y-3">
                      <div className="flex items-center gap-2">
                        <Smartphone size={18} className="text-sky-400" />
                        <span className="font-semibold text-white">
                          {device.manufacturer.name} {device.name}
                        </span>
                        <span className="text-xs text-slate-400">({device.codename})</span>
                      </div>
                      <label className="craft-field">
                        <span>{t("selectVariant")}</span>
                        <select
                          required
                          value={variantId}
                          onChange={(e) => setVariantId(e.target.value)}
                        >
                          <option value="">{t("selectVariant")}</option>
                          {device.variants.map((v) => (
                            <option key={v.id} value={v.id}>
                              {v.modelNumber} · {v.hardwareVariant || v.region}{" "}
                              · {v.catalogStatus ?? "UNVERIFIED"}
                            </option>
                          ))}
                        </select>
                      </label>
                      <div className="craft-notice">
                        <ShieldCheck size={16} className="text-sky-400 inline mr-1" />
                        Identification: {variant?.catalogStatus ?? "UNVERIFIED"}
                        . Source: {variant?.sourceStatus ?? "UNREVIEWED"}.<br />
                        Support: UNKNOWN. NEXOS build: NOT_VERIFIED. You can
                        save a draft; ROM compilation is unavailable.
                      </div>
                      {isSunnyDevice && (
                        <div className="prebuilt-available-banner">
                          <div>
                            <span className="banner-badge">ROM Available</span>
                            <p>{t("prebuiltAvailablePrompt")}</p>
                          </div>
                          <SecondaryButton
                            type="button"
                            onClick={() => {
                              setBase("pixelexperience-plus-mojito-android11");
                              setStep(2);
                            }}
                          >
                            <Download size={14} />
                            {t("selectPrebuiltRom")}
                          </SecondaryButton>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}

              {/* Step 2: Base */}
              {step === 2 && (
                <>
                  <p>{t("androidBaseSubtitle")}</p>
                  {baseLoading ? (
                    <p role="status">{t("loadingBases")}</p>
                  ) : baseError ? (
                    <p className="form-status" role="alert">
                      {baseError}
                    </p>
                  ) : (
                    <>
                      <label className="craft-field">
                        <span className="flex items-center gap-1.5 font-medium">
                          <Layers size={15} className="text-sky-400" />
                          {t("androidBaseTitle")}
                        </span>
                        <select
                          value={base}
                          required
                          onChange={(e) => setBase(e.target.value)}
                        >
                          <option value="">{t("selectBase")}</option>
                          {isSunnyDevice && (
                            <option value="pixelexperience-plus-mojito-android11">
                              {t("pixelExperienceBaseOption")}
                            </option>
                          )}
                          {bases.map((b) => (
                            <option key={b.id} value={b.id}>
                              {b.name} · Android {b.androidVersion} ·{" "}
                              {b.availability} · Draft only
                            </option>
                          ))}
                          <option value="unconfigured">
                            {t("unconfiguredDraftOption")}
                          </option>
                        </select>
                      </label>
                      {isSunnyDevice && base === "pixelexperience-plus-mojito-android11" && (
                        <PrebuiltRomCard />
                      )}
                    </>
                  )}
                </>
              )}

              {/* Step 3: Applications & Style (Automatic Phone Unlock!) */}
              {step === 3 && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-base font-semibold text-white mb-1">
                      {t("appsTitle")}
                    </h3>
                    <p className="text-xs text-slate-400 mb-4">
                      {t("appsSubtitle")}
                    </p>
                    <SelectedAppsPreview
                      selectedApps={apps}
                      onToggleApp={handleToggleApp}
                    />
                  </div>

                  {/* Accent Color & Appearance */}
                  <div className="p-4 bg-slate-900/50 border border-white/10 rounded-xl space-y-3">
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                      <Palette size={14} className="text-sky-400" />
                      Appearance & Theme
                    </span>
                    <div className="flex items-center gap-3">
                      {["#38bdf8", "#818cf8", "#f43f5e", "#10b981", "#f59e0b"].map((col) => (
                        <button
                          key={col}
                          type="button"
                          className={`w-7 h-7 rounded-full border-2 transition-transform ${
                            accent === col ? "scale-110 border-white shadow-md" : "border-transparent opacity-70"
                          }`}
                          style={{ backgroundColor: col }}
                          onClick={() => setAccent(col)}
                          aria-label={`Select accent ${col}`}
                        />
                      ))}
                    </div>
                    <label className="craft-check pt-2">
                      <input
                        type="checkbox"
                        checked={darkMode}
                        onChange={(e) => setDarkMode(e.target.checked)}
                      />
                      <span>Enable dark theme default</span>
                    </label>
                  </div>
                </div>
              )}

              {/* Step 4: Review & Create */}
              {step === 4 && (
                <>
                  <dl className="detail-list">
                    <dt className="flex items-center gap-1.5">
                      <FileText size={14} className="text-sky-400" />
                      {t("reviewIdentity")}
                    </dt>
                    <dd>{name.trim()}</dd>
                    <dt>{t("description")}</dt>
                    <dd>{description.trim() || "—"}</dd>
                    <dt className="flex items-center gap-1.5">
                      <Smartphone size={14} className="text-sky-400" />
                      {t("reviewTarget")}
                    </dt>
                    <dd>{device?.name} ({device?.codename})</dd>
                    <dt>{t("reviewVariant")}</dt>
                    <dd>
                      {variant?.modelNumber} · {variant?.region}
                    </dd>
                    <dt className="flex items-center gap-1.5">
                      <Layers size={14} className="text-sky-400" />
                      {t("reviewBase")}
                    </dt>
                    <dd>
                      {base === "pixelexperience-plus-mojito-android11"
                        ? "PixelExperience Plus · Android 11 (Prebuilt ROM)"
                        : base === "unconfigured"
                          ? t("unconfiguredDraftOption")
                          : `${bases.find((item) => item.id === base)?.name ?? base} · Android ${bases.find((item) => item.id === base)?.androidVersion ?? ""}`}
                    </dd>
                    <dt className="flex items-center gap-1.5">
                      <Grid size={14} className="text-sky-400" />
                      {t("includedApps")}
                    </dt>
                    <dd className="capitalize">{apps.join(", ") || "None"}</dd>
                  </dl>
                  {isSunnyDevice && base === "pixelexperience-plus-mojito-android11" && (
                    <PrebuiltRomCard />
                  )}
                  <div className="craft-notice">
                    <StatusIndicator muted>
                      Compatibility UNKNOWN · Draft only
                    </StatusIndicator>
                    <p>{t("disclaimer")}</p>
                  </div>
                </>
              )}

              {error && (
                <p role="alert" className="form-status">
                  {error}
                </p>
              )}

              {/* Action Buttons with Icons */}
              <div className="studio-actions">
                <SecondaryButton
                  type="button"
                  disabled={step === 0 || pending}
                  onClick={() => {
                    setStep((s) => s - 1);
                    setError("");
                  }}
                >
                  <ArrowLeft size={16} />
                  <span>{t("back")}</span>
                </SecondaryButton>
                <PrimaryButton
                  type="submit"
                  disabled={
                    pending ||
                    (step === 1 &&
                      (loading || !!deviceError || !!catalogError)) ||
                    (step === 2 && (baseLoading || !!baseError)) ||
                    (step === 4 && !signedIn)
                  }
                >
                  <span>
                    {pending
                      ? t("savingProject")
                      : step === 4
                        ? t("createDraft")
                        : t("continue")}
                  </span>
                  {step === 4 ? <Wand2 size={16} /> : <ArrowRight size={16} />}
                </PrimaryButton>
              </div>
            </fieldset>
          </form>
        </section>

        {/* Right Preview Side: Automatic Lock / Unlock Transition */}
        <aside className="studio-preview">
          <PixelExperience
            compact
            authenticated
            unlocked={step >= 3}
            review={step === 4}
            configuration={previewConfig}
            context={previewContext}
          />
          <div className="craft-notice">
            {t("draftNotice")}
          </div>
        </aside>
      </div>
    </div>
  );
}
