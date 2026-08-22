// src/components/ManagedListRow.tsx
import React, { useState } from "react";
import { Icon } from "../icons/Icon";
import { TextElement } from "../icons/TextElement";
import "./ManagedListRow.css";

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
    >
      {/* Primary Row: Drag Handle, Name, Add Image, Edit, Delete */}
      <div className="list-row-primary">
        <span className="list-row-drag-handle">
          <TextElement elementKey="drag-handle" />
        </span>

        {editing ? (
          <input
            className="list-row-edit-input"
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
          />
        ) : (
          <span className="list-row-label" onClick={onOpen}>
            {label}
          </span>
        )}

        {onAddImage && (
          <label className="list-row-add-image">
            <Icon iconKey="add-image" size={13} /> {imageUrl ? "Change Image" : "Add Image"}
            <input
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              style={{ display: "none" }}
            />
          </label>
        )}

        <button className="icon-button" onClick={() => setEditing(true)} title="Rename">
          <Icon iconKey="rename" size={14} />
        </button>
        <button className="icon-button danger" onClick={onDelete} title="Delete">
          <Icon iconKey="delete" size={14} />
        </button>
      </div>

      {/* Secondary Row: State Flags */}
      {onToggleFlag && (
        <div className="list-row-flags">
          <label className="list-row-flag">
            <input
              type="checkbox"
              checked={isProven}
              onChange={() => onToggleFlag("isProven", true)}
            />
            Proven
          </label>

          <label className="list-row-flag">
            <input
              type="checkbox"
              checked={!isProven}
              onChange={() => onToggleFlag("isProven", false)}
            />
            Unproven
          </label>

          <label className="list-row-flag">
            <input
              type="checkbox"
              checked={isFrozen}
              onChange={(e) => onToggleFlag("isFrozen", e.target.checked)}
            />
            Frozen
          </label>

          <label className="list-row-flag">
            <input
              type="checkbox"
              checked={isHomegrown}
              onChange={(e) => onToggleFlag("isHomegrown", e.target.checked)}
            />
            Homegrown
          </label>

          <label className="list-row-flag">
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
