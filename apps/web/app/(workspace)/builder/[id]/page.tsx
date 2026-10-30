import { requireWorkspaceSession } from "@/lib/session-server";
import { Studio } from "@/components/studio";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireWorkspaceSession();
  const { id } = await params;
  return <Studio key={id} id={id} />;
}

// Session authorization intentionally waits for the authoritative API; never cache it to satisfy prefetch validation.
export const instant = false;
