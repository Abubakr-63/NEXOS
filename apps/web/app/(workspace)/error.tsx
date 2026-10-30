"use client";
import Link from "next/link";
export default function WorkspaceError({ reset }: { reset: () => void }) {
  return (
    <section className="session-check" role="alert">
      <h1>Workspace access is unavailable.</h1>
      <p>
        Your account could not be verified. Try again when the service is
        available.
      </p>
      <button className="button primary" onClick={reset}>
        Try again
      </button>
      <Link href="/login">Back to sign in</Link>
    </section>
  );
}
