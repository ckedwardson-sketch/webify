// src/pages/DreamWebPage.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Node,
  Edge,
  Connection,
  NodeChange,
  Background,
  Panel,
  ViewportPortal,
  ConnectionMode,
  ConnectionLineType,
  Viewport,
  applyNodeChanges,
  useViewport,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  fetchDreamGraphData,
  addDream,
  updateDreamPosition,
  updateDreamPositionX,
  addDreamLink,
  removeDreamLink,
} from "../db/dreams";
import { fetchAllGoals } from "../db/goals";
import {
  fetchAllGoalDreamLinks,
  addOrUpdateGoalDreamLink,
  removeGoalDreamLink,
  updateGoalDreamLinkPosX,
  updateGoalDreamLinkAngle,
  GoalDreamLink,
} from "../db/goalDreamLinks";
import { fetchViewport, saveViewport } from "../db/viewports";
import { Dream, DreamLink, DreamPriority } from "../types/models";
import { Goal } from "../types/project";
import {
  DreamNode,
  DREAM_BASE_WIDTH,
  DREAM_BASE_HEIGHT,
  zoomCompensation,
  PRIORITY_SCALE,
  DreamGoalNode,
  GOAL_NODE_WIDTH,
  GOAL_NODE_HEIGHT,
  AngleEdge,
  AngleEdgeData,
  anchorPoint,
  parseAngleHandleId,
  ANCHOR_ANGLE_STEP,
} from "../components/DreamGraphNodes";
import { angleFromDirection } from "../theme/nodeBoundary";
import { View } from "../types/nav";
import { WebControls } from "../components/WebControls";
import { StyledButton } from "../icons/StyledButton";
import { useTheme } from "../theme/ThemeContext";
import "./Page.css";
import "./DreamWebPage.css";

const nodeTypes = { dreamNode: DreamNode, dreamGoalNode: DreamGoalNode };
const edgeTypes = { angleEdge: AngleEdge };

const dreamNodeId = (id: number) => `d-${id}`;
const parseDreamNodeId = (nodeId: string) => Number(nodeId.slice(2));
// Keyed by goal_dream_links.id (not goal id) — a goal attached to
// several dreams renders one node per link, so the link id is what's
// actually unique per rendered instance.
const goalNodeId = (linkId: number) => `g-${linkId}`;
const parseGoalNodeId = (nodeId: string) => Number(nodeId.slice(2));
const goalEdgeId = (linkId: number) => `goal-edge-${linkId}`;
const parseGoalEdgeId = (edgeId: string) => Number(edgeId.slice("goal-edge-".length));
const linkEdgeId = (id: number) => `link-${id}`;
const parseLinkEdgeId = (edgeId: string) => Number(edgeId.slice(5));

// Snaps any angle (including a continuously-computed default — see
// edges below) to one of the 16 actually-rendered ring handles, so a
// sourceHandle/targetHandle id set on an edge always references a real
// handle. The *visual* line itself (data.x1/y1/... below) still uses
// the precise, unsnapped angle — this snapping only affects which
// handle id gets referenced, which our custom AngleEdge component
// otherwise ignores for positioning anyway.
function snapToAnchor(angle: number): number {
  return (Math.round(angle / ANCHOR_ANGLE_STEP) * ANCHOR_ANGLE_STEP + 360) % 360;
}

const GOAL_SHAPE = "rectangle";
const GOAL_SIZE = { width: GOAL_NODE_WIDTH, height: GOAL_NODE_HEIGHT };

// A goal-dream link's x is either wherever the user has dragged that
// particular attachment (link.posX), or — until then — clustered
// horizontally under the dream it's attached to. Y follows the *goal's
// own* date, same mechanism as a dated dream, when it has one; only an
// undated goal falls back to sitting just below whichever dream this
// instance is attached to. This means a dated goal can end up far from
// its parent vertically (it's tracking its own place in time, not just
// "attached to the dream visually") — the dashed edge (see edges below)
// is what keeps the parent relationship visible regardless of how far
// apart they land.
const GOAL_CLUSTER_GAP = 28;
const GOAL_CLUSTER_Y_OFFSET = DREAM_BASE_HEIGHT + 50;

