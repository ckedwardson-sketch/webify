import React, { useState } from "react";
import { PaneShapeScope, PaneShapeSurface } from "../theme/PaneShapeScope";
import { itemIdAtPoint } from "../hooks/dragReorder";
import { useTheme } from "../theme/ThemeContext";
import { parseDecals } from "../theme/decals";
import { DecalLayer } from "../theme/DecalLayer";
import { CornerMenu, Corner } from "./CornerMenu";
import { Icon } from "../icons/Icon";
import "./PaneGrid.css";

export interface PaneGridItem {
  id: number;
  label: string;
  imageUrl?: string;
  // Shown instead of the label-initial fallback when there's no photo
  // (e.g. a Responsibility's emoji icon) — imageUrl still wins if both are set.
  glyph?: string;
  // Recipes' Future Slot planning cards — styled to stand out from the rest of the grid.
  isFutureSlot?: boolean;
}

// The "icon-grid"/"pane-small"/"pane-large" view mode shared by
// Projects, Skills, Recipes, and Responsibilities (see
// theme.projectViewMode etc.) — a square pane per item (photo if the
// item has one, initials otherwise) with the name below and a
// triple-dot menu for rearrange/rename/delete, matching the brief's
// "file explorer icon view" request. Drag-reorder reuses the same
// pointer-capture pattern as ManagedListRow (see hooks/dragReorder.ts)
// so both view modes share one gesture implementation.
export function PaneGrid({
  items,
  size,
  surface,
  onOpen,
  onRename,
  onDelete,
  onSetImage,
  onDragStart,
  onDragOverTarget,
  onDragEnd,
}: {
  items: PaneGridItem[];
  size: "small" | "large";
  surface: PaneShapeSurface;
  onOpen: (id: number) => void;
  onRename: (id: number, name: string) => void;
  onDelete: (id: number) => void;
  // Omit to leave "Set cover image" out of the menu (some callers'
  // items have no backing image field yet).
  onSetImage?: (id: number, file: File) => void;
  // Omit all three to render a non-reorderable grid (some surfaces
  // don't have a persisted order yet) — either provide all three or none.
  onDragStart?: (id: number) => void;
  onDragOverTarget?: (id: number) => void;
  onDragEnd?: () => void;
}) {
  const { theme, replaceTheme } = useTheme();
  const decals = React.useMemo(() => parseDecals(theme.decals), [theme.decals]);
  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [renameVal, setRenameVal] = useState("");
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [imageTargetId, setImageTargetId] = useState<number | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && imageTargetId !== null && onSetImage) onSetImage(imageTargetId, file);
    e.target.value = "";
    setImageTargetId(null);
  };

  const startRename = (item: PaneGridItem) => {
    setRenamingId(item.id);
    setRenameVal(item.label);
  };

  const confirmRename = (item: PaneGridItem) => {
    const trimmed = renameVal.trim();
    setRenamingId(null);
    if (trimmed && trimmed !== item.label) onRename(item.id, trimmed);
  };

  const reorderable = !!(onDragStart && onDragOverTarget && onDragEnd);

  const handlePointerDown = (e: React.PointerEvent, id: number) => {
    if (!reorderable) return;
    if (e.button !== undefined && e.button !== 0 && e.pointerType === "mouse") return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setDraggingId(id);
    onDragStart!(id);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (draggingId === null) return;
    e.preventDefault();
    const overId = itemIdAtPoint(e.clientX, e.clientY);
    if (overId !== null) onDragOverTarget!(overId);
  };

  const endDrag = (e: React.PointerEvent) => {
    if (draggingId === null) return;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    setDraggingId(null);
    onDragEnd!();
  };

  return (
    <PaneShapeScope surface={surface}>
      <ul className={`pane-grid pane-grid--${size}`}>
        {items.map((item) => (
          <li
            key={item.id}
            className={`pane-grid-item${draggingId === item.id ? " pane-grid-item-dragging" : ""}`}
            data-item-id={item.id}
            onPointerDown={(e) => handlePointerDown(e, item.id)}
            onPointerMove={handlePointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
          >
            <button
              className={`pane-grid-pane pane-shape-surface${item.isFutureSlot ? " pane-grid-pane-future-slot" : ""}`}
              onClick={() => onOpen(item.id)}
              title={item.label}
            >
              {item.isFutureSlot && (
                <span className="pane-grid-future-slot-badge" title="Future Slot — planning idea">
                  <Icon iconKey="future-slot" size={12} />
                </span>
              )}
              {item.imageUrl ? (
                <img className="pane-grid-image" src={item.imageUrl} alt="" />
              ) : item.glyph ? (
                <span className="pane-grid-glyph">{item.glyph}</span>
              ) : (
                <span className="pane-grid-initial">{item.label.trim().charAt(0).toUpperCase() || "?"}</span>
              )}
              <DecalLayer decals={decals} target="pane" surface={surface} />
            </button>

            <CornerMenu
              corner={(theme.paneGridMenuCorner as Corner) || "tr"}
              onCornerChange={(corner) => replaceTheme({ paneGridMenuCorner: corner })}
              items={[
                { key: "rename", label: "Rename", onClick: () => startRename(item) },
                ...(onSetImage
                  ? [
                      {
                        key: "set-image",
                        label: item.imageUrl ? "Change cover image" : "Set cover image",
                        onClick: () => {
                          setImageTargetId(item.id);
                          fileInputRef.current?.click();
                        },
                      },
                    ]
                  : []),
                { key: "delete", label: "Delete", danger: true, onClick: () => onDelete(item.id) },
              ]}
            />

            {renamingId === item.id ? (
              <input
                className="pane-grid-rename-input"
                autoFocus
                value={renameVal}
                onChange={(e) => setRenameVal(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") confirmRename(item);
                  if (e.key === "Escape") setRenamingId(null);
                }}
                onBlur={() => confirmRename(item)}
              />
            ) : (
              <span className="pane-grid-label pane-shape-label">{item.label}</span>
            )}
          </li>
        ))}
      </ul>
      {onSetImage && (
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={handleFileChange}
        />
      )}
    </PaneShapeScope>
  );
}
