import { formatAPIErrorMessage } from "@rom-hub/contracts";
export async function accountRequest<T>(
  path: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  const res = await fetch(`/api/v1/${path}`, {
    method,
    credentials: "same-origin",
    headers: method !== "GET" ? { "Content-Type": "application/json" } : {},
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const data = await res.json().catch(() => ({
    error: {
      message:
        "The API is unavailable. Start the API and database, then try again.",
    },
  }));
  if (!res.ok)
    throw new Error(formatAPIErrorMessage(data, "Request failed", "nullish"));
  return data as T;
}
