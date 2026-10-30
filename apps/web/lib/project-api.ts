import { formatAPIErrorMessage } from "@rom-hub/contracts";
export type {
  CatalogDevice,
  CatalogVariant,
  AndroidBaseOption,
} from "@rom-hub/contracts";

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
    throw new ProjectAPIError(
      formatAPIErrorMessage(
        data,
        "The API is unavailable. Check the NestJS API, DATABASE_URL and PostgreSQL connection.",
      ),
      response.status,
    );
  }
  return data as T;
}
