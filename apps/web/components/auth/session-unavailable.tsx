"use client";

import Link from "next/link";
import { useTranslation } from "@/lib/i18n";

export function SessionUnavailable() {
  const { t } = useTranslation("auth");
  const { t: tc } = useTranslation("common");

  return (
    <main className="session-check" role="alert">
      <h1>{t("sessionUnavailableTitle")}</h1>
      <p>{t("sessionUnavailableDesc")}</p>
      <Link className="button primary" href="/login">
        {tc("retry")}
      </Link>
    </main>
  );
}
