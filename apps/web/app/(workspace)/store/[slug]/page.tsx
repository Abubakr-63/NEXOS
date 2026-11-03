import { requireWorkspaceSession } from "@/lib/session-server";
import { getStoreProjectBySlug } from "@/lib/store-adapter";
import { StoreDetailsView } from "@/components/store/store-details-view";
import { notFound } from "next/navigation";

export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  await requireWorkspaceSession();
  const { slug } = await params;
  const project = await getStoreProjectBySlug(slug);

  if (!project) {
    notFound();
  }

  return <StoreDetailsView project={project} />;
}

export const instant = false;
