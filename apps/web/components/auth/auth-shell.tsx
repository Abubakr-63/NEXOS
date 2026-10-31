"use client";

import { useId } from "react";
import Link from "next/link";
import { ArrowUpRight, ShieldCheck } from "lucide-react";
import { PixelExperience } from "../pixel/pixel-experience";
import { NEXOSLogo } from "../nexos-logo";
import { LanguageSwitcher } from "../language-switcher";
import { useTranslation } from "@/lib/i18n";

export type AuthVisualState = "idle" | "pending" | "success";

export function AuthShell({
  mode,
  state,
  children,
  preview,
}: {
  mode: "login" | "register";
  state: AuthVisualState;
  children: React.ReactNode;
  preview?: React.ReactNode;
}) {
  const { t } = useTranslation("auth");
  const register = mode === "register";
  const headingId = `${mode}-${useId()}`;

  const rawTitle = register ? t("registerTitle") : t("signInTitle");
  const titleLines = rawTitle.split("\n");

  return (
    <section
      className="auth-experience"
      data-mode={mode}
      data-state={state}
      aria-labelledby={headingId}
    >
      <div className="auth-form-side">
        <div className="auth-form-content">
          <div className="auth-top-header">
            <Link
              href="/login"
              className="auth-wordmark"
              aria-label="NEXOS Android Creation Studio home"
            >
              <NEXOSLogo size={28} />
            </Link>
            <LanguageSwitcher variant="compact" />
          </div>

          <div className="auth-overline">
            <span /> {t("overline")}
          </div>

          <h1 id={headingId}>
            {titleLines.map((line, idx) => (
              <span key={idx}>
                {line}
                {idx < titleLines.length - 1 && <br />}
              </span>
            ))}
          </h1>

          <p className="auth-intro">
            {register ? t("registerIntro") : t("signInIntro")}
          </p>

          {children}

          <p className="auth-switch">
            {register ? t("alreadyHaveAccount") : t("newAroundHere")}{" "}
            <Link href={register ? "/login" : "/register"}>
              {register ? t("signInBtn") : t("createAccountBtn")}
              <ArrowUpRight size={14} />
            </Link>
          </p>
        </div>

        <div className="auth-form-foot">
          <ShieldCheck size={15} />
          <span>{t("footNote")}</span>
        </div>
      </div>

      <aside
        className="auth-visual-side"
        aria-label="NEXOS cinematic product story"
      >
        {preview ?? (
          <PixelExperience mode={mode} success={state === "success"} />
        )}
      </aside>
    </section>
  );
}
