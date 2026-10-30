import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { lookupSession } from "./session-lookup";
import { workspaceReturnPath } from "./return-path";

/** Per-render memoization only. Never a persistent/shared session cache. */
export const readServerSession = cache(async () => {
  const token = (await cookies()).get("romhub_session")?.value;
  return lookupSession(
    token,
    process.env.API_ORIGIN ?? "http://localhost:4000",
  );
});
export async function requireWorkspaceSession() {
  const session = await readServerSession();
  if (session.state === "anonymous") {
    const path = workspaceReturnPath(
      (await headers()).get("x-nexos-path"),
      "/dashboard",
    );
    redirect(`/login?next=${encodeURIComponent(path)}`);
  }
  if (session.state === "unavailable")
    throw new Error("Account verification is temporarily unavailable.");
  return session.user;
}
