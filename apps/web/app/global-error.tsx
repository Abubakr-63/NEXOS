"use client";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body>
        <div style={{ padding: 40, fontFamily: "sans-serif", background: "#0b0f19", color: "#f8fafc", minHeight: "100vh" }}>
          <h2>Something went wrong.</h2>
          <button
            style={{ marginTop: 16, padding: "8px 16px", background: "#38bdf8", color: "#031525", border: "none", borderRadius: 6, cursor: "pointer" }}
            onClick={() => reset()}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
