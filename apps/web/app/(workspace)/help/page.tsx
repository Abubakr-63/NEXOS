import { requireWorkspaceSession } from "@/lib/session-server";
import { HelpContent } from "@/components/help-content";

export const metadata = { title: "Help & documentation" };
export const instant = false;

export default async function Page() {
  await requireWorkspaceSession();
  return <HelpContent />;
}
