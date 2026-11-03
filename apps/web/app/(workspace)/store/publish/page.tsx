import { requireWorkspaceSession } from "@/lib/session-server";
import { PublishWizard } from "@/components/store/publish-wizard";

export default async function Page() {
  await requireWorkspaceSession();
  return <PublishWizard />;
}

export const instant = false;
