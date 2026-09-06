// src/components/ManagedListRow.tsx
import React, { useState } from "react";
import { Icon } from "../icons/Icon";
import { TextElement } from "../icons/TextElement";
import { ContextMenu } from "./ContextMenu";
import { itemIdAtPoint } from "../hooks/dragReorder";
import "./ManagedListRow.css";

interface ManagedListRowProps {
  id: number;
  label: string;
  imageUrl?: string;
  isProven?: boolean;
  isFrozen?: boolean;
  isHomegrown?: boolean;
  isFavorite?: boolean;
  isFutureSlot?: boolean;
  onOpen: () => void;
  onRename: (newName: string) => void;
  onDelete: () => void;
  onAddImage?: (file: File) => void;
  onToggleFlag?: (flagKey: string, value: boolean) => void;
  onDragStart: () => void;
  onDragOverTarget: (id: number) => void;
  onDragEnd: () => void;
}

export function ManagedListRow({
  id,
  label,
  imageUrl,
  isProven = false,
  isFrozen = false,
  isHomegrown = false,
  isFavorite = false,
  isFutureSlot = false,
  onOpen,
  onRename,
  onDelete,
  onAddImage,
  onToggleFlag,
  onDragStart,
  onDragOverTarget,
  onDragEnd,
}: ManagedListRowProps) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(label);
  const [dragging, setDragging] = useState(false);
  const [menuAt, setMenuAt] = useState<{ x: number; y: number } | null>(null);

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

  // Pointer events unify mouse and touch (native HTML5 drag-and-drop has
  // no real touch support). setPointerCapture keeps every subsequent
  // move/up event routed to this handle even once the finger leaves it,
  // so the drag reads consistently no matter where the pointer wanders.
  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button !== undefined && e.button !== 0 && e.pointerType === "mouse") return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
    onDragStart();
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragging) return;
    e.preventDefault();
    const overId = itemIdAtPoint(e.clientX, e.clientY);
    if (overId !== null) onDragOverTarget(overId);
  };

  const endDrag = (e: React.PointerEvent) => {
    if (!dragging) return;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    setDragging(false);
    onDragEnd();
  };

  return (
    <li
      className={`list-row${dragging ? " list-row-dragging" : ""}${isFutureSlot ? " list-row-future-slot" : ""}`}
      data-item-id={id}
    >
      {/* Primary Row: Drag Handle, Name, Add Image, Edit, Delete */}
      <div className="list-row-primary">
        <span
          className="list-row-drag-handle"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          <TextElement elementKey="drag-handle" />
        </span>

        {imageUrl && (
          <img className="list-row-image" src={imageUrl} alt="" />
        )}

        {isFutureSlot && (
          <span className="list-row-future-slot-badge" title="Future Slot — planning idea">
            <Icon iconKey="future-slot" size={13} /> Future Slot
          </span>
        )}

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

        <button
          className="icon-button list-row-menu-trigger"
          title="More"
          onClick={(e) => setMenuAt({ x: e.clientX, y: e.clientY })}
        >
          <Icon iconKey="menu-more" size={14} />
        </button>
        {menuAt && (
          <ContextMenu
            x={menuAt.x}
            y={menuAt.y}
            sections={[
              {
                items: [
                  {
                    key: "rename",
                    label: "Rename",
                    onSelect: () => {
                      setMenuAt(null);
                      setEditing(true);
                    },
                  },
                  {
                    key: "delete",
                    label: "Delete",
                    danger: true,
                    onSelect: () => {
                      setMenuAt(null);
                      onDelete();
                    },
                  },
                ],
              },
            ]}
            onClose={() => setMenuAt(null)}
          />
        )}
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
