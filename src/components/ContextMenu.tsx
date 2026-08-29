import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import "./ManagedListRow.css"; // .menu-backdrop / .dropdown-item convention
import "./ContextMenu.css";

// Fully generic right-click/long-press menu primitive — not tied to the
// editor. Positions at (x, y), clamps/flips against the viewport once
// its real size is known, and supports arrow-key navigation, Enter to
// select, Escape to close.
export interface ContextMenuItem {
  key: string;
  label: string;
  icon?: React.ReactNode;
  onSelect: () => void;
  danger?: boolean;
  disabled?: boolean;
}

export interface ContextMenuSection {
  label?: string;
  items: ContextMenuItem[];
}

export function ContextMenu({
  x,
  y,
  sections,
  onClose,
}: {
  x: number;
  y: number;
  sections: ContextMenuSection[];
  onClose: () => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const [focusedIndex, setFocusedIndex] = useState(0);

  const flatItems = sections.flatMap((s) => s.items).filter((i) => !i.disabled);

  useLayoutEffect(() => {
    const el = menuRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    let left = x;
    let top = y;
    if (left + rect.width > window.innerWidth) left = Math.max(0, window.innerWidth - rect.width - 4);
    if (top + rect.height > window.innerHeight) top = Math.max(0, window.innerHeight - rect.height - 4);
    setPos({ left, top });
  }, [x, y]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setFocusedIndex((i) => Math.min(i + 1, flatItems.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setFocusedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        flatItems[focusedIndex]?.onSelect();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusedIndex, flatItems.length]);

  let flatIndex = -1;

  return (
    <>
      <div className="menu-backdrop" onClick={onClose} onContextMenu={(e) => (e.preventDefault(), onClose())} />
      <div
        ref={menuRef}
        className="context-menu"
        style={pos ? { left: pos.left, top: pos.top } : { left: x, top: y, visibility: "hidden" }}
      >
        {sections.map((section, si) => (
          <div className="context-menu-section" key={section.label ?? si}>
            {section.label && <div className="context-menu-section-label">{section.label}</div>}
            {section.items.map((item) => {
              if (item.disabled) {
                return (
                  <div key={item.key} className="dropdown-item context-menu-item-disabled">
                    {item.icon}
                    {item.label}
                  </div>
                );
              }
              flatIndex++;
              const isFocused = flatIndex === focusedIndex;
              return (
                <button
                  key={item.key}
                  className={`dropdown-item context-menu-item${item.danger ? " dropdown-item-danger" : ""}${
                    isFocused ? " context-menu-item-focused" : ""
                  }`}
                  onMouseEnter={() => setFocusedIndex(flatIndex)}
                  onClick={item.onSelect}
                >
                  {item.icon}
                  {item.label}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </>
  );
}
