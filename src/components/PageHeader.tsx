// src/components/PageHeader.tsx
import type { ReactNode } from "react";
import { Icon } from "../icons/Icon";
import { TextElement } from "../icons/TextElement";

export function PageHeader({
  title,
  onAdd,
  onOpenGraph,
  extraActions,
}: {
  title: string;
  onAdd: () => void;
  onOpenGraph?: () => void;
  // Extra buttons rendered before the "Add" button (e.g. Recipes' "Add
  // Future Slot"). Optional so every other PageHeader caller is unaffected.
  extraActions?: ReactNode;
}) {
  return (
    <div className="page-header">
      <h1 className="page-title">{title}</h1>
      <div className="page-header-actions">
        {onOpenGraph && (
          <button className="icon-button" onClick={onOpenGraph} title="Open Web View">
            <Icon iconKey="web-view" size={16} />
          </button>
        )}
        {extraActions}
        <button className="icon-button" onClick={onAdd} title="Add">
          <TextElement elementKey="add-button" />
        </button>
      </div>
    </div>
  );
}
