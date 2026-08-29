// src/components/DreamGraphNodes.tsx
import { BaseEdge, EdgeProps, Handle, Position, useViewport } from "@xyflow/react";
import { useTheme } from "../theme/ThemeContext";
import { clipPathFor, contentInsetFor } from "../theme/nodeShapes";
import { pointOnShapeBoundary } from "../theme/nodeBoundary";
import { DreamPriority } from "../types/models";
import { NodeCardTextItem } from "../theme/nodeCardFields";
import { NodeCardFields } from "./NodeCardFields";
import { Icon } from "../icons/Icon";
import "../pages/DreamWebPage.css";

// Doubled from the original 170x92 — nodes were hard to click at the
// old size, and there's plenty of empty canvas space to spend on it.
export const DREAM_BASE_WIDTH = 340;
export const DREAM_BASE_HEIGHT = 184;

// As the canvas zooms out to show more of the timeline, a node's own
// on-screen size shrinks right along with it — past a certain point
// that makes it unreadable. This claws some of that back: the node
// grows a bit in canvas-space to compensate, capped so it doesn't blow
// up at extreme zoom-out. Node width lives in the same coordinate space
// as the date axis (1 canvas unit = 1 day — see DreamWebPage.ts's
// PIXELS_PER_DAY), so any growth here directly eats into how much
// timeline a node visually covers; the cap and exponent are kept
// deliberately modest (was 2.5 / 0.65) so a fully zoomed-out low-
// priority dream doesn't balloon into spanning the better part of a
// year of gridlines.
export function zoomCompensation(zoom: number): number {
  return Math.min(1.6, Math.max(1, 1 / Math.pow(Math.max(zoom, 0.05), 0.55)));
}

// Priority drives size directly — no manual resize control. Higher
// priority dreams are literally bigger on the web. Low dropped from
// 0.8 to 0.55 so a low-priority dream reads as genuinely secondary
// instead of nearly full-size, especially once zoomCompensation above
// also scales it up while zoomed out.
export const PRIORITY_SCALE: Record<DreamPriority, number> = { low: 0.55, medium: 1, high: 1.3 };

