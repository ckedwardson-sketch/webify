// src/components/PageHeader.tsx
import { Icon } from "../icons/Icon";
import { TextElement } from "../icons/TextElement";

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
            <Icon iconKey="web-view" size={16} />
          </button>
        )}
        <button className="icon-button" onClick={onAdd} title="Add">
          <TextElement elementKey="add-button" />
        </button>
      </div>
    </div>
  );
}
