import { requireWorkspaceSession } from "@/lib/session-server";
import { notFound } from "next/navigation";
export default async function Page() {
  await requireWorkspaceSession();
  notFound();
}

// Session authorization intentionally waits for the authoritative API; never cache it to satisfy prefetch validation.
export const instant = false;
