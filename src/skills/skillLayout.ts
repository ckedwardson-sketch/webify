// Deterministic tree layout for the Skill Tree canvas. Pure function, no
// DOM/React Flow dependency, so it's easy to reason about independently
// (see plan section 31/13) — positions are recomputed from the semantic
// tree every render, never hand-placed or persisted per-node.
import { SkillGoal, SkillSettings, SkillTreeDirection } from "../types/skill";

export interface GoalPosition {
  x: number;
  y: number;
}

export interface SkillTreeLayout {
  positions: Map<number, GoalPosition>;
  // parentId -> ordered children, tree goals only (historical excluded)
  childrenOf: Map<number, SkillGoal[]>;
  roots: SkillGoal[];
  historicalGoals: SkillGoal[];
  // Edges to draw: goal-to-goal connections, tree branches plus the
  // historical chain plus the link from the last historical goal into
  // the tree's root(s).
  edges: { id: string; sourceId: number; targetId: number; historical: boolean }[];
  bounds: { minX: number; maxX: number; minY: number; maxY: number };
}

export function layoutSkillTree(
  goals: SkillGoal[],
  settings: Pick<SkillSettings, "direction" | "hSpacing" | "vSpacing" | "branchSpacing" | "historicalSpacing">
): SkillTreeLayout {
  const vertical = settings.direction === "vertical";
  // depthSpacing grows along the tree's "forward" axis (x normally, y
  // when vertical); siblingSpacing spreads leaves along the other axis.
  // Swapping which named field feeds which axis is the whole
  // direction switch — everything downstream just reads x/y as usual.
  const depthSpacing = vertical ? settings.vSpacing : settings.hSpacing;
  const siblingSpacing = settings.branchSpacing;
  const treeGoals = goals.filter((g) => g.status !== "historical");
  const historicalGoals = goals
    .filter((g) => g.status === "historical")
    .sort((a, b) => (a.historyOrder ?? 0) - (b.historyOrder ?? 0));

  const byId = new Map(treeGoals.map((g) => [g.id, g]));
  const childrenOf = new Map<number, SkillGoal[]>();
  const roots: SkillGoal[] = [];

  for (const g of treeGoals) {
    if (g.parentGoalId != null && byId.has(g.parentGoalId)) {
      const list = childrenOf.get(g.parentGoalId) ?? [];
      list.push(g);
      childrenOf.set(g.parentGoalId, list);
    } else {
      roots.push(g);
    }
  }
  // Stable ordering so layout doesn't jitter between renders.
  for (const list of childrenOf.values()) list.sort((a, b) => a.id - b.id);
  roots.sort((a, b) => a.id - b.id);

  const positions = new Map<number, GoalPosition>();
  let leafCounter = 0;

  function place(goal: SkillGoal, depth: number): number {
    const children = childrenOf.get(goal.id) ?? [];
    let cross: number; // position along the sibling-spread axis
    if (children.length === 0) {
      cross = leafCounter * siblingSpacing;
      leafCounter++;
    } else {
      const childCrosses = children.map((c) => place(c, depth + 1));
      cross = (Math.min(...childCrosses) + Math.max(...childCrosses)) / 2;
    }
    const along = depth * depthSpacing; // position along the depth axis
    positions.set(goal.id, vertical ? { x: cross, y: along } : { x: along, y: cross });
    return cross;
  }

  for (const root of roots) place(root, 0);

  const rootCross = roots.length > 0 ? (vertical ? positions.get(roots[0].id)!.x : positions.get(roots[0].id)!.y) : 0;
  historicalGoals.forEach((g, i) => {
    const idxFromEnd = historicalGoals.length - 1 - i;
    const along = -(idxFromEnd + 1) * settings.historicalSpacing;
    positions.set(g.id, vertical ? { x: rootCross, y: along } : { x: along, y: rootCross });
  });

  const edges: SkillTreeLayout["edges"] = [];
  for (const g of treeGoals) {
    if (g.parentGoalId != null && byId.has(g.parentGoalId)) {
      edges.push({ id: `e-${g.parentGoalId}-${g.id}`, sourceId: g.parentGoalId, targetId: g.id, historical: false });
    }
  }
  for (let i = 0; i < historicalGoals.length - 1; i++) {
    edges.push({
      id: `he-${historicalGoals[i].id}-${historicalGoals[i + 1].id}`,
      sourceId: historicalGoals[i].id,
      targetId: historicalGoals[i + 1].id,
      historical: true,
    });
  }
  if (historicalGoals.length > 0) {
    const last = historicalGoals[historicalGoals.length - 1];
    for (const root of roots) {
      edges.push({ id: `he-${last.id}-${root.id}`, sourceId: last.id, targetId: root.id, historical: true });
    }
  }

  const allPositions = Array.from(positions.values());
  const bounds = allPositions.reduce(
    (b, p) => ({
      minX: Math.min(b.minX, p.x),
      maxX: Math.max(b.maxX, p.x),
      minY: Math.min(b.minY, p.y),
      maxY: Math.max(b.maxY, p.y),
    }),
    { minX: 0, maxX: 0, minY: 0, maxY: 0 }
  );

  return { positions, childrenOf, roots, historicalGoals, edges, bounds };
}

