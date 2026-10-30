import { requireWorkspaceSession } from "@/lib/session-server";
import { Overview } from "@/components/workspace-pages";
export default async function Page() {
  const user = await requireWorkspaceSession();
  return <Overview user={user} />;
}

// Session authorization intentionally waits for the authoritative API; never cache it to satisfy prefetch validation.
export const instant = false;
