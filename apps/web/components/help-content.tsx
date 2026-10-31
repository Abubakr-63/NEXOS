"use client";

import Link from "next/link";
import { useTranslation } from "@/lib/i18n";

export function HelpContent() {
  const { t } = useTranslation("help");

  return (
    <div className="craft-page">
      <div className="craft-heading">
        <div>
          <span className="craft-kicker">{t("kicker")}</span>
          <h1>{t("title")}</h1>
          <p>{t("subtitle")}</p>
        </div>
      </div>
      <section className="panel">
        <h2>{t("startProjectTitle")}</h2>
        <p>{t("startProjectDesc")}</p>
        <Link href="/projects/new">{t("createDraftLink")}</Link>
      </section>
      <section className="panel">
        <h2>{t("shapeConfigTitle")}</h2>
        <p>{t("shapeConfigDesc")}</p>
        <Link href="/projects">{t("openProjectsLink")}</Link>
      </section>
      <section className="panel">
        <h2>{t("understandPreviewTitle")}</h2>
        <p>{t("understandPreviewDesc")}</p>
      </section>
      <section className="panel">
        <h2>{t("manageAccessTitle")}</h2>
        <p>{t("manageAccessDesc")}</p>
        <Link href="/settings">{t("accountSettingsLink")}</Link>
      </section>
    </div>
  );
}

