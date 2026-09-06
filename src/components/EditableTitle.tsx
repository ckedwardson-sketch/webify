import { useState } from "react";

// A plain text label that becomes an inline rename input on double-click
// — same commit-on-Enter/blur, cancel-on-Escape convention as PaneGrid's
// rename input, just for a single free-standing title rather than a grid
// item's label.
export function EditableTitle({
  value,
  onSave,
  className,
  inputClassName,
}: {
  value: string;
  onSave: (next: string) => void;
  className?: string;
  inputClassName?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  const startEditing = () => {
    setDraft(value);
    setEditing(true);
  };

  const commit = () => {
    setEditing(false);
    const trimmed = draft.trim();
    if (trimmed && trimmed !== value) onSave(trimmed);
  };

  if (editing) {
    return (
      <input
        className={inputClassName}
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") setEditing(false);
        }}
      />
    );
  }

  return (
    <span className={className} onDoubleClick={startEditing} title="Double-click to rename">
      {value}
    </span>
  );
}
