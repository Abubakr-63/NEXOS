import { requireWorkspaceSession } from "@/lib/session-server";
import { ProjectCreation } from "@/components/project-creation";
export default async function Page() {
  await requireWorkspaceSession();
  return <ProjectCreation />;
}

// Session authorization intentionally waits for the authoritative API; never cache it to satisfy prefetch validation.
export const instant = false;
