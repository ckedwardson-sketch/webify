// src/components/PaneNode.tsx
//
// A web_panes row (see types/project.ts's Pane) rendered as a
// free-floating, freely resizable, colored/translucent rectangle on a
// Goal Web or Dream Web canvas — purely a visual grouping tool, no
// linked record of its own. Sits behind every other node by default
// (GoalWebPage.tsx/DreamWebPage.tsx give it a negative Node.zIndex) so
// it reads as a backdrop other nodes are placed on top of, same idea as
// a "frame"/"group" in other canvas tools.
//
// The top-right "cover" button (desktop only — see isMobile) flips
// is_front, which the parent web page turns into a very high Node.zIndex
// instead: that puts this pane's own DOM element above every other node
// it overlaps, so its own opaque-ish background visually tints and
// physically intercepts clicks on whatever was grouped inside it,
// without any bespoke pointer-events wiring — plain stacking order does
// the "blocking" for free. Clicking it again sends it back to the rear.
import { NodeResizer } from "@xyflow/react";
import { Pane } from "../types/project";
import { Icon } from "../icons/Icon";
import "./PaneNode.css";

export const PANE_DEFAULT_WIDTH = 420;
export const PANE_DEFAULT_HEIGHT = 320;
export const PANE_MIN_WIDTH = 160;
export const PANE_MIN_HEIGHT = 120;

function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace("#", "");
  const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
  const r = parseInt(full.slice(0, 2), 16) || 0;
  const g = parseInt(full.slice(2, 4), 16) || 0;
  const b = parseInt(full.slice(4, 6), 16) || 0;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export interface PaneNodeData {
  pane: Pane;
  isMobile: boolean;
  // Fires continuously while a resize handle is being dragged, purely to
  // keep the box's rendered size (driven by pane.width/height below)
  // tracking the cursor live instead of jumping into place on release —
  // no DB write here, that's onResizeEnd's job.
  onResizeLive: (width: number, height: number) => void;
  onResizeEnd: (width: number, height: number) => void;
  onRename: () => void;
  onToggleFront: () => void;
  onToggleLocked: () => void;
  onDelete: () => void;
}

export function PaneNode({ data, selected }: { data: PaneNodeData; selected?: boolean }) {
  const { pane, isMobile, onResizeLive, onResizeEnd, onRename, onToggleFront, onToggleLocked, onDelete } = data;
  const width = pane.width || PANE_DEFAULT_WIDTH;
  const height = pane.height || PANE_DEFAULT_HEIGHT;
  // Brought to front covers its contents, so it reads a good deal more
  // opaque than its normal at-rest backdrop opacity — still tinted
  // rather than fully solid, so it's recognizable as "a covered pane"
  // rather than an unrelated blank card.
  const fillOpacity = pane.isFront ? Math.min(1, pane.opacity + 0.45) : pane.opacity;

  return (
    <div
      className={`pane-node${pane.isFront ? " pane-node-front" : ""}`}
      style={{
        width,
        height,
        background: hexToRgba(pane.color, fillOpacity),
        borderColor: pane.color,
      }}
    >
      <NodeResizer
        isVisible={selected}
        minWidth={PANE_MIN_WIDTH}
        minHeight={PANE_MIN_HEIGHT}
        lineStyle={{ borderColor: pane.color }}
        handleStyle={{ background: pane.color }}
        onResize={(_, params) => onResizeLive(params.width, params.height)}
        onResizeEnd={(_, params) => onResizeEnd(params.width, params.height)}
      />

      <div
        className="pane-node-label nodrag"
        style={{ fontSize: pane.headerFontSize, color: pane.headerColor ?? undefined }}
        onDoubleClick={(e) => {
          e.stopPropagation();
          onRename();
        }}
        title="Double-click to rename"
      >
        {pane.title || "Pane"}
      </div>

      <div className="pane-node-controls nodrag">
        {!isMobile && (
          <button
            className="pane-node-control-button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleLocked();
            }}
            title={pane.locked ? "Unlock pane — allow dragging again" : "Lock pane in place"}
          >
            <Icon iconKey={pane.locked ? "pane-locked" : "pane-lock"} size={13} />
          </button>
        )}
        {!isMobile && (
          <button
            className="pane-node-control-button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleFront();
            }}
            title={
              pane.isFront
                ? "Send pane back behind nodes"
                : "Bring pane to front, packing up and covering everything inside it"
            }
          >
            <Icon iconKey={pane.isFront ? "pane-open" : "pane-close"} size={13} />
          </button>
        )}
        <button
          className="pane-node-control-button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          title="Delete pane"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
