import { useState } from "react";
import { Icon } from "../icons/Icon";
import { ContextMenu } from "./ContextMenu";
import "./CornerMenu.css";

// Universal corner-anchored "triple-dot" primitive — one small icon
// button, placeable in any corner of whatever it's rendered inside
// (which must be position:relative), that expands into a dropdown of
// actions on click. Right-click opens a small "move to corner" picker
// instead, so a widget/page's control cluster can be relocated without
// a separate settings screen. Generalizes the pattern PaneGrid.tsx
// already used for its own rename/delete menu (Icon "menu-more" +
// ContextMenu) so every other corner-button cluster in the app
// (Image Dock, Quick Photo, Recipes page controls, project tile
// delete) can share one implementation instead of each inventing its
// own positioning/dropdown.
export type Corner = "tl" | "tr" | "bl" | "br";

export const CORNER_OPTIONS: { value: Corner; label: string }[] = [
  { value: "tl", label: "Top-left" },
  { value: "tr", label: "Top-right" },
  { value: "bl", label: "Bottom-left" },
  { value: "br", label: "Bottom-right" },
];

export interface CornerMenuItem {
  key: string;
  label: string;
  onClick: () => void;
  danger?: boolean;
}

export function CornerMenu({
  corner,
  items,
  onCornerChange,
  triggerIconKey = "menu-more",
  title = "More",
  size = 14,
}: {
  corner: Corner;
  items: CornerMenuItem[];
  // Omit to make the trigger's corner fixed (no right-click affordance).
  onCornerChange?: (corner: Corner) => void;
  triggerIconKey?: string;
  title?: string;
  size?: number;
}) {
  const [menuAt, setMenuAt] = useState<{ x: number; y: number } | null>(null);
  const [moveAt, setMoveAt] = useState<{ x: number; y: number } | null>(null);

  return (
    <>
      <button
        type="button"
        className={`corner-menu-trigger corner-menu-trigger--${corner}`}
        title={title}
        onClick={(e) => {
          e.stopPropagation();
          setMenuAt({ x: e.clientX, y: e.clientY });
        }}
        onContextMenu={(e) => {
          if (!onCornerChange) return;
          e.preventDefault();
          e.stopPropagation();
          setMoveAt({ x: e.clientX, y: e.clientY });
        }}
      >
        <Icon iconKey={triggerIconKey} size={size} />
      </button>

      {menuAt && (
        <ContextMenu
          x={menuAt.x}
          y={menuAt.y}
          sections={[
            {
              items: items.map((item) => ({
                key: item.key,
                label: item.label,
                danger: item.danger,
                onSelect: () => {
                  setMenuAt(null);
                  item.onClick();
                },
              })),
            },
          ]}
          onClose={() => setMenuAt(null)}
        />
      )}

      {moveAt && onCornerChange && (
        <ContextMenu
          x={moveAt.x}
          y={moveAt.y}
          sections={[
            {
              label: "Move to",
              items: CORNER_OPTIONS.map((c) => ({
                key: c.value,
                label: c.label,
                onSelect: () => {
                  setMoveAt(null);
                  onCornerChange(c.value);
                },
              })),
            },
          ]}
          onClose={() => setMoveAt(null)}
        />
      )}
    </>
  );
}
