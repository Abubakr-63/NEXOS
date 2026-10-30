import { requireWorkspaceSession } from "@/lib/session-server";
import { Projects } from "@/components/studio";
export default async function Page() {
  await requireWorkspaceSession();
  return <Projects />;
}

// Session authorization intentionally waits for the authoritative API; never cache it to satisfy prefetch validation.
export const instant = false;
