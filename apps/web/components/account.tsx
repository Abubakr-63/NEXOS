"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@rom-hub/ui";
import { accountRequest as request } from "@/lib/account-api";
import { useTranslation } from "@/lib/i18n";
import { LanguageSwitcher } from "./language-switcher";
import type {
  PublicUser as User,
  Session,
  AuthenticationResponse,
  SessionsResponse,
  SuccessResponse,
} from "@rom-hub/contracts";

export function Settings() {
  const router = useRouter();
  const { t, format } = useTranslation("settings");
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sessions, setSessions] = useState<Session[]>([]);
  const [pending, setPending] = useState(false);

  async function load() {
    try {
      const data = await request<AuthenticationResponse>("auth/me");
      setUser(data.user);
      const list = await request<SessionsResponse>("auth/sessions");
      setSessions(list.items);
    } catch (e) {
      setUser(null);
      setSessions([]);
      setError(e instanceof Error ? e.message : "Could not load account");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    request<AuthenticationResponse>("auth/me")
      .then(async (data) => {
        if (!active) return;
        setUser(data.user);
        const list = await request<SessionsResponse>("auth/sessions");
        if (active) setSessions(list.items);
      })
      .catch((e) => {
        if (active)
          setError(e instanceof Error ? e.message : "Could not load account");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function logout() {
    setPending(true);
    try {
      await request<SuccessResponse>("auth/logout", "POST", {});
      setUser(null);
      setSessions([]);
      setError("");
      router.replace("/login");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign out failed");
    } finally {
      setPending(false);
    }
  }

  async function revoke(id: string) {
    setPending(true);
    try {
      await request<SuccessResponse>(`auth/sessions/${id}`, "DELETE", {});
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not revoke session");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="page-content">
      <div className="page-heading">
        <div>
          <div className="eyebrow">
            <span /> {t("eyebrow")}
          </div>
          <h1>{t("title")}</h1>
          <p>{t("subtitle")}</p>
        </div>
      </div>

      <section className="panel">
        <h2>{t("languageTitle")}</h2>
        <p>{t("languageDesc")}</p>
        <LanguageSwitcher variant="full" />
      </section>

      <section className="panel">
        <h2>{t("appearanceTitle")}</h2>
        <p>{t("appearanceDesc")}</p>
      </section>

      <section className="panel">
        <h2>{t("accountTitle")}</h2>
        {loading ? (
          <p role="status">{t("loadingAccount")}</p>
        ) : user ? (
          <>
            <dl className="detail-list">
              <dt>{t("usernameReadOnly")}</dt>
              <dd>{user.username}</dd>
              <dt>{t("roleLabel")}</dt>
              <dd>{user.role}</dd>
              <dt>{t("emailVerificationLabel")}</dt>
              <dd>{user.emailVerifiedAt ? t("verified") : t("notVerified")}</dd>
            </dl>
            <p>{t("editingUnavailable")}</p>
            <div className="settings-actions">
              <Button onClick={logout} disabled={pending}>
                {pending ? t("signingOut") : t("signOut")}
              </Button>
            </div>
          </>
        ) : (
          <>
            <p>{t("signInPrompt")}</p>
            <div className="settings-actions">
              <Link className="button primary" href="/login">
                {t("signInOrCreate")}
              </Link>
            </div>
          </>
        )}
        {error && (
          <p role="alert" className="form-status">
            {error}
          </p>
        )}
      </section>

      {user && (
        <section className="panel">
          <h2>{t("activeSessionsTitle")}</h2>
          <p>{t("activeSessionsDesc")}</p>
          <ol className="roadmap">
            {sessions.map((s) => (
              <li key={s.id}>
                <div>
                  {t("sessionLabel", { id: s.id.slice(-6) })}
                  <small>
                    {t("createdOn", {
                      created: format.dateTime(s.createdAt),
                      expires: format.date(s.expiresAt),
                    })}
                  </small>
                </div>
                <Button disabled={pending} onClick={() => revoke(s.id)}>
                  {pending ? t("revoking") : t("revoke")}
                </Button>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}
