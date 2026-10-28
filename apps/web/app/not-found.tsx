import Link from "next/link";
export default function NotFound() {
  return (
    <div className="error-page">
      <h1>This page isn’t here.</h1>
      <p>
        The address may have changed, or this feature may not yet be available.
      </p>
      <Link href="/" className="button primary">
        Back to overview
      </Link>
    </div>
  );
}
