import { DEFAULT_LOCALE, isSupportedLocale, Locale, LOCALE_COOKIE_NAME } from "./types";

export function getClientLocale(): Locale {
  if (typeof document === "undefined") return DEFAULT_LOCALE;
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${LOCALE_COOKIE_NAME}=`));
  if (match) {
    const val = decodeURIComponent(match.split("=")[1] ?? "");
    if (isSupportedLocale(val)) return val;
  }
  return DEFAULT_LOCALE;
}

export function setClientLocale(locale: Locale): void {
  if (typeof document === "undefined") return;
  const maxAge = 365 * 24 * 60 * 60; // 1 year
  document.cookie = `${LOCALE_COOKIE_NAME}=${encodeURIComponent(
    locale,
  )}; path=/; max-age=${maxAge}; samesite=lax`;
  try {
    document.documentElement.lang = locale;
  } catch {}
}
