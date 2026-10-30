import Link from "next/link";
export function SessionUnavailable() {
  return (
    <main className="session-check" role="alert">
      <h1>Account verification is unavailable.</h1>
      <p>
        Your workspace remains protected. Please try again when the account
        service is available.
      </p>
      <Link className="button primary" href="/login">
        Retry account check
      </Link>
    </main>
  );
}