function goalClusterXs(dreamX: number, count: number): number[] {
  const totalWidth = count * GOAL_NODE_WIDTH + (count - 1) * GOAL_CLUSTER_GAP;
  const startX = dreamX + DREAM_BASE_WIDTH / 2 - totalWidth / 2;
  return Array.from({ length: count }, (_, i) => startX + i * (GOAL_NODE_WIDTH + GOAL_CLUSTER_GAP));
}

function goalPositionsFor(
  dreamPos: { x: number; y: number },
  dreamLinks: GoalDreamLink[],
  goalById: Map<number, Goal>
): { x: number; y: number }[] {
  const xs = goalClusterXs(dreamPos.x, dreamLinks.length);
  return dreamLinks.map((link, i) => {
    const goal = goalById.get(link.goalId);
    return {
      x: link.posX ?? xs[i],
      y: goal?.expectedDateStart
        ? rangeMidY(goal.expectedDateStart, goal.expectedDateEnd)
        : dreamPos.y + GOAL_CLUSTER_Y_OFFSET,
    };
  });
}

// ---- Date <-> canvas-Y mapping ---------------------------------------
// Vertical timeline: today sits at y=0, the future runs up (negative
// y), the past runs down (positive y). A dated dream's y always comes
// from this — it isn't something you can drag around; only x is free.

const TODAY = new Date();
const EPOCH_YEAR = TODAY.getFullYear() - 5;
const END_YEAR = TODAY.getFullYear() + 10;
const TODAY_MS = new Date(TODAY.getFullYear(), TODAY.getMonth(), TODAY.getDate()).getTime();
const PIXELS_PER_DAY = 1;
const DAY_MS = 86400000;
const MONTH_ZOOM_THRESHOLD = 0.6;
const UNDATED_LANE_X = -650;

function isoToY(iso: string): number {
  const t = new Date(`${iso}T00:00:00`).getTime();
  return -((t - TODAY_MS) / DAY_MS) * PIXELS_PER_DAY;
}

function rangeMidY(start: string, end?: string): number {
  const s = isoToY(start);
  const e = end ? isoToY(end) : s;
  return (s + e) / 2;
}

interface GridLine {
  y: number;
  label: string;
  isYear: boolean;
  isCurrentYear: boolean;
}

function buildGridLines(): GridLine[] {
  const lines: GridLine[] = [];
  const currentYear = TODAY.getFullYear();
  for (let y = EPOCH_YEAR; y <= END_YEAR; y++) {
    lines.push({ y: isoToY(`${y}-01-01`), label: String(y), isYear: true, isCurrentYear: y === currentYear });
    for (let m = 2; m <= 12; m++) {
      const mm = String(m).padStart(2, "0");
      lines.push({
        y: isoToY(`${y}-${mm}-01`),
        label: new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: "short" }),
        isYear: false,
        isCurrentYear: false,
      });
    }
  }
  return lines;
}

function formatShortDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// A vertical "flagpole" spanning a dream's date range — flared,
// beveled caps at each end (rather than the old flat T-bar) so it
// reads as one connected piece growing out of the node's edge instead
// of a disconnected line floating beside it. Widths/lengths clamp to
// the actual bar height so a short range (a few days) doesn't turn the
// taper sections inside-out.
const RANGE_BAR_WIDTH = 5;
const RANGE_BAR_FLARE_WIDTH = 22;
const RANGE_BAR_FLARE_LENGTH = 16;
const RANGE_BAR_CAP_THICKNESS = 4;

function rangeBarPath(cx: number, yTop: number, yBottom: number): string {
  const barHalf = RANGE_BAR_WIDTH / 2;
  const flareHalf = RANGE_BAR_FLARE_WIDTH / 2;
  const flareLen = Math.max(2, Math.min(RANGE_BAR_FLARE_LENGTH, (yBottom - yTop) / 2 - 2));
  const capThick = Math.min(RANGE_BAR_CAP_THICKNESS, flareLen - 1);
  return [
    `M ${cx - flareHalf} ${yTop}`,
    `L ${cx + flareHalf} ${yTop}`,
    `L ${cx + flareHalf} ${yTop + capThick}`,
    `L ${cx + barHalf} ${yTop + flareLen}`,
    `L ${cx + barHalf} ${yBottom - flareLen}`,
    `L ${cx + flareHalf} ${yBottom - capThick}`,
    `L ${cx + flareHalf} ${yBottom}`,
    `L ${cx - flareHalf} ${yBottom}`,
    `L ${cx - flareHalf} ${yBottom - capThick}`,
    `L ${cx - barHalf} ${yBottom - flareLen}`,
    `L ${cx - barHalf} ${yTop + flareLen}`,
    `L ${cx - flareHalf} ${yTop + capThick}`,
    "Z",
  ].join(" ");
}

