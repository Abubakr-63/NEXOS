"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import en from "../../messages/en.json";
import ru from "../../messages/ru.json";
import tg from "../../messages/tg.json";
import { getClientLocale, setClientLocale } from "./cookie";
import {
  formatDate,
  formatDateTime,
  formatNumber,
  formatTime,
} from "./formatters";
import {
  DEFAULT_LOCALE,
  isSupportedLocale,
  Locale,
  LOCALE_LABELS,
  LOCALE_NAMES,
  SUPPORTED_LOCALES,
} from "./types";

type MessagesRecord = Record<string, unknown>;

const DICTIONARIES: Record<Locale, MessagesRecord> = {
  en,
  ru,
  tg,
};

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split(".");
  let current: unknown = obj;
  for (const part of parts) {
    if (current === undefined || current === null || typeof current !== "object") {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

export function interpolate(
  template: string,
  params?: Record<string, unknown>,
  locale: Locale = DEFAULT_LOCALE,
): string {
  if (!template) return "";
  if (!params) return template;
  let out = "";
  let i = 0;
  while (i < template.length) {
    if (template[i] === "{") {
      let depth = 1;
      let j = i + 1;
      while (j < template.length && depth > 0) {
        if (template[j] === "{") depth++;
        else if (template[j] === "}") depth--;
        j++;
      }
      const expr = template.slice(i + 1, j - 1);
      i = j;
      if (expr.includes(",")) {
        const parts = expr.split(",");
        const variable = parts[0].trim();
        const type = parts[1].trim();
        const body = parts.slice(2).join(",").trim();
        const val = params[variable];
        const branches: Record<string, string> = {};
        let bIdx = 0;
        while (bIdx < body.length) {
          const match = body.slice(bIdx).match(/^\s*(=?\w+)\s*\{/);
          if (!match) break;
          const key = match[1];
          const startBrace = bIdx + match[0].length;
          let bDepth = 1;
          let k = startBrace;
          while (k < body.length && bDepth > 0) {
            if (body[k] === "{") bDepth++;
            else if (body[k] === "}") bDepth--;
            k++;
          }
          branches[key] = body.slice(startBrace, k - 1);
          bIdx = k;
        }
        let chosen = "";
        if (type === "select") {
          const str = String(val);
          chosen = branches[str] ?? branches["other"] ?? "";
        } else if (type === "plural") {
          const num = Number(val);
          if (branches["=" + num] !== undefined) {
            chosen = branches["=" + num];
          } else {
            try {
              const pr = new Intl.PluralRules(locale);
              const rule = pr.select(num);
              chosen = branches[rule] ?? branches["other"] ?? "";
            } catch {
              chosen = branches["other"] ?? "";
            }
          }
          chosen = chosen.replace(/#/g, String(val));
        }
        out += interpolate(chosen, params, locale);
      } else {
        const key = expr.trim();
        out +=
          params[key] !== undefined && params[key] !== null
            ? String(params[key])
            : "{" + key + "}";
      }
    } else {
      out += template[i];
      i++;
    }
  }
  return out;
}

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, params?: Record<string, unknown>) => string;
  format: {
    date: (date: Date | string | number, options?: Intl.DateTimeFormatOptions) => string;
    time: (date: Date | string | number, options?: Intl.DateTimeFormatOptions) => string;
    dateTime: (date: Date | string | number, options?: Intl.DateTimeFormatOptions) => string;
    number: (value: number, options?: Intl.NumberFormatOptions) => string;
  };
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({
  children,
  initialLocale,
}: {
  children: React.ReactNode;
  initialLocale?: Locale;
}) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    if (initialLocale && isSupportedLocale(initialLocale)) return initialLocale;
    return getClientLocale();
  });

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = locale;
    }
  }, [locale]);

  const changeLocale = useCallback((nextLocale: Locale) => {
    if (!isSupportedLocale(nextLocale)) return;
    setLocaleState(nextLocale);
    setClientLocale(nextLocale);
  }, []);

  const t = useCallback(
    (key: string, params?: Record<string, unknown>): string => {
      const activeDict = DICTIONARIES[locale] || DICTIONARIES[DEFAULT_LOCALE];
      let value = getNestedValue(activeDict, key);
      if (value === undefined && locale !== DEFAULT_LOCALE) {
        value = getNestedValue(DICTIONARIES[DEFAULT_LOCALE], key);
      }
      if (value === undefined) {
        return key;
      }
      if (typeof value === "string") {
        return interpolate(value, params, locale);
      }
      if (Array.isArray(value)) {
        return value.join(", ");
      }
      return String(value);
    },
    [locale],
  );

  const format = useMemo(
    () => ({
      date: (d: Date | string | number, opts?: Intl.DateTimeFormatOptions) =>
        formatDate(d, locale, opts),
      time: (d: Date | string | number, opts?: Intl.DateTimeFormatOptions) =>
        formatTime(d, locale, opts),
      dateTime: (d: Date | string | number, opts?: Intl.DateTimeFormatOptions) =>
        formatDateTime(d, locale, opts),
      number: (v: number, opts?: Intl.NumberFormatOptions) =>
        formatNumber(v, locale, opts),
    }),
    [locale],
  );

  const contextValue = useMemo(
    () => ({
      locale,
      setLocale: changeLocale,
      t,
      format,
    }),
    [locale, changeLocale, t, format],
  );

  return (
    <I18nContext.Provider value={contextValue}>{children}</I18nContext.Provider>
  );
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    // Graceful fallback for non-provider rendering (tests/ssr)
    return {
      locale: DEFAULT_LOCALE,
      setLocale: () => {},
      t: (key: string, params?: Record<string, unknown>) => {
        const val = getNestedValue(DICTIONARIES[DEFAULT_LOCALE], key);
        return typeof val === "string" ? interpolate(val, params, DEFAULT_LOCALE) : key;
      },
      format: {
        date: (d, o) => formatDate(d, DEFAULT_LOCALE, o),
        time: (d, o) => formatTime(d, DEFAULT_LOCALE, o),
        dateTime: (d, o) => formatDateTime(d, DEFAULT_LOCALE, o),
        number: (v, o) => formatNumber(v, DEFAULT_LOCALE, o),
      },
    };
  }
  return ctx;
}

export function useTranslation(namespace?: string) {
  const { t, locale, format } = useI18n();

  const scopedT = useCallback(
    (key: string, params?: Record<string, unknown>): string => {
      const fullKey = namespace && !key.includes(".") ? `${namespace}.${key}` : key;
      return t(fullKey, params);
    },
    [namespace, t],
  );

  return { t: scopedT, locale, format };
}

export function useLocale() {
  const { locale, setLocale } = useI18n();
  return {
    locale,
    setLocale,
    locales: SUPPORTED_LOCALES,
    localeLabels: LOCALE_LABELS,
    localeNames: LOCALE_NAMES,
  };
}
