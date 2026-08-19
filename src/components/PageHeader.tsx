// src/components/PageHeader.tsx
export function PageHeader({
  title,
  onAdd,
  onOpenGraph,
}: {
  title: string;
  onAdd: () => void;
  onOpenGraph?: () => void;
}) {
  return (
    <div className="page-header">
      <h1 className="page-title">{title}</h1>
      <div style={{ display: "flex", gap: "8px" }}>
        {onOpenGraph && (
          <button className="icon-button" onClick={onOpenGraph} title="Open Web View">
            🕸️
          </button>
        )}
        <button className="icon-button" onClick={onAdd} title="Add">
          +
        </button>
      </div>
    </div>
  );
}