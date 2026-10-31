export type Locale = "en" | "ru" | "tg";

export const SUPPORTED_LOCALES: readonly Locale[] = ["en", "ru", "tg"] as const;

export const DEFAULT_LOCALE: Locale = "en";

export const LOCALE_COOKIE_NAME = "nexos_locale";

export const LOCALE_LABELS: Record<Locale, string> = {
  en: "English",
  ru: "Русский",
  tg: "Тоҷикӣ",
};

export const LOCALE_NAMES: Record<Locale, string> = {
  en: "English",
  ru: "Русский язык",
  tg: "Забони тоҷикӣ",
};

export function isSupportedLocale(value: unknown): value is Locale {
  return typeof value === "string" && (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

