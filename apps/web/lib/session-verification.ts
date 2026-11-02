import { authenticationResponseSchema } from "@rom-hub/contracts";

export const DEFAULT_REVALIDATE_INTERVAL_MS = 300_000; // 5 minutes periodic revalidation
export const DEFAULT_VERIFY_TIMEOUT_MS = 15_000; // 15 seconds bounded timeout for Render cold starts
export const DEFAULT_DEBOUNCE_MS = 15_000; // 15 seconds debounce threshold for visibility/history events
export const DEFAULT_MAX_RETRIES = 3; // Maximum consecutive transient retries before waiting for next periodic cycle
export const INITIAL_RETRY_DELAY_MS = 2_000; // 2 seconds initial backoff
export const MAX_RETRY_DELAY_MS = 30_000; // 30 seconds max backoff

export type SessionVerificationResult =
  | { status: "valid"; user: unknown }
  | { status: "unauthorized" }
  | { status: "transient_error"; statusCode?: number; error?: unknown };

/**
 * Calculates bounded exponential backoff delay:
 * Attempt 1: 2,000ms
 * Attempt 2: 4,000ms
 * Attempt 3: 8,000ms (capped at maxMs)
 */
export function computeBackoffDelay(
  attempt: number,
  baseMs = INITIAL_RETRY_DELAY_MS,
  maxMs = MAX_RETRY_DELAY_MS,
): number {
  if (attempt <= 0) return 0;
  const exponential = baseMs * Math.pow(2, attempt - 1);
  return Math.min(exponential, maxMs);
}

/**
 * Checks whether an HTTP status code indicates a transient server/network issue
 * rather than an authoritative authentication rejection.
 */
export function isTransientStatus(status: number): boolean {
  return status === 408 || status === 429 || (status >= 500 && status <= 599);
}

/**
 * Verifies active session against the backend auth endpoint.
 * Never throws — maps all network/server failures to SessionVerificationResult.
 */
export async function verifySessionEndpoint({
  fetcher = fetch,
  url = "/api/v1/auth/me",
  signal,
}: {
  fetcher?: typeof fetch;
  url?: string;
  signal?: AbortSignal;
} = {}): Promise<SessionVerificationResult> {
  try {
    const response = await fetcher(url, {
      credentials: "same-origin",
      cache: "no-store",
      signal,
    });

    if (response.status === 401) {
      return { status: "unauthorized" };
    }

    if (!response.ok) {
      return {
        status: "transient_error",
        statusCode: response.status,
      };
    }

    const data = await response.json().catch(() => null);
    const parsed = authenticationResponseSchema.safeParse(data);
    if (!parsed.success) {
      // Non-auth JSON or proxy interception (e.g. gateway HTML error with 200 OK)
      return {
        status: "transient_error",
        statusCode: response.status,
      };
    }

    return {
      status: "valid",
      user: parsed.data.user,
    };
  } catch (error) {
    return {
      status: "transient_error",
      error,
    };
  }
}