function formatDate(iso?: string): string {
  if (!iso) return "";
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

// name/date only — "Put dream to bed" and "Delete" moved to
// DreamDetailPage's title-row menu (opened by clicking the node), so
// the node itself doesn't have to spend its already-tight width on a
// menu trigger.
export interface DreamNodeData {
  name: string;
  priority: DreamPriority;
  expectedDateStart?: string;
  expectedDateEnd?: string;
  // Whatever fields this dream has opted into showing on the web (see
  // theme/nodeCardFields.ts) — empty unless the user has turned any on
  // via the 🎨 field popover's "On the web" section.
  webFields?: NodeCardTextItem[];
}

// A ring of grab points around the node's boundary, one every 22.5°
// (16 total) — approximates "drag from any point on the edge" closely
// enough to feel continuous while staying a finite, actually-renderable
// set of React Flow Handles (a real drag gesture needs a real DOM
// element to grab). Each is positioned via pointOnShapeBoundary against
// the node's *current* shape, so switching shapes moves every handle to
// sit exactly on the new silhouette. What actually gets persisted per
// link (see DreamLink.sourceAngle/targetAngle) is the angle itself, not
// which discrete handle index was used — so the rendered connection
// line (AngleEdge, below) can still recompute to a precise point on the
// boundary rather than snapping to one of these 16 positions.
export const ANCHOR_ANGLE_STEP = 22.5;
export const ANCHOR_ANGLES = Array.from({ length: 16 }, (_, i) => i * ANCHOR_ANGLE_STEP);

export function parseAngleHandleId(handleId: string | null | undefined): number | null {
  if (!handleId) return null;
  const m = /^(?:out|in)-(-?\d+(?:\.\d+)?)$/.exec(handleId);
  return m ? Number(m[1]) : null;
}

function angleRingHandles(shape: string) {
  return ANCHOR_ANGLES.map((angle) => {
    const pt = pointOnShapeBoundary(shape, angle);
    return { angle, style: { left: `${pt.x}%`, top: `${pt.y}%`, transform: "translate(-50%, -50%)" } };
  });
}

// One source + one target handle stacked at the same spot, so a drag
// can both start and end at any ring position regardless of direction.
// The handles themselves are invisible (see .dream-edge-handle in
// DreamWebPage.css) — a big, overlapping hit area per handle is what
// makes "grab from anywhere on the edge" actually work, since a real
// drag gesture still needs a real element under the pointer; the node
// itself shows a glowing outline on hover (see the shape layer's
// .dream-node-shape-layer class below) as the visible affordance
// instead of dots.
function AngleHandleRing({ shape }: { shape: string }) {
  return (
    <>
      {angleRingHandles(shape).map(({ angle, style }) => (
        <Handle
          key={`out-${angle}`}
          id={`out-${angle}`}
          type="source"
          position={Position.Top}
          className="dream-edge-handle"
          style={style}
        />
      ))}
      {angleRingHandles(shape).map(({ angle, style }) => (
        <Handle
          key={`in-${angle}`}
          id={`in-${angle}`}
          type="target"
          position={Position.Top}
          className="dream-edge-handle"
          style={style}
        />
      ))}
    </>
  );
}

// Renders a link as a straight line between two boundary points that
// are recomputed every time — not tied to wherever a Handle happens to
// be — from each end's stored angle (see DreamLink.sourceAngle/
// targetAngle) against that node's current shape and size. This is
// what keeps a connection anchored correctly (and "very similarly
// spaced," per the design goal) when a node's shape changes, instead of
// the line staying pinned to a now-stale pixel position.
export interface AngleEdgeData {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  [key: string]: unknown;
}

export function AngleEdge({ data, style, markerEnd }: EdgeProps) {
  const d = data as AngleEdgeData | undefined;
  if (!d) return null;
  return <BaseEdge path={`M ${d.x1} ${d.y1} L ${d.x2} ${d.y2}`} style={style} markerEnd={markerEnd} />;
}

// Given a node's top-left canvas position and its box size, the exact
// canvas-space point where `angleDeg` crosses `shape`'s boundary.
export function anchorPoint(
  nodePos: { x: number; y: number },
  size: { width: number; height: number },
  shape: string,
  angleDeg: number
): { x: number; y: number } {
  const pct = pointOnShapeBoundary(shape, angleDeg);
  return { x: nodePos.x + (pct.x / 100) * size.width, y: nodePos.y + (pct.y / 100) * size.height };
}

export function DreamNode({ data }: { data: DreamNodeData }) {
  const { theme } = useTheme();
  const { zoom } = useViewport();
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
  const inset = contentInsetFor(theme.dreamNodeShape);
  const hasWebFields = !!data.webFields && data.webFields.length > 0;
  // See themeFieldGroups.ts's "Fields shown on web cards" setting — "1"
  // lets the card's bottom edge grow downward (a normal-flow sibling
  // below the fixed-size shape/handle box, so edge-anchor math — which
  // is all keyed off the formula height above, never the real DOM size
  // — stays untouched); "0" keeps the box at its computed size and makes
  // the field area scrollable instead, so nothing is ever silently lost
  // either way.
  const growToFit = theme.nodeCardGrowToFit === "1" && hasWebFields;

  return (
    <div
      className="dream-node"
      style={{
        width: `${width}px`,
        height: growToFit ? "auto" : `${height}px`,
        position: "relative",
        // Read by .dream-node-shape-layer's hover rule (DreamWebPage.css)
        // — filter: drop-shadow() follows the clipped silhouette itself,
        // unlike box-shadow (which would glow the rectangular box even
        // for a hexagon/diamond/blob), so the "full border" hover effect
        // actually traces the shape that's grabbable.
        ["--dream-edge-glow-color" as string]: theme.dreamLinkColor,
      }}
    >
      <div style={{ position: "relative", width: "100%", height: `${height}px` }}>
        {/* Only this decorative layer is clipped to a non-rectangular
            shape — the name/date below live in an unclipped layer so a
            hexagon/diamond/blob never hides them. */}
        <div
          className="dream-node-shape-layer"
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "10px",
            border: `2px solid ${theme.dreamNodeOutlineColor}`,
            background: theme.dreamNodeBackground,
            boxShadow: "0 4px 12px rgba(0,0,0,0.35)",
            clipPath: clipPathFor(theme.dreamNodeShape),
            pointerEvents: "none",
          }}
        />

        <AngleHandleRing shape={theme.dreamNodeShape} />

      <div
        style={{
          position: "absolute",
          inset: `${inset.y}% ${inset.x}%`,
          padding: "8px 10px",
          boxSizing: "border-box",
          color: "#ffffff",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
        }}
      >
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

        {hasWebFields && !growToFit && (
          <div className="nodrag nopan" style={{ flex: 1, minHeight: 0, overflowY: "auto", overflowX: "hidden", margin: "2px 0" }}>
            <NodeCardFields items={data.webFields!} />
          </div>
        )}

        <span
          style={{
            fontSize: "11px",
            opacity: 0.85,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {hasRange
            ? `${formatDate(data.expectedDateStart)} – ${formatDate(data.expectedDateEnd)}`
            : formatDate(data.expectedDateStart) || "No date set"}
        </span>
      </div>
      </div>

      {growToFit && (
        <div
          className="nodrag nopan"
          style={{
            background: theme.dreamNodeBackground,
            border: `2px solid ${theme.dreamNodeOutlineColor}`,
            borderTop: "none",
            borderRadius: "0 0 10px 10px",
            color: "#ffffff",
            padding: "6px 10px 8px",
            boxSizing: "border-box",
          }}
        >
          <NodeCardFields items={data.webFields!} fullText />
        </div>
      )}
    </div>
  );
}

// A goal auto-appears clustered under its parent dream's node as one of
// these — smaller, differently colored, no priority/date system of its
// own (goals don't have one). Clicking the node body opens the goal
// (like a dream node opens the dream); the small "web" button opens
// this goal's Goal Web instead — kept as a distinct control, not folded
// into the body click, since the two destinations are genuinely
// different pages. draggable/deletable are set false on the Node object
// itself (see DreamWebPage.tsx) — goal nodes are purely computed from
// their parent dream's position, not their own persisted x/y.
// Doubled alongside the dream node above, same reasoning.
export const GOAL_NODE_WIDTH = 216;
export const GOAL_NODE_HEIGHT = 108;

export interface DreamGoalNodeData {
  name: string;
  onOpenWeb: () => void;
}

// A goal node's whole rectangle boundary is its "shape" (goals don't
// have their own shape setting) — this single source+target handle
// pair is what a dream's connection ring (see AngleHandleRing above)
// can drag onto or from, to re-parent a goal to a different dream (see
// DreamWebPage.tsx's onConnect). Sits at top-center — angle 0 on a
// rectangle, matching what DreamWebPage.tsx's goal-edge math uses for
// the goal end, rather than the node's center — mostly so it doesn't
// sit underneath the "Enter Goal Web" button. Invisible + oversized hit
// box, same as AngleHandleRing's — see .dream-edge-handle.
function GoalAttachHandle() {
  const style = { left: "50%", top: "0%", transform: "translate(-50%, -50%)" };
  return (
    <>
      <Handle id="out-0" type="source" position={Position.Top} className="dream-edge-handle" style={style} />
      <Handle id="in-0" type="target" position={Position.Top} className="dream-edge-handle" style={style} />
    </>
  );
}

export function DreamGoalNode({ data }: { data: DreamGoalNodeData }) {
  const { theme } = useTheme();

  return (
    <div
      className="dream-goal-node-shape"
      style={{
        width: `${GOAL_NODE_WIDTH}px`,
        height: `${GOAL_NODE_HEIGHT}px`,
        borderRadius: "8px",
        border: `2px solid ${theme.dreamGoalNodeOutlineColor}`,
        background: theme.dreamGoalNodeBackground,
        boxShadow: "0 3px 8px rgba(0,0,0,0.3)",
        boxSizing: "border-box",
        padding: "8px 10px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        ["--dream-edge-glow-color" as string]: theme.dreamGoalNodeOutlineColor,
        color: "#ffffff",
        cursor: "pointer",
        position: "relative",
      }}
      title={`Goal: ${data.name}`}
    >
      <GoalAttachHandle />
      <span
        style={{
          fontSize: "14px",
          fontWeight: "bold",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        🎯 {data.name}
      </span>
      <button
        onClick={(e) => {
          e.stopPropagation();
          data.onOpenWeb();
        }}
        title="Enter Goal Web"
        style={{
          alignSelf: "flex-end",
          fontSize: "12px",
          lineHeight: 1,
          padding: "4px 8px",
          borderRadius: "4px",
          border: `1px solid ${theme.dreamGoalNodeOutlineColor}`,
          background: "rgba(0,0,0,0.25)",
          color: "#ffffff",
          cursor: "pointer",
        }}
      >
        <Icon iconKey="web-view" size={12} /> Web
      </button>
    </div>
  );
}
