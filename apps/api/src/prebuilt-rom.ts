import { createHash } from "node:crypto";
import { open, lstat } from "node:fs/promises";
import { isIP } from "node:net";
import {
  ForbiddenException,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";

export const PREBUILT_ID = "pixel-experience-plus-mojito-android11-20211009";
export const PREBUILT_FILENAME =
  "PixelExperience_Plus_mojito-11.0-20211009-1327-OFFICIAL.zip";
export const PREBUILT_SELECTION = Object.freeze({
  manufacturer: "xiaomi",
  device: "redmi-note-10-4g",
  codename: "sunny",
  rom: "pixelexperience-plus",
  android: "11",
});
export const PREBUILT_NOTICE =
  "This is an existing prebuilt ROM archive. NEXOS did not compile this file, and your selected customizations are not included.";
const SOURCE = "C:/Users/admin/Downloads/" + PREBUILT_FILENAME;
const SIZE = 1375104164;
const SHA256 =
  "39807bfa2b0a0c8569b37f745bcdeb14c0a1c8530f7e5f997a93b058c044f215";

export function localDemoRequest(
  remote: string | undefined,
  origin: unknown,
  site: unknown,
  forwarded = false,
) {
  if (
    process.env.NODE_ENV !== "development" ||
    process.env.NEXOS_LOCAL_PREBUILT_DEMO !== "1"
  )
    throw new NotFoundException("Prebuilt ROM unavailable");
  const permitted =
    remote === "127.0.0.1" || remote === "::1" || remote === "::ffff:127.0.0.1";
  let localOrigin = false;
  try {
    const host = new URL(process.env.WEB_ORIGIN ?? "http://localhost:3000")
      .hostname;
    localOrigin =
      host === "localhost" || host === "127.0.0.1" || host === "[::1]";
  } catch {
    /* Fail closed. */
  }
  if (
    !permitted ||
    forwarded ||
    !remote ||
    !isIP(remote) ||
    !localOrigin ||
    (site !== undefined &&
      !["same-origin", "same-site", "none"].includes(String(site))) ||
    (origin !== undefined &&
      origin !== (process.env.WEB_ORIGIN ?? "http://localhost:3000"))
  )
    throw new ForbiddenException("Local demo access required");
}

export function supportedSelection(id: string, query: unknown) {
  if (
    id !== PREBUILT_ID ||
    !query ||
    typeof query !== "object" ||
    Object.keys(query).sort().join() !==
      Object.keys(PREBUILT_SELECTION).sort().join() ||
    Object.entries(PREBUILT_SELECTION).some(
      ([key, value]) => (query as Record<string, unknown>)[key] !== value,
    )
  )
    throw new NotFoundException("Prebuilt ROM unavailable for this selection");
}

/** Fixed operator allowlist, never a path supplied by HTTP input. No ZIP extraction. */
export class PrebuiltRomStore {
  private checking?: Promise<void>;
  constructor(
    private readonly source = SOURCE,
    private readonly size = SIZE,
    private readonly sha256 = SHA256,
  ) {}
  private async verified() {
    let file: Awaited<ReturnType<typeof open>> | undefined;
    try {
      const entry = await lstat(this.source);
      if (!entry.isFile() || entry.isSymbolicLink())
        throw new Error("Not a regular artifact");
      file = await open(this.source, "r");
      const before = await file.stat();
      if (!before.isFile() || before.size !== this.size)
        throw new Error("Size mismatch");
      const digest = createHash("sha256");
      for await (const chunk of file.createReadStream({
        start: 0,
        autoClose: false,
      }))
        digest.update(chunk);
      const after = await file.stat();
      if (
        digest.digest("hex") !== this.sha256 ||
        before.size !== after.size ||
        before.mtimeMs !== after.mtimeMs ||
        before.ctimeMs !== after.ctimeMs
      )
        throw new Error("Artifact changed");
      return file;
    } catch (error) {
      await file?.close();
      if ((error as NodeJS.ErrnoException).code === "ENOENT")
        throw new NotFoundException("Prebuilt ROM unavailable");
      throw new ServiceUnavailableException(
        "Prebuilt ROM integrity check unavailable or failed",
      );
    }
  }
  async metadata() {
    // Coalesce simultaneous metadata checks without caching a mutable file's hash.
    this.checking ??= this.verified()
      .then((file) => file.close())
      .finally(() => {
        this.checking = undefined;
      });
    await this.checking;
    return {
      id: PREBUILT_ID,
      selection: PREBUILT_SELECTION,
      status: "Prebuilt ROM available",
      name: "PixelExperience Plus",
      androidVersion: "11",
      buildDate: "2021-10-09",
      securityPatch: "2021-10-01",
      filename: PREBUILT_FILENAME,
      size: this.size,
      sha256: this.sha256,
      builtByNexos: false,
      customizationsIncluded: false,
      deviceEvidence: "OTA metadata explicitly targets mojito,sunny",
      installationCompatibilityVerified: false,
      authenticityVerified: false,
      redistributionRightsVerified: false,
      publicDeploymentAllowed: false,
      notice: PREBUILT_NOTICE,
      warning:
        "Historical Android 11 archive; not assessed as current or secure for daily use. No installation or flashing is offered.",
    };
  }
  async download() {
    const file = await this.verified();
    return { file, size: this.size, sha256: this.sha256 };
  }
}
