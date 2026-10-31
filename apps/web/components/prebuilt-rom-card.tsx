"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Download, AlertTriangle, ShieldAlert, Loader2, FileArchive } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import "./prebuilt-rom-card.css";

export const PREBUILT_DEMO_PARAMS = {
  id: "pixel-experience-plus-mojito-android11-20211009",
  manufacturer: "xiaomi",
  device: "redmi-note-10-4g",
  codename: "sunny",
  rom: "pixelexperience-plus",
  android: "11",
} as const;

export const PREBUILT_DEMO_QUERY =
  "manufacturer=xiaomi&device=redmi-note-10-4g&codename=sunny&rom=pixelexperience-plus&android=11";

export const PREBUILT_API_ORIGIN = "http://localhost:4000";

export const PREBUILT_METADATA_URL = `${PREBUILT_API_ORIGIN}/api/v1/prebuilt-roms/${PREBUILT_DEMO_PARAMS.id}?${PREBUILT_DEMO_QUERY}`;

export const PREBUILT_DOWNLOAD_URL = `${PREBUILT_API_ORIGIN}/api/v1/prebuilt-roms/${PREBUILT_DEMO_PARAMS.id}/download?${PREBUILT_DEMO_QUERY}`;

export interface PrebuiltMetadata {
  id: string;
  selection: {
    manufacturer: string;
    device: string;
    codename: string;
    rom: string;
    android: string;
  };
  status: string;
  name: string;
  androidVersion: string;
  buildDate: string;
  securityPatch: string;
  filename: string;
  size: number;
  sha256: string;
  builtByNexos: boolean;
  customizationsIncluded: boolean;
  deviceEvidence: string;
  installationCompatibilityVerified: boolean;
  authenticityVerified: boolean;
  redistributionRightsVerified: boolean;
  publicDeploymentAllowed: boolean;
  notice: string;
  warning: string;
}

export function PrebuiltRomCard() {
  const { t } = useTranslation("prebuiltRom");
  const [metadata, setMetadata] = useState<PrebuiltMetadata | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorStatus, setErrorStatus] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    async function loadMetadata() {
      setLoading(true);
      setErrorStatus(null);
      try {
        const res = await fetch(PREBUILT_METADATA_URL, {
          method: "GET",
          credentials: "include",
          signal: controller.signal,
        });

        if (!active) return;

        if (res.status === 200) {
          const data = (await res.json()) as PrebuiltMetadata;
          if (active) setMetadata(data);
        } else {
          if (active) setErrorStatus(res.status);
        }
      } catch (err) {
        if (!controller.signal.aborted && active) {
          setErrorStatus(500);
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    loadMetadata();

    return () => {
      active = false;
      controller.abort();
    };
  }, []);

  if (loading) {
    return (
      <div className="prebuilt-rom-card prebuilt-loading" role="status">
        <Loader2 className="prebuilt-spinner" size={20} />
        <span>{t("checking")}</span>
      </div>
    );
  }

  if (errorStatus === 401) {
    return (
      <div className="prebuilt-rom-card prebuilt-error" role="alert">
        <ShieldAlert size={20} className="prebuilt-warning-icon" />
        <div>
          <p>{t("notSignedIn")}</p>
          <Link href="/login" className="button secondary">
            Sign In
          </Link>
        </div>
      </div>
    );
  }

  if (errorStatus === 404 || errorStatus === 403) {
    return (
      <div className="prebuilt-rom-card prebuilt-error" role="alert">
        <AlertTriangle size={20} className="prebuilt-warning-icon" />
        <p>{t("unsupported")}</p>
      </div>
    );
  }

  if (errorStatus && errorStatus >= 500) {
    return (
      <div className="prebuilt-rom-card prebuilt-error" role="alert">
        <AlertTriangle size={20} className="prebuilt-warning-icon" />
        <p>{t("operatorUnavailable")}</p>
      </div>
    );
  }

  const filename = metadata?.filename ?? "PixelExperience_Plus_mojito-11.0-20211009-1327-OFFICIAL.zip";
  const sizeBytes = metadata?.size ?? 1375104164;
  const sha256 = metadata?.sha256 ?? "39807bfa2b0a0c8569b37f745bcdeb14c0a1c8530f7e5f997a93b058c044f215";
  const buildDate = metadata?.buildDate ?? "2021-10-09";
  const securityPatch = metadata?.securityPatch ?? "2021-10-01";
  const notice = metadata?.notice ?? t("notice");
  const warning = metadata?.warning ?? t("warning");

  return (
    <article className="prebuilt-rom-card" aria-label="Prebuilt ROM Available">
      <div className="prebuilt-card-header">
        <div className="prebuilt-title-group">
          <div className="prebuilt-status-pill">
            <span className="prebuilt-status-dot" aria-hidden="true" />
            <span>{metadata?.status ?? t("available")}</span>
          </div>
          <h3 className="prebuilt-card-title">{metadata?.name ?? t("title")}</h3>
        </div>
        <div className="prebuilt-badges">
          <span className="prebuilt-chip">
            {metadata?.androidVersion ? `Android ${metadata.androidVersion}` : t("androidVersion")}
          </span>
          <span className="prebuilt-chip">{t("deviceLabel")}</span>
          <span className="prebuilt-chip prebuilt-chip-cyan">{t("romType")}</span>
          <span className="prebuilt-chip prebuilt-chip-mono">{t("fileSize")}</span>
        </div>
      </div>

      <div className="prebuilt-notice-banner" role="note">
        <FileArchive size={18} className="prebuilt-notice-icon" aria-hidden="true" />
        <p className="prebuilt-notice-text">{notice}</p>
      </div>

      <div className="prebuilt-meta-grid">
        <div className="prebuilt-meta-item">
          <span className="prebuilt-meta-label">{t("filename")}</span>
          <span className="prebuilt-meta-value mono">{filename}</span>
        </div>
        <div className="prebuilt-meta-item">
          <span className="prebuilt-meta-label">{t("sizeLabel")}</span>
          <span className="prebuilt-meta-value">{t("fileSize")} ({sizeBytes.toLocaleString()} bytes)</span>
        </div>
        <div className="prebuilt-meta-item">
          <span className="prebuilt-meta-label">{t("buildDate")}</span>
          <span className="prebuilt-meta-value">{buildDate}</span>
        </div>
        <div className="prebuilt-meta-item">
          <span className="prebuilt-meta-label">{t("securityPatch")}</span>
          <span className="prebuilt-meta-value">{securityPatch}</span>
        </div>
        <div className="prebuilt-meta-item prebuilt-meta-full">
          <span className="prebuilt-meta-label">{t("sha256")}</span>
          <span className="prebuilt-meta-value mono">{sha256}</span>
        </div>
      </div>

      <div className="prebuilt-warning-banner" role="alert">
        <ShieldAlert size={18} className="prebuilt-warning-icon" aria-hidden="true" />
        <p className="prebuilt-warning-text">{warning}</p>
      </div>

      <div className="prebuilt-card-actions">
        <a
          href={PREBUILT_DOWNLOAD_URL}
          download={filename}
          className="button primary prebuilt-download-button"
          data-testid="prebuilt-rom-download-button"
          aria-label={`Download ${metadata?.name ?? "PixelExperience Plus"} ROM`}
        >
          <Download size={16} aria-hidden="true" />
          <span>{t("downloadButton")}</span>
        </a>
      </div>
    </article>
  );
}
