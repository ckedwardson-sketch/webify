import "./Page.css";

export function PlaceholderPage({ label }: { label: string }) {
  return (
    <div className="page">
      <h1 className="page-title">{label}</h1>
      <p className="page-text">Placeholder — not built yet.</p>
    </div>
  );
}
