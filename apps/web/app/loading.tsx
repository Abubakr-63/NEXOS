export default function Loading() {
  return (
    <div className="page-content" role="status" aria-label="Loading page">
      <div className="panel" style={{ minHeight: 300, opacity: 0.5 }}>
        <p>Loading NEXOS…</p>
      </div>
    </div>
  );
}
