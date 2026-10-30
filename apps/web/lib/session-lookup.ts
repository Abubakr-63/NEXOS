import { authenticationResponseSchema } from "@rom-hub/contracts";
/** Called by the server-only session boundary; no persistent/session-token cache. */
export async function lookupSession(
  token: string | undefined,
  rawOrigin: string,
  fetcher: typeof fetch = fetch,
) {
  if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token))
    return { state: "anonymous" as const };
  try {
    const origin = new URL(rawOrigin);
    if (
      !["http:", "https:"].includes(origin.protocol) ||
      origin.username ||
      origin.password ||
      origin.search ||
      origin.hash ||
      origin.pathname !== "/"
    )
      throw new Error("Invalid API origin");
    const response = await fetcher(new URL("/api/v1/auth/me", origin), {
      headers: {
        Cookie: `romhub_session=${token}`,
        Accept: "application/json",
      },
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(4000),
    });
    if (response.status === 401) return { state: "anonymous" as const };
    if (!response.ok) return { state: "unavailable" as const };
    const result = authenticationResponseSchema.safeParse(
      await response.json(),
    );
    return result.success
      ? { state: "authenticated" as const, user: result.data.user }
      : { state: "unavailable" as const };
  } catch {
    return { state: "unavailable" as const };
  }
}
