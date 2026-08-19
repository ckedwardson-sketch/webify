// src/components/ManagedListRow.tsx
import React, { useState } from "react";

interface ManagedListRowProps {
  label: string;
  imageUrl?: string;
  isProven?: boolean;
  isFrozen?: boolean;
  isHomegrown?: boolean;
  isFavorite?: boolean;
  onOpen: () => void;
  onRename: (newName: string) => void;
  onDelete: () => void;
  onAddImage?: (file: File) => void;
  onToggleFlag?: (flagKey: string, value: boolean) => void;
  onDragStart: () => void;
  onDropOn: () => void;
}

export function ManagedListRow({
  label,
  imageUrl,
  isProven = false,
  isFrozen = false,
  isHomegrown = false,
  isFavorite = false,
  onOpen,
  onRename,
  onDelete,
  onAddImage,
  onToggleFlag,
  onDragStart,
  onDropOn,
}: ManagedListRowProps) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(label);

  const confirm = () => {
    setEditing(false);
    const trimmed = val.trim();
    if (trimmed && trimmed !== label) {
      onRename(trimmed);
    } else {
      setVal(label);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0] && onAddImage) {
      onAddImage(e.target.files[0]);
      e.target.value = "";
    }
  };

  return (
    <li
      className="list-row"
      draggable
      onDragStart={onDragStart}
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDropOn}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "8px",
        padding: "12px",
        borderBottom: "1px solid #cbd5e1",
        backgroundColor: "#ffffff",
        borderRadius: "6px",
        marginBottom: "8px",
        boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
      }}
    >
      {/* Primary Row: Drag Handle, Name, Add Image, Edit, Delete */}
      <div style={{ display: "flex", alignItems: "center", width: "100%", gap: "10px" }}>
        <span className="drag-handle" style={{ cursor: "grab", userSelect: "none", color: "#64748b" }}>
          ⋮⋮
        </span>

        {editing ? (
          <input
            className="row-edit-input"
            autoFocus
            value={val}
            onChange={(e) => setVal(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") confirm();
              if (e.key === "Escape") {
                setVal(label);
                setEditing(false);
              }
            }}
            onBlur={confirm}
            style={{ flex: 1, padding: "4px 8px", fontSize: "14px" }}
          />
        ) : (
          <span
            className="row-label"
            onClick={onOpen}
            style={{ cursor: "pointer", flex: 1, fontWeight: "600", fontSize: "15px", color: "#0f172a" }}
          >
            {label}
          </span>
        )}

        {onAddImage && (
          <label
            style={{
              padding: "4px 10px",
              fontSize: "12px",
              backgroundColor: "#f1f5f9",
              border: "1px solid #cbd5e1",
              borderRadius: "4px",
              cursor: "pointer",
              fontWeight: "500",
              color: "#334155",
              whiteSpace: "nowrap",
            }}
          >
            📷 {imageUrl ? "Change Image" : "Add Image"}
            <input
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              style={{ display: "none" }}
            />
          </label>
        )}

        <button className="icon-button" onClick={() => setEditing(true)} title="Rename">
          ✏️
        </button>
        <button className="icon-button danger" onClick={onDelete} title="Delete">
          🗑️
        </button>
      </div>

      {/* Secondary Row: State Flags */}
      {onToggleFlag && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "16px",
            fontSize: "12px",
            paddingLeft: "28px",
            color: "#475569",
            alignItems: "center",
          }}
        >
          <label style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: "4px" }}>
            <input
              type="checkbox"
              checked={isProven}
              onChange={() => onToggleFlag("isProven", true)}
            />
            Proven
          </label>

          <label style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: "4px" }}>
            <input
              type="checkbox"
              checked={!isProven}
              onChange={() => onToggleFlag("isProven", false)}
            />
            Unproven
          </label>

          <label style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: "4px" }}>
            <input
              type="checkbox"
              checked={isFrozen}
              onChange={(e) => onToggleFlag("isFrozen", e.target.checked)}
            />
            Frozen
          </label>

          <label style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: "4px" }}>
            <input
              type="checkbox"
              checked={isHomegrown}
              onChange={(e) => onToggleFlag("isHomegrown", e.target.checked)}
            />
            Homegrown
          </label>

          <label style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: "4px" }}>
            <input
              type="checkbox"
              checked={isFavorite}
              onChange={(e) => onToggleFlag("isFavorite", e.target.checked)}
            />
            Favorite
          </label>
        </div>
      )}
    </li>
  );
}