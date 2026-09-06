// src/webGraph/goalCluster.ts
//
// Pure layout math for "everything one goal owns" — projects, their
// tasks, direct tasks, and responsibilities, clustered around a goal
// summary node. Extracted out of GoalWebPage.tsx so DreamWebPage's
// "full" view can render the exact same layout (just translated to sit
// under wherever that goal's node lands on the Dream Web) instead of
// reimplementing it and risking drift between the two pages.
import { Goal, Project } from "../types/project";
import { ProgressNode } from "../types/models";
import { Responsibility } from "../types/responsibility";
import { PROGRESS_BASE_SIZE, progressNodeSize } from "../components/ProgressGraphNodes";

export interface Point {
  x: number;
  y: number;
}

export interface GoalClusterLayout {
  goalPos: Point;
  projectPos: Map<number, Point>;
  taskPos: Map<number, Point>;
  respPos: Map<number, Point>;
}

export type ClusterDirection = "horizontal" | "vertical";

function swapPoint(p: Point): Point {
  return { x: p.y, y: p.x };
}

// Rotates an already-computed (horizontal) cluster layout 90° into a
// top-down flow by transposing every point — a mechanical x/y swap
// rather than re-deriving each section's grid math for a second axis.
// This keeps every existing saved drag offset (webPosX/webPosY) and
// relative spacing meaningful post-rotation instead of risking overlap
// bugs from hand-adjusting the many independent zone constants below.
function rotateCluster(layout: GoalClusterLayout): GoalClusterLayout {
  return {
    goalPos: swapPoint(layout.goalPos),
    projectPos: new Map(Array.from(layout.projectPos, ([id, p]) => [id, swapPoint(p)])),
    taskPos: new Map(Array.from(layout.taskPos, ([id, p]) => [id, swapPoint(p)])),
    respPos: new Map(Array.from(layout.respPos, ([id, p]) => [id, swapPoint(p)])),
  };
}

// Base (scale = 1) layout constants — identical to GoalWebPage's former
// inline values, so an existing goal's web looks pixel-identical after
// this extraction.
const GOAL_NODE_POS: Point = { x: -260, y: -40 };
const GOAL_TASKS_BASE: Point = { x: -260, y: 110 };
const RESPONSIBILITIES_BASE: Point = { x: -260, y: 420 };
const PROJECT_TASKS_Y_OFFSET = 120;
const PROJECT_COL_WIDTH = 260;
const PROJECT_ROW_HEIGHT = 360;
const PROJECT_PER_ROW = 4;
const RESP_COL_WIDTH = 190;
const RESP_ROW_HEIGHT = 130;
const RESP_PER_ROW = 5;
const TASK_GRID_SIZE = 110;
const TASK_PER_ROW = 5;

function gridPosition(index: number, colWidth: number, rowHeight: number, perRow: number): Point {
  const col = index % perRow;
  const row = Math.floor(index / perRow);
  return { x: col * colWidth, y: row * rowHeight };
}

function scalePoint(p: Point, scale: number): Point {
  return { x: p.x * scale, y: p.y * scale };
}

// Grid position for a single new task, used when placing a freshly
// created one (mirrors GoalWebPage's old handleAddTask math) — not part
// of the persisted layout itself, since a task's actual position always
// comes from its own posX/posY once created.
export function nextTaskGridPosition(countForOwner: number, scale = 1): Point {
  return scalePoint(gridPosition(countForOwner, TASK_GRID_SIZE, TASK_GRID_SIZE, TASK_PER_ROW), scale);
}

export function computeGoalCluster(
  _goal: Goal,
  projects: Project[],
  tasks: ProgressNode[],
  responsibilities: Responsibility[],
  scale = 1,
  direction: ClusterDirection = "horizontal"
): GoalClusterLayout {
  const s = scale || 1;

  const projectPos = new Map<number, Point>();
  const projectBases = new Map<number, Point>();
  projects.forEach((p, i) => {
    const base = scalePoint(gridPosition(i, PROJECT_COL_WIDTH, PROJECT_ROW_HEIGHT, PROJECT_PER_ROW), s);
    projectBases.set(p.id, base);
    projectPos.set(p.id, { x: base.x + (p.webPosX ?? 0) * s, y: base.y + (p.webPosY ?? 0) * s });
  });

  const goalTasksBase = scalePoint(GOAL_TASKS_BASE, s);
  const taskOwnerBase = (task: ProgressNode): Point => {
    if (task.projectId != null) {
      // Uses the project's post-drag position (projectPos), not its bare
      // grid slot (projectBases) — so a project's own tasks visually
      // travel with it when its card is dragged off-grid.
      const base = projectPos.get(task.projectId) ?? { x: 0, y: 0 };
      return { x: base.x, y: base.y + PROJECT_TASKS_Y_OFFSET * s };
    }
    return goalTasksBase;
  };

  const taskPos = new Map<number, Point>();
  for (const task of tasks) {
    const base = taskOwnerBase(task);
    taskPos.set(task.id, { x: base.x + task.posX * s, y: base.y + task.posY * s });
  }

  const respBase = scalePoint(RESPONSIBILITIES_BASE, s);
  const respPos = new Map<number, Point>();
  responsibilities.forEach((resp, i) => {
    const offset = scalePoint(gridPosition(i, RESP_COL_WIDTH, RESP_ROW_HEIGHT, RESP_PER_ROW), s);
    const base = { x: respBase.x + offset.x, y: respBase.y + offset.y };
    respPos.set(resp.id, { x: base.x + (resp.webPosX ?? 0) * s, y: base.y + (resp.webPosY ?? 0) * s });
  });

  const layout: GoalClusterLayout = { goalPos: scalePoint(GOAL_NODE_POS, s), projectPos, taskPos, respPos };
  return direction === "vertical" ? rotateCluster(layout) : layout;
}

// Card sizes — kept in sync with the literal px widths/heights each
// card component (GoalGraphNodes.tsx) actually renders at, since the
// link-anchor ring math (GoalWebPage.tsx/DreamWebPage.tsx edges) needs
// to know a node's box to place a boundary point on it.
export interface Size {
  width: number;
  height: number;
}
export const GOAL_SUMMARY_SIZE: Size = { width: 180, height: 90 };
export const PROJECT_CARD_SIZE: Size = { width: 180, height: 84 };
export const RESP_CARD_SIZE: Size = { width: 170, height: 104 };

// The box a goal_web_link's endpoint id resolves to, for anchor-ring
// math — same id scheme GoalWebPage/DreamWebPage's cluster nodes use
// ("goal-end", "pr-<id>", "tk-<id>", "rs-<id>").
export function nodeBoxFor(nodeId: string, taskById: Map<number, ProgressNode>): { width: number; height: number } {
  if (nodeId === "goal-end") return GOAL_SUMMARY_SIZE;
  if (nodeId.startsWith("pr-")) return PROJECT_CARD_SIZE;
  if (nodeId.startsWith("rs-")) return RESP_CARD_SIZE;
  if (nodeId.startsWith("tk-")) {
    const task = taskById.get(Number(nodeId.slice(3)));
    const size = task ? progressNodeSize(task.difficulty) : PROGRESS_BASE_SIZE;
    return { width: size, height: size };
  }
  return { width: 100, height: 100 };
}
