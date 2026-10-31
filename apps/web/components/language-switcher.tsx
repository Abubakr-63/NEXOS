"use client";

import { useId, useRef, useState, useEffect } from "react";
import { Globe, Check, ChevronDown } from "lucide-react";
import { useLocale } from "@/lib/i18n";
import { Locale, LOCALE_LABELS, LOCALE_NAMES } from "@/lib/i18n/types";

export function LanguageSwitcher({
  variant = "compact",
  className = "",
  ariaLabel = "Select language",
}: {
  variant?: "compact" | "full" | "select";
  className?: string;
  ariaLabel?: string;
}) {
  const { locale, setLocale, locales } = useLocale();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownId = useId();

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  if (variant === "select") {
    return (
      <div className={`language-select-wrapper ${className}`}>
        <label htmlFor={dropdownId} className="auth-sr-only">
          {ariaLabel}
        </label>
        <div className="language-select-inner">
          <Globe size={15} className="language-icon" aria-hidden="true" />
          <select
            id={dropdownId}
            value={locale}
            onChange={(e) => setLocale(e.target.value as Locale)}
            aria-label={ariaLabel}
            className="language-native-select"
          >
            {locales.map((loc) => (
              <option key={loc} value={loc}>
                {LOCALE_LABELS[loc]}
              </option>
            ))}
          </select>
          <ChevronDown size={14} className="language-chevron" aria-hidden="true" />
        </div>
      </div>
    );
  }

  if (variant === "full") {
    return (
      <div
        className={`language-full-selector ${className}`}
        role="radiogroup"
        aria-label={ariaLabel}
      >
        {locales.map((loc) => {
          const active = loc === locale;
          return (
            <button
              key={loc}
              type="button"
              role="radio"
              aria-checked={active}
              className={`language-card-option ${active ? "active" : ""}`}
              onClick={() => setLocale(loc)}
            >
              <div className="language-card-info">
                <span className="language-card-title">{LOCALE_LABELS[loc]}</span>
                <span className="language-card-sub">{LOCALE_NAMES[loc]}</span>
              </div>
              {active && <Check size={18} className="language-card-check" />}
            </button>
          );
        })}
      </div>
    );
  }

  // Default compact dropdown
  return (
    <div
      ref={containerRef}
      className={`language-switcher-container ${className}`}
      data-open={open}
    >
      <button
        type="button"
        className="language-trigger-btn"
        aria-label={`${ariaLabel}: ${LOCALE_LABELS[locale]}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={dropdownId}
        onClick={() => setOpen((prev) => !prev)}
      >
        <Globe size={15} aria-hidden="true" />
        <span className="language-current-label">{LOCALE_LABELS[locale]}</span>
        <ChevronDown
          size={13}
          className={`language-arrow ${open ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
      </button>

      {open && (
        <ul
          id={dropdownId}
          role="listbox"
          aria-label={ariaLabel}
          className="language-dropdown-menu"
        >
          {locales.map((loc) => {
            const active = loc === locale;
            return (
              <li
                key={loc}
                role="option"
                aria-selected={active}
                className={`language-dropdown-item ${active ? "selected" : ""}`}
                onClick={() => {
                  setLocale(loc);
                  setOpen(false);
                }}
              >
                <span>{LOCALE_LABELS[loc]}</span>
                {active && <Check size={14} aria-hidden="true" />}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
