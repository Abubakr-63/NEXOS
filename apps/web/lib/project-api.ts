import type { ROMConfiguration } from "@rom-hub/contracts";

export class ProjectAPIError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}
export async function projectAPI<T>(
  path: string,
  method = "GET",
  body?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api/v1/${path}`, {
      method,
      signal,
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw error;
    throw new ProjectAPIError(
      "Cannot reach the API. Start the NestJS API and check API_ORIGIN.",
      0,
    );
  }
  const data = await response.json().catch(() => null);
  if (!response.ok || !data) {
    const message = data?.error?.message;
    throw new ProjectAPIError(
      Array.isArray(message)
        ? message.join(". ")
        : message ||
            "The API is unavailable. Check the NestJS API, DATABASE_URL and PostgreSQL connection.",
      response.status,
    );
  }
  return data as T;
}
export type CatalogDevice = {
  id: string;
  name: string;
  codename: string;
  isDemo: boolean;
  deprecatedAt?: string | null;
  catalogStatus?: "CATALOGED" | "UNVERIFIED";
  buildSupportStatus?: "NOT_VERIFIED";
  manufacturer: { id: string; name: string };
  supportStatus: "UNKNOWN";
  variants: CatalogVariant[];
};
export type CatalogVariant = {
  id: string;
  modelNumber: string;
  region: string;
  hardwareVariant?: string | null;
  catalogStatus?: "CATALOGED" | "UNVERIFIED";
  sourceStatus?: "SOURCE_AVAILABLE" | "UNREVIEWED";
  buildSupportStatus?: "NOT_VERIFIED";
  officialSourceUrl?: string | null;
  evidenceUrls?: string[];
  sourceCodeUrl?: string | null;
  reviewedAt?: string | null;
  notes?: string | null;
};
export type AndroidBaseOption = {
  id: string;
  name: string;
  supportStatus: "UNKNOWN";
  buildSupported: false;
  androidVersion: string;
  documentationUrl: string;
  sourceRepository: string;
  sourceRef: string;
  availability: "SOURCE_AVAILABLE" | "DEPRECATED";
};
export type SavedProject = {
  id: string;
  configuration: ROMConfiguration;
  revision: number;
  updatedAt: string;
  deviceVariant?: (CatalogVariant & { device: CatalogDevice }) | null;
  androidBase?: AndroidBaseOption | null;
  compatibility?: {
    status: string;
    explanation: string;
    blockingIssues: string[];
  };
};
