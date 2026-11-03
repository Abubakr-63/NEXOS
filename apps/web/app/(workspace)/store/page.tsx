import { requireWorkspaceSession } from "@/lib/session-server";
import { StorePageView } from "@/components/store/store-page-view";

export default async function Page() {
  await requireWorkspaceSession();
  return <StorePageView />;
}

export const instant = false;
