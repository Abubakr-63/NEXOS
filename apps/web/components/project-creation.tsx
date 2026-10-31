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
import "./workspace-pages.css";

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
          setCatalog(data);
          setDeviceError("");
        })
        .catch((e) => {
          if (!controller.signal.aborted) setDeviceError(e.message);
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 200);
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

  useEffect(() => {
    if (!isSunnyDevice && base === "pixelexperience-plus-mojito-android11") {
      setBase("");
    }
  }, [isSunnyDevice, base]);

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
    setStep((s) => Math.min(3, s + 1));
  }

  async function submit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (step < 3) {
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
        <nav className="studio-steps" aria-label="Project creation steps">
          {steps.map((label, index) => (
            <button
              type="button"
              key={label}
              disabled={pending || index > step}
              aria-current={step === index ? "step" : undefined}
              onClick={() => {
                setStep(index);
                setError("");
              }}
            >
              <span>{String(index + 1).padStart(2, "0")}</span>
              {label}
            </button>
          ))}
        </nav>
        <section className="studio-editor">
          <span className="craft-kicker">
            {t("stepOf", { current: step + 1, total: 4 })}
          </span>
          <h2>{steps[step]}</h2>
          <form onSubmit={submit}>
            <fieldset
              disabled={pending}
              style={{ border: 0, padding: 0, minWidth: 0 }}
            >
              {step === 0 && (
                <>
                  <label className="craft-field">
                    {t("projectName")}
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
                    {t("description")}
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
              {step === 1 && (
                <>
                  <p>{t("deviceSubtitle")}</p>
                  {catalogError && (
                    <p role="alert" className="form-status">
                      {catalogError}
                    </p>
                  )}
                  <label className="craft-field">
                    {t("manufacturerFilter")}
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
                    {t("searchDevice")}
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
                        {t("deviceTitle")}
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
                          {t("moreDevices")}
                        </SecondaryButton>
                      </div>
                    </>
                  )}
                  {device && (
                    <>
                      <p>
                        {device.manufacturer.name} · {device.name} · Codename:{" "}
                        {device.codename}
                      </p>
                      <label className="craft-field">
                        {t("selectVariant")}
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
                            {t("selectPrebuiltRom")}
                          </SecondaryButton>
                        </div>
                      )}
                    </>
                  )}
                </>
              )}
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
                        {t("androidBaseTitle")}
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
              {step === 3 && (
                <>
                  <dl className="detail-list">
                    <dt>{t("reviewIdentity")}</dt>
                    <dd>{name.trim()}</dd>
                    <dt>{t("description")}</dt>
                    <dd>{description.trim() || "—"}</dd>
                    <dt>{t("reviewTarget")}</dt>
                    <dd>{device?.name} ({device?.codename})</dd>
                    <dt>{t("reviewVariant")}</dt>
                    <dd>
                      {variant?.modelNumber} · {variant?.region}
                    </dd>
                    <dt>{t("reviewBase")}</dt>
                    <dd>
                      {base === "pixelexperience-plus-mojito-android11"
                        ? "PixelExperience Plus · Android 11 (Prebuilt ROM)"
                        : base === "unconfigured"
                          ? t("unconfiguredDraftOption")
                          : `${bases.find((item) => item.id === base)?.name ?? base} · Android ${bases.find((item) => item.id === base)?.androidVersion ?? ""}`}
                    </dd>
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
              <div className="studio-actions">
                <SecondaryButton
                  type="button"
                  disabled={step === 0 || pending}
                  onClick={() => {
                    setStep((s) => s - 1);
                    setError("");
                  }}
                >
                  {t("back")}
                </SecondaryButton>
                <PrimaryButton
                  type="submit"
                  disabled={
                    pending ||
                    (step === 1 &&
                      (loading || !!deviceError || !!catalogError)) ||
                    (step === 2 && (baseLoading || !!baseError)) ||
                    (step === 3 && !signedIn)
                  }
                >
                  {pending
                    ? t("savingProject")
                    : step === 3
                      ? t("createDraft")
                      : t("continue")}
                </PrimaryButton>
              </div>
            </fieldset>
          </form>
        </section>
        <aside className="studio-preview">
          <PixelExperience
            compact
            authenticated
            review={step === 3}
            configuration={{
              ...defaultConfiguration,
              name: name.trim() || "My Android",
              description,
              variantId: variantId || defaultConfiguration.variantId,
              base: base || defaultConfiguration.base,
            }}
            context={`${device ? `${device.name} · ${variant?.modelNumber || "Variant"}` : "No device selected"}. Base: ${base === "pixelexperience-plus-mojito-android11" ? "PixelExperience Plus · Android 11" : bases.find((item) => item.id === base)?.name ?? (base === "unconfigured" ? "Unconfigured" : "Draft")}.`}
          />
          <div className="craft-notice">
            {t("draftNotice")}
          </div>
        </aside>
      </div>
    </div>
  );
}
