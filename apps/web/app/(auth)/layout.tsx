import { SessionUnavailable } from "@/components/auth/session-unavailable";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { AuthRoutes } from "@/components/auth/auth-routes";
import { readServerSession } from "@/lib/session-server";
async function PublicAuth({ children }: { children: React.ReactNode }) {
  const session = await readServerSession();
  if (session.state === "authenticated") redirect("/settings");
  if (session.state === "unavailable") return <SessionUnavailable />;
  return <AuthRoutes>{children}</AuthRoutes>;
}
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense
      fallback={
        <p className="session-check" role="status">
          Checking your account…
        </p>
      }
    >
      <PublicAuth>{children}</PublicAuth>
    </Suspense>
  );
}

// Session authorization intentionally waits for the authoritative API; never cache it to satisfy prefetch validation.
export const instant = false;
