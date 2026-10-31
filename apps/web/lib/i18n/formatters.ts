import { Locale } from "./types";

const LOCALE_TAGS: Record<Locale, string> = {
  en: "en-US",
  ru: "ru-RU",
  tg: "tg-TJ",
};

export function getIntlLocale(locale: Locale): string {
  return LOCALE_TAGS[locale] ?? "en-US";
}

export function formatDate(
  date: Date | string | number,
  locale: Locale = "en",
  options?: Intl.DateTimeFormatOptions,
): string {
  const d = typeof date === "object" ? date : new Date(date);
  if (isNaN(d.getTime())) return "";
  const tag = getIntlLocale(locale);
  try {
    return new Intl.DateTimeFormat(
      tag,
      options ?? { year: "numeric", month: "short", day: "numeric" },
    ).format(d);
  } catch {
    return d.toLocaleDateString();
  }
}

export function formatTime(
  date: Date | string | number,
  locale: Locale = "en",
  options?: Intl.DateTimeFormatOptions,
): string {
  const d = typeof date === "object" ? date : new Date(date);
  if (isNaN(d.getTime())) return "";
  const tag = getIntlLocale(locale);
  try {
    return new Intl.DateTimeFormat(
      tag,
      options ?? { hour: "numeric", minute: "numeric" },
    ).format(d);
  } catch {
    return d.toLocaleTimeString();
  }
}

export function formatDateTime(
  date: Date | string | number,
  locale: Locale = "en",
  options?: Intl.DateTimeFormatOptions,
): string {
  const d = typeof date === "object" ? date : new Date(date);
  if (isNaN(d.getTime())) return "";
  const tag = getIntlLocale(locale);
  try {
    return new Intl.DateTimeFormat(
      tag,
      options ?? {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "numeric",
      },
    ).format(d);
  } catch {
    return d.toLocaleString();
  }
}

export function formatNumber(
  value: number,
  locale: Locale = "en",
  options?: Intl.NumberFormatOptions,
): string {
  const tag = getIntlLocale(locale);
  try {
    return new Intl.NumberFormat(tag, options).format(value);
  } catch {
    return String(value);
  }
}
