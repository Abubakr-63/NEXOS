import { requireWorkspaceSession } from "@/lib/session-server";
import { ProjectDetails } from "@/components/project-details";
export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  await requireWorkspaceSession();
  const { slug } = await params;
  return <ProjectDetails key={slug} id={slug} />;
}

// Session authorization intentionally waits for the authoritative API; never cache it to satisfy prefetch validation.
export const instant = false;
