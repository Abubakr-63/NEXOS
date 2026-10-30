import { requireWorkspaceSession } from "@/lib/session-server";
import { Profile } from "@/components/workspace-pages";
export const metadata = { title: "Profile" };
export const instant = false;
export default async function Page() {
  const user = await requireWorkspaceSession();
  return <Profile user={user} />;
}
