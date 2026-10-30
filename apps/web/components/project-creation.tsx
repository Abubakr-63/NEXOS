"use client";
import type {
  ProjectWriteResponse,
  AuthenticationResponse,
  ManufacturersResponse,
  AndroidBasesResponse,
  DevicesResponse,
} from "@rom-hub/contracts";
import Link from "next/link";
import { useEffect, useState } from "react";
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

import { PixelExperience } from "./pixel/pixel-experience";
import "./workspace-pages.css";

const steps = [
  "Project Identity",
  "Select Device",
  "Android Base",
  "Review & Create",
];
export function ProjectCreation() {
  const router = useRouter();
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
  const [accountStatus, setAccountStatus] = useState("Checking your session…");
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
        setAccountStatus("Projects will be saved to your account.");
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
      setError("Select a manufacturer, device model and exact variant.");
      return;
    }
    if (step === 2 && !base) {
      setError(
        "Select an Android base or explicitly choose an unconfigured draft.",
      );
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
  return (
    <div className="craft-page project-workflow">
      <div className="craft-heading">
        <div>
          <span className="craft-kicker">YOUR NEXT ANDROID</span>
          <h1>Create a ROM project</h1>
          <p>
            Choose a foundation. Save a draft. Keep every detail in your
            workspace.
          </p>
        </div>
      </div>
      <div className="craft-status" role="status">
        {accountStatus}
        {!signedIn && <Link href="/login">Sign in →</Link>}
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
          <span className="craft-kicker">STEP {step + 1} OF 4</span>
          <h2>{steps[step]}</h2>
          <form onSubmit={submit}>
            <fieldset
              disabled={pending}
              style={{ border: 0, padding: 0, minWidth: 0 }}
            >
              {step === 0 && (
                <>
                  <label className="craft-field">
                    Project name
                    <input
                      required
                      autoComplete="off"
                      maxLength={60}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="My Android"
                    />
                  </label>
                  <label className="craft-field">
                    Description (optional)
                    <textarea
                      maxLength={2000}
                      rows={4}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="project-description-input"
                      placeholder="What would you like to create?"
                    />
                  </label>
                </>
              )}
              {step === 1 && (
                <>
                  <p>
                    Choose the exact hardware variant. Catalog presence does not
                    mean build support.
                  </p>
                  {catalogError && (
                    <p role="alert" className="form-status">
                      {catalogError}
                    </p>
                  )}
                  <label className="craft-field">
                    Manufacturer
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
                      <option value="">Choose manufacturer</option>
                      {manufacturers.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  {manufacturersLoading && (
                    <p role="status">Loading manufacturers…</p>
                  )}
                  {!manufacturersLoading &&
                    !catalogError &&
                    manufacturers.length === 0 && (
                      <p>
                        No manufacturers are registered yet. Ask the
                        administrator to populate the device catalog.
                      </p>
                    )}
                  <label className="craft-field">
                    Search devices
                    <input
                      type="search"
                      value={query}
                      placeholder="Name, codename or model number"
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
                    <p role="status">Loading devices…</p>
                  ) : (
                    <>
                      <label className="craft-field">
                        Device model
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
                          <option value="">Choose device model</option>
                          {device &&
                            !catalog.items.some((d) => d.id === device.id) && (
                              <option value={device.id}>
                                {device.name} · {device.codename}
                              </option>
                            )}
                          {catalog.items.map((d) => (
                            <option key={d.id} value={d.id}>
                              {d.name} · {d.codename} ·{" "}
                              {d.catalogStatus ?? "UNVERIFIED"} · Build not
                              verified
                              {d.isDemo ? " · Fictional demo" : ""}
                            </option>
                          ))}
                        </select>
                      </label>
                      {catalog.items.length === 0 && (
                        <p role="status">
                          No devices match this search. Try another manufacturer
                          or search term.
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
                          Previous devices
                        </SecondaryButton>
                        <span>Page {page}</span>
                        <SecondaryButton
                          type="button"
                          disabled={page * 12 >= catalog.total}
                          onClick={() => {
                            setPage((p) => p + 1);
                            setLoading(true);
                          }}
                        >
                          More devices
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
                        Exact variant
                        <select
                          required
                          value={variantId}
                          onChange={(e) => setVariantId(e.target.value)}
                        >
                          <option value="">Choose exact variant</option>
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
                        {variant?.notes && (
                          <p>{variant.notes.replaceAll("ROMCRAFT", "NEXOS")}</p>
                        )}
                        {variant?.officialSourceUrl && (
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
                        {variant?.sourceCodeUrl && (
                          <p>
                            <a
                              href={variant.sourceCodeUrl}
                              target="_blank"
                              rel="noreferrer"
                            >
                              Source repository ↗
                            </a>
                          </p>
                        )}
                      </div>
                    </>
                  )}
                </>
              )}
              {step === 2 && (
                <>
                  <p>
                    Available entries come from the database catalog. None has
                    verified device-specific build support.
                  </p>
                  {baseLoading ? (
                    <p role="status">Loading Android bases…</p>
                  ) : baseError ? (
                    <p className="form-status" role="alert">
                      {baseError}
                    </p>
                  ) : (
                    <>
                      <label className="craft-field">
                        Android base
                        <select
                          value={base}
                          required
                          onChange={(e) => setBase(e.target.value)}
                        >
                          <option value="">Choose a base or draft</option>
                          {bases.map((b) => (
                            <option key={b.id} value={b.id}>
                              {b.name} · Android {b.androidVersion} ·{" "}
                              {b.availability} · Draft only
                            </option>
                          ))}
                          <option value="unconfigured">
                            Unconfigured draft — compilation unavailable
                          </option>
                        </select>
                      </label>
                      {bases.find((item) => item.id === base) && (
                        <div className="craft-notice">
                          Source availability is not device compatibility. NEXOS
                          build: NOT_VERIFIED.
                          <p>
                            <a
                              href={
                                bases.find((item) => item.id === base)!
                                  .documentationUrl
                              }
                              target="_blank"
                              rel="noreferrer"
                            >
                              Official base documentation ↗
                            </a>
                          </p>
                        </div>
                      )}
                      {bases.length === 0 && (
                        <div className="craft-notice">
                          No Android bases are registered. AOSP and LineageOS
                          cannot be offered as compatible choices without
                          catalog data. Choose an unconfigured draft to
                          continue.
                        </div>
                      )}
                    </>
                  )}
                </>
              )}
              {step === 3 && (
                <>
                  <dl className="detail-list">
                    <dt>Project</dt>
                    <dd>{name.trim()}</dd>
                    <dt>Description</dt>
                    <dd>{description.trim() || "Not provided"}</dd>
                    <dt>Manufacturer</dt>
                    <dd>{device?.manufacturer.name}</dd>
                    <dt>Device</dt>
                    <dd>
                      {device?.name} ({device?.codename})
                    </dd>
                    <dt>Variant</dt>
                    <dd>
                      {variant?.modelNumber} · {variant?.region}
                    </dd>
                    <dt>Android base</dt>
                    <dd>
                      {base === "unconfigured"
                        ? "Unconfigured draft"
                        : `${bases.find((item) => item.id === base)?.name ?? base} · Android ${bases.find((item) => item.id === base)?.androidVersion ?? "Unknown"}`}
                    </dd>
                  </dl>
                  <div className="craft-notice">
                    <StatusIndicator muted>
                      Compatibility UNKNOWN · Draft only
                    </StatusIndicator>
                    <p>
                      No NEXOS-verified device manifest or vendor, firmware and
                      kernel integration is registered. Saving creates a project
                      configuration. ROM compilation is unavailable.
                    </p>
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
                  Back
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
                    ? "Saving project…"
                    : step === 3
                      ? "Create project"
                      : "Continue"}
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
            context={`${device ? `${device.name} · ${variant?.modelNumber || "Choose variant"}` : "No device selected"}. Base: ${bases.find((item) => item.id === base)?.name ?? (base === "unconfigured" ? "Unconfigured" : "Not selected")}. Interface concept only.`}
          />
          <div className="craft-notice">
            Draft configuration · Cloud compilation unavailable
          </div>
        </aside>
      </div>
    </div>
  );
}