// Midpoint (before the user's manual offset is applied) of a goal-to-goal
// path — the anchor a floating task's connector line points back to.
export function pathMidpoint(
  layout: SkillTreeLayout,
  sourceGoalId: number,
  targetGoalId: number
): GoalPosition | null {
  const a = layout.positions.get(sourceGoalId);
  const b = layout.positions.get(targetGoalId);
  if (!a || !b) return null;
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

// A goal-to-goal path as the SAME 3-segment polyline SkillTreeBentEdge
// actually draws (horizontal out of source, vertical jog, horizontal into
// target) — not a straight line between the goal centers. The earlier
// straight-line version computed a "perpendicular" that had nothing to do
// with what was on screen, since the rendered edge is a dogleg. Walking
// the real polyline is what makes the task's connector line actually
// perpendicular to whichever segment it's closest to, matching the edge
// exactly, and lets "closest point" and "max distance" work in screen
// space instead of an unrelated straight-line abstraction.
interface PathSegment {
  a: GoalPosition;
  b: GoalPosition;
  length: number;
  dir: GoalPosition;
  perp: GoalPosition;
}

export interface PathAnchor {
  segments: PathSegment[];
  totalLength: number;
}

function makeSegment(a: GoalPosition, b: GoalPosition): PathSegment | null {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = Math.hypot(dx, dy);
  if (length < 0.01) return null;
  const dir = { x: dx / length, y: dy / length };
  const perp = { x: -dir.y, y: dir.x };
  return { a, b, length, dir, perp };
}

export function pathAnchor(
  layout: SkillTreeLayout,
  sourceGoalId: number,
  targetGoalId: number,
  nodeWidth: number,
  nodeHeight: number,
  bendDistance: number,
  direction: SkillTreeDirection = "horizontal"
): PathAnchor | null {
  const a = layout.positions.get(sourceGoalId);
  const b = layout.positions.get(targetGoalId);
  if (!a || !b) return null;
  // Mirrors the Handle positions on SkillGoalNodeView (horizontal:
  // source right edge -> target left edge; vertical: source bottom
  // edge -> target top edge) and SkillTreeBentEdge's own bend-clamping
  // math exactly, for whichever axis is the tree's depth axis.
  const vertical = direction === "vertical";
  const sourceX = vertical ? a.x + nodeWidth / 2 : a.x + nodeWidth;
  const sourceY = vertical ? a.y + nodeHeight : a.y + nodeHeight / 2;
  const targetX = vertical ? b.x + nodeWidth / 2 : b.x;
  const targetY = vertical ? b.y : b.y + nodeHeight / 2;
  const points: GoalPosition[] = vertical
    ? (() => {
        const bend = Math.max(12, Math.min(bendDistance, Math.abs(targetY - sourceY) - 4));
        const bendY = sourceY + bend;
        return [
          { x: sourceX, y: sourceY },
          { x: sourceX, y: bendY },
          { x: targetX, y: bendY },
          { x: targetX, y: targetY },
        ];
      })()
    : (() => {
        const bend = Math.max(12, Math.min(bendDistance, Math.abs(targetX - sourceX) - 4));
        const bendX = sourceX + bend;
        return [
          { x: sourceX, y: sourceY },
          { x: bendX, y: sourceY },
          { x: bendX, y: targetY },
          { x: targetX, y: targetY },
        ];
      })();
  const segments: PathSegment[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const seg = makeSegment(points[i], points[i + 1]);
    if (seg) segments.push(seg);
  }
  if (segments.length === 0) return null;
  const totalLength = segments.reduce((s, seg) => s + seg.length, 0);
  return { segments, totalLength };
}

function pointAtAlong(pa: PathAnchor, along: number): { base: GoalPosition; perpDir: GoalPosition } {
  let remaining = Math.max(0, Math.min(pa.totalLength, along));
  for (const seg of pa.segments) {
    if (remaining <= seg.length || seg === pa.segments[pa.segments.length - 1]) {
      const t = Math.min(remaining, seg.length);
      return {
        base: { x: seg.a.x + seg.dir.x * t, y: seg.a.y + seg.dir.y * t },
        perpDir: seg.perp,
      };
    }
    remaining -= seg.length;
  }
  const last = pa.segments[pa.segments.length - 1];
  return { base: last.b, perpDir: last.perp };
}

// Projects an arbitrary point (e.g. a drag position) onto the path's
// polyline, returning (along, perp) offsets — along is cumulative distance
// from the source end, perp is the signed distance from whichever segment
// is closest, clamped to a max — this is the "lock onto the path" /
// "closest point" + "limit distance" behavior.
export function projectOntoPath(
  pa: PathAnchor,
  point: GoalPosition,
  maxPerp: number
): { along: number; perp: number } {
  let best: { along: number; perp: number; dist: number } | null = null;
  let cumulative = 0;
  for (const seg of pa.segments) {
    const vx = point.x - seg.a.x;
    const vy = point.y - seg.a.y;
    const t = Math.max(0, Math.min(seg.length, vx * seg.dir.x + vy * seg.dir.y));
    const candidate = { x: seg.a.x + seg.dir.x * t, y: seg.a.y + seg.dir.y * t };
    const perp = (point.x - candidate.x) * seg.perp.x + (point.y - candidate.y) * seg.perp.y;
    const dist = Math.hypot(point.x - candidate.x, point.y - candidate.y);
    if (!best || dist < best.dist) best = { along: cumulative + t, perp, dist };
    cumulative += seg.length;
  }
  const clampedPerp = Math.max(-maxPerp, Math.min(maxPerp, best!.perp));
  return { along: best!.along, perp: clampedPerp };
}

export function positionFromOffsets(pa: PathAnchor, along: number, perp: number): GoalPosition {
  const { base, perpDir } = pointAtAlong(pa, along);
  return { x: base.x + perpDir.x * perp, y: base.y + perpDir.y * perp };
}

// The point on the path itself (perp = 0) that a task's connector line
// should originate from — the "closest point" for its given along-offset.
export function anchorPointForOffsets(pa: PathAnchor, along: number): GoalPosition {
  return pointAtAlong(pa, along).base;
}
