import { WorkspaceSession } from "@/components/workspace-session";
import { Suspense } from "react";
import { Shell } from "@/components/shell";
import { SessionUnavailable } from "@/components/auth/session-unavailable";
import {
  readServerSession,
  requireWorkspaceSession,
} from "@/lib/session-server";
async function Workspace({ children }: { children: React.ReactNode }) {
  if ((await readServerSession()).state === "unavailable")
    return <SessionUnavailable />;
  const user = await requireWorkspaceSession();
  return (
    <WorkspaceSession>
      <Shell user={user}>{children}</Shell>
    </WorkspaceSession>
  );
}
export default function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense
      fallback={
        <p className="session-check" role="status">
          Verifying your session…
        </p>
      }
    >
      <Workspace>{children}</Workspace>
    </Suspense>
  );
}

// Session authorization intentionally waits for the authoritative API; never cache it to satisfy prefetch validation.
export const instant = false;
