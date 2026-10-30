"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@rom-hub/ui";
import { accountRequest as request } from "@/lib/account-api";
import type {
  PublicUser as User,
  Session,
  AuthenticationResponse,
  SessionsResponse,
  SuccessResponse,
} from "@rom-hub/contracts";
export function Settings() {
  const router = useRouter();
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
            <span /> ACCOUNT & PREFERENCES
          </div>
          <h1>Your space. Your settings.</h1>
          <p>Manage your account session and appearance.</p>
        </div>
      </div>
      <section className="panel">
        <h2>Appearance</h2>
        <p>
          Switch themes using the sun icon in the sidebar. Your preference is
          saved on this device.
        </p>
      </section>
      <section className="panel">
        <h2>Account</h2>
        {loading ? (
          <p role="status">Loading your account…</p>
        ) : user ? (
          <>
            <dl className="detail-list">
              <dt>Username (read-only)</dt>
              <dd>{user.username}</dd>
              <dt>Role</dt>
              <dd>{user.role}</dd>
              <dt>Email verification</dt>
              <dd>{user.emailVerifiedAt ? "Verified" : "Not verified"}</dd>
            </dl>
            <p>
              Account editing, password changes and email verification are not
              available in this version.
            </p>
            <div className="settings-actions">
              <Button onClick={logout} disabled={pending}>
                Sign out
              </Button>
            </div>
          </>
        ) : (
          <>
            <p>Sign in to view and manage your sessions.</p>
            <div className="settings-actions">
              <Link className="button primary" href="/login">
                Sign in or create an account
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
          <h2>Active sessions</h2>
          <p>
            Revoke a session to end its access, including this browser’s
            session.
          </p>
          <ol className="roadmap">
            {sessions.map((s) => (
              <li key={s.id}>
                <div>
                  Session {s.id.slice(-6)}
                  <small>
                    Created {new Date(s.createdAt).toLocaleString()} · Expires{" "}
                    {new Date(s.expiresAt).toLocaleDateString()}
                  </small>
                </div>
                <Button disabled={pending} onClick={() => revoke(s.id)}>
                  Revoke
                </Button>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}
