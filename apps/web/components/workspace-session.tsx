"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authenticationResponseSchema } from "@rom-hub/contracts";
import { SessionUnavailable } from "./auth/session-unavailable";
/** Server guards authorize initial rendering; this observer rechecks visibility/history and idle expiry. */
export function WorkspaceSession({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [verified, setVerified] = useState<{
    status: "checking" | "valid" | "unavailable";
  }>({ status: "valid" });
  useEffect(() => {
    let active = true,
      controller: AbortController | undefined;
    const check = async () => {
      controller?.abort();
      controller = new AbortController();
      setVerified({ status: "checking" });
      const current = controller;
      const deadline = setTimeout(() => current.abort(), 4000);
      try {
        const response = await fetch("/api/v1/auth/me", {
          credentials: "same-origin",
          cache: "no-store",
          signal: current.signal,
        });
        if (!active || current !== controller) return;
        if (response.status === 401) {
          router.replace("/login");
          router.refresh();
          return;
        }
        const valid =
          response.ok &&
          authenticationResponseSchema.safeParse(await response.json()).success;
        if (active && current === controller)
          setVerified({ status: valid ? "valid" : "unavailable" });
      } catch {
        if (active && current === controller)
          setVerified({ status: "unavailable" });
      } finally {
        clearTimeout(deadline);
      }
    };
    const visible = () => {
      if (!document.hidden) void check();
    };
    const interval = setInterval(visible, 60000);
    document.addEventListener("visibilitychange", visible);
    window.addEventListener("popstate", visible);
    return () => {
      active = false;
      controller?.abort();
      clearInterval(interval);
      document.removeEventListener("visibilitychange", visible);
      window.removeEventListener("popstate", visible);
    };
  }, [router]);
  if (verified.status === "checking")
    return (
      <p className="session-check" role="status">
        Verifying your session…
      </p>
    );
  if (verified.status === "unavailable") return <SessionUnavailable />;
  return children;
}