function nodeSizeFor(priority: DreamPriority, zoom: number): { width: number; height: number } {
  const scale = PRIORITY_SCALE[priority] * zoomCompensation(zoom);
  return { width: DREAM_BASE_WIDTH * scale, height: DREAM_BASE_HEIGHT * scale };
}

function timelineSort(a: Dream, b: Dream) {
  if (!a.expectedDateStart && !b.expectedDateStart) return a.name.localeCompare(b.name);
  if (!a.expectedDateStart) return 1;
  if (!b.expectedDateStart) return -1;
  return a.expectedDateStart.localeCompare(b.expectedDateStart);
}

function DreamWebInner({ onNavigate }: { onNavigate: (view: View) => void }) {
  const { theme } = useTheme();
  const { zoom } = useViewport();
  const [dreams, setDreams] = useState<Dream[]>([]);
  const [links, setLinks] = useState<DreamLink[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [goalDreamLinks, setGoalDreamLinks] = useState<GoalDreamLink[]>([]);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [initialViewport, setInitialViewport] = useState<Viewport | null>(null);

  const gridLines = useMemo(buildGridLines, []);

  const load = () => {
    Promise.all([
      fetchDreamGraphData(),
      fetchAllGoals(),
      fetchAllGoalDreamLinks(),
      fetchViewport("dream-web"),
    ]).then(([{ dreams, links }, goals, goalDreamLinks, viewport]) => {
      setDreams(dreams);
      setLinks(links);
      setGoals(goals);
      setGoalDreamLinks(goalDreamLinks);
      setInitialViewport(viewport);
      setLoading(false);
    });
  };

  useEffect(load, []);

  const handleMoveEnd = (_: unknown, viewport: Viewport) => {
    saveViewport("dream-web", viewport);
  };

  const dreamById = useMemo(() => new Map(dreams.map((d) => [d.id, d])), [dreams]);

  const activeDreams = useMemo(() => dreams.filter((d) => !d.isAsleep), [dreams]);
  const sleepingDreams = useMemo(() => dreams.filter((d) => d.isAsleep), [dreams]);

  const positionFor = (dream: Dream): { x: number; y: number } => {
    if (dream.expectedDateStart) {
      return { x: dream.posX, y: rangeMidY(dream.expectedDateStart, dream.expectedDateEnd) };
    }
    return { x: dream.posX, y: dream.posY };
  };

  // A stale link (goal deleted, or is now a passion project and no
  // longer in fetchAllGoals' result) simply doesn't render — same rule
  // dreams themselves already follow (sleeping dreams are excluded from
  // the canvas entirely).
  const goalById = useMemo(() => new Map(goals.map((g) => [g.id, g])), [goals]);

  const linksByDream = useMemo(() => {
    const map = new Map<number, GoalDreamLink[]>();
    for (const link of goalDreamLinks) {
      if (!goalById.has(link.goalId)) continue;
      const list = map.get(link.dreamId) ?? [];
      list.push(link);
      map.set(link.dreamId, list);
    }
    return map;
  }, [goalDreamLinks, goalById]);

  const linkById = useMemo(() => new Map(goalDreamLinks.map((l) => [l.id, l])), [goalDreamLinks]);

  // Y for a given attachment, independent of any live drag — same rule
  // goalPositionsFor uses, factored out so onNodesChange can snap a
  // node's y back to it on every drag tick (mirroring how a dated
  // dream's y is locked below).
  const goalYFor = (link: GoalDreamLink): number => {
    const goal = goalById.get(link.goalId);
    if (goal?.expectedDateStart) return rangeMidY(goal.expectedDateStart, goal.expectedDateEnd);
    const dream = dreamById.get(link.dreamId);
    return (dream ? positionFor(dream).y : 0) + GOAL_CLUSTER_Y_OFFSET;
  };

  // Computed once here and reused by both the node-building effect and
  // the edges useMemo below, rather than each recomputing it separately
  // — recomputing goalPositionsFor with just one link at a time (as an
  // earlier version of this did, for the edge endpoint) gives a
  // different x than the real node whenever that dream has more than
  // one attached goal, since the cluster is centered based on the
  // *whole* sibling group.
  const goalPositionById = useMemo(() => {
    const map = new Map<number, { x: number; y: number }>();
    for (const dream of activeDreams) {
      const dreamLinks = linksByDream.get(dream.id) ?? [];
      if (dreamLinks.length === 0) continue;
      const positions = goalPositionsFor(positionFor(dream), dreamLinks, goalById);
      dreamLinks.forEach((link, i) => map.set(link.id, positions[i]));
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDreams, linksByDream, goalById]);

  // Nodes are rebuilt from `activeDreams`/`goalDreamLinks` whenever
  // either changes. A dated dream's y always comes from its date —
  // dragging can only ever move x (see onNodesChange) — so there's no
  // "live drag position" for y to preserve here. Goal attachments are
  // draggable horizontally too (see item 10) — same x-only rule, y
  // always computed via goalYFor.
  useEffect(() => {
    const dreamNodes: Node[] = activeDreams.map((dream) => ({
      id: dreamNodeId(dream.id),
      type: "dreamNode",
      position: positionFor(dream),
      data: {
        name: dream.name,
        priority: dream.priority,
        expectedDateStart: dream.expectedDateStart,
        expectedDateEnd: dream.expectedDateEnd,
      },
    }));

    // One node per attachment — a goal linked to three dreams renders
    // three separate nodes, one clustered under each.
    const goalNodes: Node[] = goalDreamLinks
      .filter((link) => goalPositionById.has(link.id))
      .map((link) => {
        const goal = goalById.get(link.goalId)!;
        return {
          id: goalNodeId(link.id),
          type: "dreamGoalNode",
          position: goalPositionById.get(link.id)!,
          deletable: false,
          data: {
            name: goal.name,
            onOpenWeb: () => onNavigate({ type: "goal-web", goalId: goal.id }),
          },
        };
      });

    setNodes([...dreamNodes, ...goalNodes]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDreams, goalDreamLinks, goalById, goalPositionById, onNavigate]);

  const edges: Edge[] = useMemo(() => {
    const activeIds = new Set(activeDreams.map((d) => d.id));
    const dreamPos = new Map(activeDreams.map((d) => [d.id, positionFor(d)]));
    const dreamSize = new Map(activeDreams.map((d) => [d.id, nodeSizeFor(d.priority, 1)]));

    const linkEdges: Edge[] = links
      .filter((l) => activeIds.has(l.sourceDreamId) && activeIds.has(l.targetDreamId))
      .map((link) => {
        const sp = dreamPos.get(link.sourceDreamId)!;
        const ss = dreamSize.get(link.sourceDreamId)!;
        const tp = dreamPos.get(link.targetDreamId)!;
        const ts = dreamSize.get(link.targetDreamId)!;
        const sCenter = { x: sp.x + ss.width / 2, y: sp.y + ss.height / 2 };
        const tCenter = { x: tp.x + ts.width / 2, y: tp.y + ts.height / 2 };
        const sourceAngle = link.sourceAngle ?? angleFromDirection(tCenter.x - sCenter.x, tCenter.y - sCenter.y);
        const targetAngle = link.targetAngle ?? angleFromDirection(sCenter.x - tCenter.x, sCenter.y - tCenter.y);
        const p1 = anchorPoint(sp, ss, theme.dreamNodeShape, sourceAngle);
        const p2 = anchorPoint(tp, ts, theme.dreamNodeShape, targetAngle);
        return {
          id: linkEdgeId(link.id),
          source: dreamNodeId(link.sourceDreamId),
          target: dreamNodeId(link.targetDreamId),
          sourceHandle: `out-${snapToAnchor(sourceAngle)}`,
          targetHandle: `in-${snapToAnchor(targetAngle)}`,
          reconnectable: true,
          type: "angleEdge",
          data: { x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y } satisfies AngleEdgeData,
          style: { stroke: theme.dreamLinkColor, strokeWidth: 2 },
        };
      });

    // Thin dashed lines from a dream to each goal attached to it —
    // purely visual "attached to parent" indicators for real
    // goal_dream_links rows, but (unlike the old single-attachment
    // version) genuinely deletable/reconnectable now: removing one just
    // detaches that one instance, since a goal can have others. The
    // dream end still uses real shape-boundary math; the goal end is
    // always angle 0 on a plain rectangle (goals have no shape system).
    const goalEdges: Edge[] = activeDreams.flatMap((dream) => {
      const dreamLinks = linksByDream.get(dream.id) ?? [];
      const dp = positionFor(dream);
      const ds = nodeSizeFor(dream.priority, 1);
      return dreamLinks.map((link) => {
        // Same map the node itself is positioned from (goalPositionById,
        // built once above) — not recomputed per-link, so a dream with
        // multiple attached goals gets the exact same x every sibling
        // actually renders at, not a stand-alone "just this one" position.
        const resolved = goalPositionById.get(link.id)!;
        const dCenter = { x: dp.x + ds.width / 2, y: dp.y + ds.height / 2 };
        const gCenter = { x: resolved.x + GOAL_SIZE.width / 2, y: resolved.y + GOAL_SIZE.height / 2 };
        // A dragged attachment point (see item 4's fix) sticks instead
        // of snapping back to auto-pointing at the goal every render.
        const dreamAngle = link.attachAngle ?? angleFromDirection(gCenter.x - dCenter.x, gCenter.y - dCenter.y);
        const p1 = anchorPoint(dp, ds, theme.dreamNodeShape, dreamAngle);
        const p2 = anchorPoint(resolved, GOAL_SIZE, GOAL_SHAPE, 0);
        return {
          id: goalEdgeId(link.id),
          source: dreamNodeId(dream.id),
          target: goalNodeId(link.id),
          sourceHandle: `out-${snapToAnchor(dreamAngle)}`,
          targetHandle: "in-0",
          deletable: true,
          selectable: true,
          reconnectable: true,
          type: "angleEdge",
          data: { x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y } satisfies AngleEdgeData,
          style: { stroke: theme.dreamGoalNodeOutlineColor, strokeWidth: 1.5, strokeDasharray: "4 3", opacity: 0.7 },
        };
      });
    });

    return [...linkEdges, ...goalEdges];
  }, [
    links,
    activeDreams,
    linksByDream,
    goalPositionById,
    theme.dreamLinkColor,
    theme.dreamGoalNodeOutlineColor,
    theme.dreamNodeShape,
  ]);

  const onNodesChange = (changes: NodeChange[]) => {
    const adjusted = changes
      .filter((c) => c.type !== "remove")
      .map((c) => {
        if (c.type !== "position" || !c.position) return c;
        if (c.id.startsWith("g-")) {
          const link = linkById.get(parseGoalNodeId(c.id));
          if (!link) return c;
          // Goal attachments only ever move horizontally — y snaps back
          // to its computed value every change, same "locked axis" trick
          // dated dreams use.
          return { ...c, position: { x: c.position.x, y: goalYFor(link) } };
        }
        const dream = dreamById.get(parseDreamNodeId(c.id));
        if (!dream?.expectedDateStart) return c;
        // Dated dreams can only move horizontally — y snaps back to the
        // date-derived position every change, not just on drop, so the
        // node visually tracks a straight horizontal line while dragging.
        return { ...c, position: { x: c.position.x, y: rangeMidY(dream.expectedDateStart, dream.expectedDateEnd) } };
      });
    setNodes((nds) => applyNodeChanges(adjusted, nds));
  };

  const onNodeDragStop = (_: MouseEvent | TouchEvent, node: Node) => {
    if (node.id.startsWith("g-")) {
      const linkId = parseGoalNodeId(node.id);
      if (!linkById.has(linkId)) return;
      const x = node.position.x;
      updateGoalDreamLinkPosX(linkId, x);
      setGoalDreamLinks((prev) => prev.map((l) => (l.id === linkId ? { ...l, posX: x } : l)));
      return;
    }
    const id = parseDreamNodeId(node.id);
    const dream = dreamById.get(id);
    if (!dream) return;
    const { x, y } = node.position;
    if (dream.expectedDateStart) {
      updateDreamPositionX(id, x);
    } else {
      updateDreamPosition(id, x, y);
    }
    setDreams((prev) => prev.map((d) => (d.id === id ? { ...d, posX: x, posY: y } : d)));
  };

  const onConnect = (connection: Connection) => {
    if (!connection.source || !connection.target) return;
    const sourceIsDream = connection.source.startsWith("d-");
    const targetIsDream = connection.target.startsWith("d-");
    const sourceIsGoal = connection.source.startsWith("g-");
    const targetIsGoal = connection.target.startsWith("g-");

    if (sourceIsDream && targetIsDream) {
      const sourceId = parseDreamNodeId(connection.source);
      const targetId = parseDreamNodeId(connection.target);
      if (sourceId === targetId) return;
      const sourceAngle = parseAngleHandleId(connection.sourceHandle);
      const targetAngle = parseAngleHandleId(connection.targetHandle);
      addDreamLink(sourceId, targetId, sourceAngle, targetAngle).then(load);
      return;
    }

    // Dragging a fresh connection between a dream's boundary and an
    // already-rendered goal node attaches that goal to this dream too
    // (see item 9) — works either direction, since a drag can start
    // from either side. If the goal is already attached to this exact
    // dream, this just updates the pinned attachment angle (see item 4's
    // fix) instead of duplicating the link; otherwise it's a brand new
    // attachment and the goal will render one more node here.
    if ((sourceIsDream && targetIsGoal) || (sourceIsGoal && targetIsDream)) {
      const dreamHandle = sourceIsDream ? connection.sourceHandle : connection.targetHandle;
      const dreamId = parseDreamNodeId(sourceIsDream ? connection.source : connection.target);
      const linkId = parseGoalNodeId(sourceIsGoal ? connection.source : connection.target);
      const link = linkById.get(linkId);
      if (!link) return;
      const angle = parseAngleHandleId(dreamHandle);
      addOrUpdateGoalDreamLink(link.goalId, dreamId, angle).then(load);
    }
  };

  // Grabbing an existing edge's endpoint and dropping it somewhere else
  // (a different angle on the same node, or a different node entirely)
  // — without this, edges built from a custom edge type (AngleEdge) and
  // rendered with data-driven points aren't reconnectable by default,
  // which was item 4's actual bug: dragging did nothing because there
  // was no handler wired up to react to it at all.
  const onReconnect = (oldEdge: Edge, newConnection: Connection) => {
    if (oldEdge.id.startsWith("link-")) {
      if (!newConnection.source?.startsWith("d-") || !newConnection.target?.startsWith("d-")) return;
      const sourceId = parseDreamNodeId(newConnection.source);
      const targetId = parseDreamNodeId(newConnection.target);
      if (sourceId === targetId) return;
      const sourceAngle = parseAngleHandleId(newConnection.sourceHandle);
      const targetAngle = parseAngleHandleId(newConnection.targetHandle);
      // Old pair may differ from the new one (dragged to a different
      // dream entirely) — remove the old row first so a retarget
      // doesn't leave a stale link behind alongside the new one.
      removeDreamLink(parseLinkEdgeId(oldEdge.id))
        .then(() => addDreamLink(sourceId, targetId, sourceAngle, targetAngle))
        .then(load);
      return;
    }

    if (oldEdge.id.startsWith("goal-edge-")) {
      if (!newConnection.source || !newConnection.target) return;
      const sourceIsDream = newConnection.source.startsWith("d-");
      const targetIsDream = newConnection.target.startsWith("d-");
      if (!sourceIsDream && !targetIsDream) return;
      const linkId = parseGoalEdgeId(oldEdge.id);
      const link = linkById.get(linkId);
      if (!link) return;
      const dreamHandle = sourceIsDream ? newConnection.sourceHandle : newConnection.targetHandle;
      const newDreamId = parseDreamNodeId(sourceIsDream ? newConnection.source : newConnection.target);
      const angle = parseAngleHandleId(dreamHandle);
      if (newDreamId === link.dreamId) {
        // Same dream, just a different angle on it.
        updateGoalDreamLinkAngle(linkId, angle).then(load);
      } else {
        // Dragged this specific edge's end to a different dream — moves
        // that one attachment rather than adding a new one (a fresh
        // connect gesture from the dream's boundary is what adds a new
        // attachment; see onConnect above).
        Promise.all([removeGoalDreamLink(linkId), addOrUpdateGoalDreamLink(link.goalId, newDreamId, angle)]).then(
          load
        );
      }
    }
  };

  const onEdgesDelete = (deleted: Edge[]) => {
    for (const edge of deleted) {
      if (edge.id.startsWith("link-")) {
        removeDreamLink(parseLinkEdgeId(edge.id)).then(load);
      } else if (edge.id.startsWith("goal-edge-")) {
        removeGoalDreamLink(parseGoalEdgeId(edge.id)).then(load);
      }
    }
  };

  const onNodeClick = (_: React.MouseEvent, node: Node) => {
    if (node.id.startsWith("g-")) {
      const link = linkById.get(parseGoalNodeId(node.id));
      if (link) onNavigate({ type: "goal-detail", goalId: link.goalId });
      return;
    }
    onNavigate({ type: "dream-detail", dreamId: parseDreamNodeId(node.id) });
  };

  const handleAddDream = async () => {
    setCreating(true);
    try {
      const undatedCount = dreams.filter((d) => !d.expectedDateStart && !d.isAsleep).length;
      const x = UNDATED_LANE_X - Math.floor(undatedCount / 5) * 160;
      const y = (undatedCount % 5) * 110 - 220;
      const id = await addDream("New Dream", x, y);
      onNavigate({ type: "dream-detail", dreamId: id });
    } finally {
      setCreating(false);
    }
  };

  const timeline = [...activeDreams].sort(timelineSort);
  const showMonthLines = zoom >= MONTH_ZOOM_THRESHOLD;

  const priorityColorFor = (p: DreamPriority) =>
    p === "high" ? theme.dreamPriorityHigh : p === "low" ? theme.dreamPriorityLow : theme.dreamPriorityMedium;

  if (loading) {
    return (
      <div className="page">
        <p className="page-text">Loading Dream Web…</p>
      </div>
    );
  }

  return (
    <div className="dream-web-shell">
      <aside className="dream-timeline">
        <div className="dream-timeline-header">
          <h2 className="dream-timeline-title">Timeline</h2>
          <button className="add-button" onClick={handleAddDream} disabled={creating}>
            {creating ? "Adding…" : "+ Dream"}
          </button>
        </div>
        {timeline.length === 0 && <p className="page-text">No dreams yet.</p>}
        <ul className="dream-timeline-list">
          {timeline.map((dream) => (
            <li key={dream.id}>
              <button
                className="dream-timeline-item"
                onClick={() => onNavigate({ type: "dream-detail", dreamId: dream.id })}
              >
                <span className="dream-timeline-dot" style={{ background: priorityColorFor(dream.priority) }} />
                <span className="dream-timeline-info">
                  <span className="dream-timeline-name">{dream.name}</span>
                  <span className="dream-timeline-date">{dream.expectedDateStart || "No date set"}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>

        {sleepingDreams.length > 0 && (
          <>
            <h2 className="dream-timeline-title dream-timeline-title-sleeping">Sleeping</h2>
            <ul className="dream-timeline-list">
              {sleepingDreams.map((dream) => (
                <li key={dream.id}>
                  <button
                    className="dream-timeline-item dream-timeline-item-sleeping"
                    onClick={() => onNavigate({ type: "dream-detail", dreamId: dream.id })}
                  >
                    <span className="dream-timeline-info">
                      <span className="dream-timeline-name">{dream.name}</span>
                      <span className="dream-timeline-date">until {dream.sleepUntil}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </aside>

      <div className="dream-canvas-area">
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "12px" }}>
          <h1 style={{ margin: 0, fontSize: "22px" }}>Dream Web</h1>
          <StyledButton buttonKey="web-zoom-back" iconKey="back" onClick={() => onNavigate({ type: "home" })} />
        </div>

        <div
          className="dream-canvas"
          style={{
            backgroundImage: theme.dreamWebBackgroundImage ? `url("${theme.dreamWebBackgroundImage}")` : "none",
          }}
        >
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            onNodesChange={onNodesChange}
            onNodeDragStop={onNodeDragStop}
            onConnect={onConnect}
            onReconnect={onReconnect}
            onEdgesDelete={onEdgesDelete}
            onNodeClick={onNodeClick}
            onMoveEnd={handleMoveEnd}
            defaultViewport={initialViewport ?? undefined}
            fitView={!initialViewport}
            connectionMode={ConnectionMode.Loose}
            connectionLineType={ConnectionLineType.Straight}
            deleteKeyCode={["Backspace", "Delete"]}
            minZoom={0.05}
            maxZoom={4}
            proOptions={{ hideAttribution: true }}
          >
            <ViewportPortal>
              {/* zIndex: -1 — without it this portal's content (grid
                  lines + the date range bars below) paints on top of the
                  dream/goal node layer instead of behind it, since it's
                  appended to the DOM after them. */}
              <div style={{ position: "absolute", top: 0, left: 0, zIndex: -1 }}>
                {gridLines
                  .filter((l) => l.isYear || showMonthLines)
                  .map((l, i) => (
                    <div
                      key={i}
                      style={{
                        position: "absolute",
                        top: l.y,
                        left: -6000,
                        height: l.isCurrentYear ? 3 : l.isYear ? 2 : 1,
                        width: 13000,
                        background: l.isCurrentYear
                          ? "#f4c430"
                          : l.isYear
                          ? "rgba(255,255,255,0.22)"
                          : "rgba(255,255,255,0.08)",
                        boxShadow: l.isCurrentYear ? "0 0 8px rgba(244,196,48,0.6)" : "none",
                        pointerEvents: "none",
                      }}
                    >
                      <span
                        style={{
                          position: "absolute",
                          top: l.isCurrentYear ? -19 : -16,
                          left: 5980,
                          fontSize: l.isCurrentYear ? 13 : l.isYear ? 12 : 10,
                          fontWeight: l.isCurrentYear || l.isYear ? 700 : 400,
                          color: l.isCurrentYear ? "#f4c430" : "rgba(255,255,255,0.55)",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {l.label}
                      </span>
                    </div>
                  ))}

                <svg style={{ position: "absolute", left: 0, top: 0, overflow: "visible", pointerEvents: "none" }}>
                  {activeDreams
                    .filter(
                      (d) => d.expectedDateStart && d.expectedDateEnd && d.expectedDateStart !== d.expectedDateEnd
                    )
                    .map((dream) => {
                      // Future is up (see isoToY) — the later/end date
                      // always ends up with the smaller y, so it's the
                      // top of the bar regardless of which literal field
                      // (start/end) that is.
                      const startY = isoToY(dream.expectedDateStart!);
                      const endY = isoToY(dream.expectedDateEnd!);
                      const { width } = nodeSizeFor(dream.priority, zoom);
                      const centerX = dream.posX + width / 2;
                      // Matches the dream node's own outline color (a
                      // single theme setting, not per-priority) rather
                      // than the priority dot color — see item 10.
                      const color = theme.dreamNodeOutlineColor;
                      const yTop = Math.min(startY, endY);
                      const yBottom = Math.max(startY, endY);
                      const topLabel = yTop === endY ? dream.expectedDateEnd! : dream.expectedDateStart!;
                      const bottomLabel = yTop === endY ? dream.expectedDateStart! : dream.expectedDateEnd!;
                      return (
                        <g key={dream.id}>
                          <path d={rangeBarPath(centerX, yTop, yBottom)} fill={color} opacity={0.75} />
                          <text
                            x={centerX}
                            y={yTop - 8}
                            textAnchor="middle"
                            fontSize={12}
                            fontWeight={700}
                            fill={color}
                            style={{ paintOrder: "stroke", stroke: "rgba(0,0,0,0.55)", strokeWidth: 3 }}
                          >
                            {formatShortDate(topLabel)}
                          </text>
                          <text
                            x={centerX}
                            y={yBottom + 18}
                            textAnchor="middle"
                            fontSize={12}
                            fontWeight={700}
                            fill={color}
                            style={{ paintOrder: "stroke", stroke: "rgba(0,0,0,0.55)", strokeWidth: 3 }}
                          >
                            {formatShortDate(bottomLabel)}
                          </text>
                        </g>
                      );
                    })}
                </svg>
              </div>
            </ViewportPortal>

            <Panel position="top-right" className="dream-canvas-hint">
              Future is up, past is down. Drag from anywhere along a node's edge to link dreams, or to
              attach a goal to a dream. Dated dreams and goals only move left/right — change the date
              to move them in time.
            </Panel>
            <Background
              color="#64748b"
              bgColor={theme.dreamWebBackgroundImage ? "transparent" : theme.dreamWebBackground}
              gap={16}
            />
            <WebControls />
          </ReactFlow>
        </div>
      </div>
    </div>
  );
}

export function DreamWebPage({ onNavigate }: { onNavigate: (view: View) => void }) {
  return (
    <ReactFlowProvider>
      <DreamWebInner onNavigate={onNavigate} />
    </ReactFlowProvider>
  );
}
