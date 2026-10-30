import { requireWorkspaceSession } from "@/lib/session-server";
import { Settings } from "@/components/account";
export const metadata = { title: "Settings" };
export default async function SettingsPage() {
  await requireWorkspaceSession();
  return <Settings />;
}

// Session authorization intentionally waits for the authoritative API; never cache it to satisfy prefetch validation.
export const instant = false;
