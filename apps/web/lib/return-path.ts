/** Only known workspace paths, never URLs, query strings, backslashes or encoded redirects. */
export function workspaceReturnPath(raw: unknown, fallback = "/settings") {
  if (
    typeof raw !== "string" ||
    raw.length > 240 ||
    /[%\\?#\u0000-\u0020]/.test(raw)
  )
    return fallback;
  return /^(?:\/|\/dashboard|\/profile|\/help|\/settings|\/projects(?:\/new|\/[A-Za-z0-9_-]+)?|\/builder\/[A-Za-z0-9_-]+)$/.test(
    raw,
  )
    ? raw
    : fallback;
}
