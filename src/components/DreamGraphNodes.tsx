// src/components/DreamGraphNodes.tsx
import React, { useState } from "react";
import { Handle, Position, useViewport } from "@xyflow/react";
import { useTheme } from "../theme/ThemeContext";
import { DreamPriority } from "../types/models";
import "./ManagedListRow.css"; // reusing .managed-row-dropdown / .dropdown-item / .menu-backdrop
import "../pages/DreamWebPage.css";

export const DREAM_BASE_WIDTH = 170;
export const DREAM_BASE_HEIGHT = 92;

// As the canvas zooms out to show more of the timeline, a node's own
// on-screen size shrinks right along with it — past a certain point
// that makes it unreadable. This claws some of that back: the node
// grows a bit in canvas-space to compensate, capped so it doesn't blow
// up at extreme zoom-out.
export function zoomCompensation(zoom: number): number {
  return Math.min(2.5, Math.max(1, 1 / Math.pow(Math.max(zoom, 0.05), 0.65)));
}

// Priority drives size directly — no manual resize control. Higher
// priority dreams are literally bigger on the web.
const PRIORITY_SCALE: Record<DreamPriority, number> = { low: 0.8, medium: 1, high: 1.3 };

function formatDate(iso?: string): string {
  if (!iso) return "";
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export interface DreamNodeData {
  name: string;
  priority: DreamPriority;
  expectedDateStart?: string;
  expectedDateEnd?: string;
  onDelete?: () => void;
  onPutToBed?: () => void;
  onAddProject?: () => void;
}

const HANDLE_INSET = "10px";
const cornerHandles: { id: string; position: Position; style: React.CSSProperties }[] = [
  { id: "tl", position: Position.Top, style: { left: HANDLE_INSET, transform: "translate(0, -50%)" } },
  { id: "tr", position: Position.Top, style: { left: "auto", right: HANDLE_INSET, transform: "translate(0, -50%)" } },
  { id: "bl", position: Position.Bottom, style: { left: HANDLE_INSET, transform: "translate(0, 50%)" } },
  { id: "br", position: Position.Bottom, style: { left: "auto", right: HANDLE_INSET, transform: "translate(0, 50%)" } },
];

export function DreamNode({ data }: { data: DreamNodeData }) {
  const { theme } = useTheme();
  const { zoom } = useViewport();
  const [menuOpen, setMenuOpen] = useState(false);
  const scale = (PRIORITY_SCALE[data.priority] ?? 1) * zoomCompensation(zoom);
  const width = DREAM_BASE_WIDTH * scale;
  const height = DREAM_BASE_HEIGHT * scale;
  const priorityColors: Record<DreamPriority, string> = {
    low: theme.dreamPriorityLow,
    medium: theme.dreamPriorityMedium,
    high: theme.dreamPriorityHigh,
  };

  const hasRange =
    data.expectedDateStart && data.expectedDateEnd && data.expectedDateStart !== data.expectedDateEnd;

  return (
    <div
      className="dream-node"
      style={{
        width: `${width}px`,
        height: `${height}px`,
        borderRadius: "10px",
        border: `2px solid ${theme.dreamNodeOutlineColor}`,
        background: theme.dreamNodeBackground,
        color: "#ffffff",
        boxShadow: "0 4px 12px rgba(0,0,0,0.35)",
        padding: "8px 10px",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        position: "relative",
      }}
    >
      {cornerHandles.map((h) => (
        <Handle
          key={h.id}
          id={h.id}
          type="source"
          position={h.position}
          style={{ background: theme.dreamLinkColor, width: 9, height: 9, ...h.style }}
        />
      ))}

      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "6px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "6px", minWidth: 0 }}>
          <span
            style={{
              width: "9px",
              height: "9px",
              borderRadius: "50%",
              background: priorityColors[data.priority] ?? theme.dreamPriorityMedium,
              flexShrink: 0,
            }}
            title={`${data.priority} priority`}
          />
          <span
            style={{
              fontWeight: "bold",
              fontSize: `${Math.max(11, 13 * scale)}px`,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {data.name}
          </span>
        </div>

        <div style={{ position: "relative", flexShrink: 0 }}>
          <button
            className="dream-node-menu-trigger"
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen((v) => !v);
            }}
            title="Dream actions"
          >
            ⋯
          </button>
          {menuOpen && (
            <>
              <div className="menu-backdrop" onClick={() => setMenuOpen(false)} />
              <div className="managed-row-dropdown dream-node-dropdown">
                {data.onAddProject && (
                  <button
                    className="dropdown-item"
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuOpen(false);
                      data.onAddProject!();
                    }}
                  >
                    Add Project
                  </button>
                )}
                {data.onPutToBed && (
                  <button
                    className="dropdown-item"
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuOpen(false);
                      data.onPutToBed!();
                    }}
                  >
                    Put dream to bed
                  </button>
                )}
                {data.onDelete && (
                  <button
                    className="dropdown-item dropdown-item-danger"
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuOpen(false);
                      data.onDelete!();
                    }}
                  >
                    Delete
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      <span style={{ fontSize: "11px", opacity: 0.85 }}>
        {hasRange
          ? `${formatDate(data.expectedDateStart)} – ${formatDate(data.expectedDateEnd)}`
          : formatDate(data.expectedDateStart) || "No date set"}
      </span>
    </div>
  );
}
