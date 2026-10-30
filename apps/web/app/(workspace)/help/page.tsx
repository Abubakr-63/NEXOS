import { requireWorkspaceSession } from "@/lib/session-server";
import Link from "next/link";
export const metadata = { title: "Help & documentation" };
export const instant = false;
export default async function Page() {
  await requireWorkspaceSession();
  return (
    <div className="craft-page">
      <div className="craft-heading">
        <div>
          <span className="craft-kicker">NEXOS GUIDE</span>
          <h1>Help & documentation</h1>
          <p>From an idea to a saved configuration.</p>
        </div>
      </div>
      <section className="panel">
        <h2>Start a project</h2>
        <p>
          Create ROM walks through identity, exact device variant, Android base
          and review. Catalog identification does not establish build support.
        </p>
        <Link href="/projects/new">Create a draft →</Link>
      </section>
      <section className="panel">
        <h2>Shape your configuration</h2>
        <p>
          Open a saved project in the ten-stage Visual Builder. Appearance and
          app selections update the conceptual display. Save commits a revision;
          Undo restores your previous local edit. Export downloads the
          configuration JSON.
        </p>
        <Link href="/projects">Open your projects →</Link>
      </section>
      <section className="panel">
        <h2>Understand the preview</h2>
        <p>
          The automatic 3D preview is a generic configuration concept. It is not
          an emulator, compiled firmware or proof of compatibility. Cloud
          compilation is unavailable.
        </p>
      </section>
      <section className="panel">
        <h2>Manage access</h2>
        <p>
          Settings lists active sessions and lets you revoke access or sign out.
          Theme preferences are saved on this browser.
        </p>
        <Link href="/settings">Account settings →</Link>
      </section>
    </div>
  );
}
