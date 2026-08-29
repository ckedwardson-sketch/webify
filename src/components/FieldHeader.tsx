import { useState } from "react";

// A field's label, editable via double-click while rearrange mode is
// active — for every built-in field (Goals, Reasoning, Priority, ...),
// not just freetext boxes (which already had their own always-editable
// label input — see FreetextFieldEditor). `defaultLabel` is what shows
// when no override is set; passing `null` to onRename clears back to it.
export function FieldHeader({
  defaultLabel,
  customLabel,
  editable,
  onRename,
  as: Tag = "label",
  className = "project-field-label",
}: {
  defaultLabel: string;
  customLabel: string | null;
  editable: boolean;
  onRename: (label: string | null) => void;
  as?: "label" | "span" | "h2";
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(customLabel ?? defaultLabel);

  const startEdit = () => {
    if (!editable) return;
    setDraft(customLabel ?? defaultLabel);
    setEditing(true);
  };

  const commit = () => {
    setEditing(false);
    const trimmed = draft.trim();
    if (!trimmed || trimmed === defaultLabel) {
      if (customLabel !== null) onRename(null);
      return;
    }
    if (trimmed !== customLabel) onRename(trimmed);
  };

  if (editing) {
    return (
      <input
        className={`${className} field-header-rename-input`}
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") setEditing(false);
        }}
        onClick={(e) => e.stopPropagation()}
      />
    );
  }

  return (
    <Tag
      className={`${className}${editable ? " field-header-editable" : ""}`}
      onDoubleClick={(e) => {
        if (!editable) return;
        e.preventDefault();
        e.stopPropagation();
        startEdit();
      }}
      title={editable ? "Double-click to rename" : undefined}
    >
      {customLabel ?? defaultLabel}
    </Tag>
  );
}
