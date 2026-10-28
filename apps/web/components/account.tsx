"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { NEXOSLogo } from "./nexos-logo";
import { useRouter } from "next/navigation";
import { Button } from "@rom-hub/ui";
type User = {
  id: string;
  username: string;
  role: string;
  emailVerifiedAt: string | null;
};
async function request(path: string, method = "GET", body?: unknown) {
  const res = await fetch(`/api/v1/${path}`, {
    method,
    credentials: "same-origin",
    headers: method !== "GET" ? { "Content-Type": "application/json" } : {},
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const data = await res.json().catch(() => ({
    error: {
      message:
        "The API is unavailable. Start the API and database, then try again.",
    },
  }));
  if (!res.ok)
    throw new Error(
      Array.isArray(data.error?.message)
        ? data.error.message.join(". ")
        : (data.error?.message ?? "Request failed"),
    );
  return data;
}
export function AccountForm() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  async function submit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      await request(`auth/${mode}`, "POST", {
        email: form.get("email"),
        password: form.get("password"),
        ...(mode === "register" ? { username: form.get("username") } : {}),
      });
      router.push("/settings");
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Unable to connect. Try again.",
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <div className="page-content">
      <div className="auth-wrap">
        <div className="nexos-auth-brand">
          <NEXOSLogo size={36} />
        </div>
        <div className="eyebrow">
          <span /> YOUR NEXOS ACCOUNT
        </div>
        <h1>
          {mode === "login"
            ? "Welcome to your next chapter."
            : "Make room for possibilities."}
        </h1>
        <p>
          Create your NEXOS account to save configurations and continue shaping
          your Android across sessions.
        </p>
        <div className="panel">
          <div className="auth-tabs">
            <button
              className={mode === "login" ? "selected" : ""}
              onClick={() => {
                setMode("login");
                setError("");
              }}
            >
              Sign in
            </button>
            <button
              className={mode === "register" ? "selected" : ""}
              onClick={() => {
                setMode("register");
                setError("");
              }}
            >
              Create account
            </button>
          </div>
          <form className="auth-form" onSubmit={submit}>
            {mode === "register" && (
              <label className="form-field">
                Username
                <input
                  name="username"
                  required
                  minLength={3}
                  maxLength={30}
                  pattern="[a-zA-Z0-9_]+"
                  autoComplete="username"
                  placeholder="your_handle"
                />
              </label>
            )}
            <label className="form-field">
              Email address
              <input
                name="email"
                type="email"
                required
                maxLength={254}
                autoComplete="email"
                placeholder="you@example.com"
              />
            </label>
            <label className="form-field">
              Password
              <input
                name="password"
                type="password"
                required
                minLength={12}
                maxLength={128}
                autoComplete={
                  mode === "register" ? "new-password" : "current-password"
                }
                placeholder="At least 12 characters"
              />
            </label>
            {error && (
              <p className="form-status" role="alert">
                {error}
              </p>
            )}
            <Button className="primary" type="submit" disabled={pending}>
              {pending
                ? "Connecting…"
                : mode === "register"
                  ? "Create account"
                  : "Sign in"}
            </Button>
          </form>
        </div>
        <p>
          Email verification, password recovery, and OAuth sign-in are not
          enabled yet. Use a local development account while evaluating the
          foundation.
        </p>
        <Link href="/explore" className="back-link">
          Continue exploring the demo catalog →
        </Link>
      </div>
    </div>
  );
}
export function Settings() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sessions, setSessions] = useState<
    { id: string; createdAt: string; expiresAt: string }[]
  >([]);
  const [pending, setPending] = useState(false);
  async function load() {
    try {
      const data = await request("auth/me");
      setUser(data.user);
      const list = await request("auth/sessions");
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
    request("auth/me")
      .then(async (data) => {
        if (!active) return;
        setUser(data.user);
        const list = await request("auth/sessions");
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
      await request("auth/logout", "POST", {});
      setUser(null);
      setSessions([]);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign out failed");
    } finally {
      setPending(false);
    }
  }
  async function revoke(id: string) {
    setPending(true);
    try {
      await request(`auth/sessions/${id}`, "DELETE", {});
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
              <dt>Username</dt>
              <dd>{user.username}</dd>
              <dt>Role</dt>
              <dd>{user.role}</dd>
              <dt>Email</dt>
              <dd>{user.emailVerifiedAt ? "Verified" : "Not verified"}</dd>
            </dl>
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
