import { getDb } from "./database";
import { ProgressCategory, ProgressDifficulty, ProgressNode } from "../types/models";

export const PROGRESS_COLUMNS = `
  id, project_id as projectId, goal_id as goalId, category, short_description as shortDescription, description,
  difficulty, reason, instructions, image_data as imageData,
  is_complete as isComplete, is_read as isRead,
  pos_x as posX, pos_y as posY, cost, completed_at as completedAt, created_at as createdAt, updated_at as updatedAt,
  web_scale as webScale, favorite, glow_amount as glowAmount, glow_color as glowColor,
  task_board_status as taskBoardStatus, task_is_standalone as taskIsStandalone,
  task_added_at as taskAddedAt, task_goal_days as taskGoalDays, task_due_at as taskDueAt,
  task_completion_image as taskCompletionImage,
  task_archive_reason as taskArchiveReason, task_missed_count as taskMissedCount,
  linked_skill_task_id as linkedSkillTaskId, task_last_completed_at as taskLastCompletedAt
`;

export type RawProgressRow = {
  id: number;
  projectId: number | null;
  goalId: number | null;
  category: ProgressCategory;
  shortDescription: string;
  description: string;
  difficulty: ProgressDifficulty;
  reason: string;
  instructions: string;
  imageData: string | null;
  isComplete: number;
  isRead: number;
  posX: number;
  posY: number;
  cost: number | null;
  completedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  webScale: number | null;
  favorite: number;
  glowAmount: number | null;
  glowColor: string | null;
  taskBoardStatus: "bank" | "board" | "archive" | null;
  taskIsStandalone: number;
  taskAddedAt: string | null;
  taskGoalDays: number | null;
  taskDueAt: string | null;
  taskCompletionImage: string | null;
  taskArchiveReason: string | null;
  taskMissedCount: number;
  linkedSkillTaskId: number | null;
  taskLastCompletedAt: string | null;
};

// The `category` column stores a comma-separated list now (a task can be
// multiple labor types at once) — legacy single-value rows parse the
// same way. Always yields at least one entry.
function parseCategories(raw: string): ProgressCategory[] {
  const list = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean) as ProgressCategory[];
  return list.length > 0 ? list : ["task"];
}

export function mapProgressRow(row: RawProgressRow): ProgressNode {
  const { category, ...rest } = row;
  return {
    ...rest,
    categories: parseCategories(category),
    imageData: row.imageData ?? undefined,
    isComplete: !!row.isComplete,
    isRead: !!row.isRead,
    createdAt: row.createdAt ?? undefined,
    updatedAt: row.updatedAt ?? undefined,
    favorite: !!row.favorite,
    taskIsStandalone: !!row.taskIsStandalone,
  };
}

export async function fetchProgressNodes(projectId: number): Promise<ProgressNode[]> {
  const db = await getDb();
  const rows = await db.select<RawProgressRow[]>(
    `SELECT ${PROGRESS_COLUMNS} FROM progress_nodes WHERE project_id = $1 ORDER BY id`,
    [projectId]
  );
  return rows.map(mapProgressRow);
}

// Tasks attached directly to a goal (no project layer) — see
// GoalWebPage.tsx, the "not every goal needs a project" case.
export async function fetchProgressNodesForGoal(goalId: number): Promise<ProgressNode[]> {
  const db = await getDb();
  const rows = await db.select<RawProgressRow[]>(
    `SELECT ${PROGRESS_COLUMNS} FROM progress_nodes WHERE goal_id = $1 ORDER BY id`,
    [goalId]
  );
  return rows.map(mapProgressRow);
}

// Every task belonging to any project linked to this goal, in one
// query — Goal Web needs this alongside the goal's own direct tasks to
// render its full merged canvas without one round trip per project.
export async function fetchProgressNodesForProjectsOfGoal(goalId: number): Promise<ProgressNode[]> {
  const db = await getDb();
  const rows = await db.select<RawProgressRow[]>(
    `SELECT ${PROGRESS_COLUMNS} FROM progress_nodes
     WHERE project_id IN (SELECT id FROM projects WHERE goal_id = $1) ORDER BY id`,
    [goalId]
  );
  return rows.map(mapProgressRow);
}

export async function fetchProgressNode(id: number): Promise<ProgressNode | null> {
  const db = await getDb();
  const rows = await db.select<RawProgressRow[]>(
    `SELECT ${PROGRESS_COLUMNS} FROM progress_nodes WHERE id = $1`,
    [id]
  );
  return rows[0] ? mapProgressRow(rows[0]) : null;
}

// New nodes start unread and incomplete, placed wherever the caller
// chose on the canvas when "+ Task" was clicked. Belongs to exactly one
// of owner.projectId/owner.goalId — see ProgressNode's dual-ownership
// comment in types/models.ts.
export async function addProgressNode(
  owner: { projectId: number } | { goalId: number },
  x: number,
  y: number
): Promise<number> {
  const db = await getDb();
  const projectId = "projectId" in owner ? owner.projectId : null;
  const goalId = "goalId" in owner ? owner.goalId : null;
  const result = await db.execute(
    `INSERT INTO progress_nodes (project_id, goal_id, short_description, pos_x, pos_y, created_at, updated_at)
     VALUES ($1, $2, 'New task', $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    [projectId, goalId, x, y]
  );
  return result.lastInsertId as number;
}

export async function deleteProgressNode(id: number): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM progress_nodes WHERE id = $1", [id]);
}

export async function updateProgressPosition(id: number, x: number, y: number): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE progress_nodes SET pos_x = $1, pos_y = $2 WHERE id = $3", [x, y, id]);
}

const FIELD_COLUMNS = {
  shortDescription: "short_description",
  description: "description",
  difficulty: "difficulty",
  reason: "reason",
  instructions: "instructions",
} as const;

type EditableField = keyof typeof FIELD_COLUMNS;

// Editing content marks the node unread again — read/unread means "seen
// since it last changed", not just "opened once ever".
export async function updateProgressField(
  id: number,
  field: EditableField,
  value: string
): Promise<void> {
  const db = await getDb();
  const column = FIELD_COLUMNS[field];
  await db.execute(
    `UPDATE progress_nodes SET ${column} = $1, is_read = 0, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
    [value, id]
  );
}

// A checklist toggle, not a single-select — always leaves at least one
// category checked (the UI itself refuses to uncheck the last one, see
// ProgressNodeDetailPage's handleToggleCategory).
export async function setProgressCategories(id: number, categories: ProgressCategory[]): Promise<void> {
  const db = await getDb();
  const value = categories.length > 0 ? categories.join(",") : "task";
  await db.execute(
    "UPDATE progress_nodes SET category = $1, is_read = 0, updated_at = CURRENT_TIMESTAMP WHERE id = $2",
    [value, id]
  );
}

export async function setProgressImage(id: number, imageData: string | null): Promise<void> {
  const db = await getDb();
  await db.execute(
    "UPDATE progress_nodes SET image_data = $1, is_read = 0, updated_at = CURRENT_TIMESTAMP WHERE id = $2",
    [imageData, id]
  );
}

export async function setProgressCost(id: number, cost: number | null): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE progress_nodes SET cost = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2", [
    cost,
    id,
  ]);
}

// Stamps completed_at when marking complete, clears it when un-marking —
// so "time to complete" (see ProgressNodeDetailPage's duration display)
// only ever reflects the most recent completion, same convention as
// is_read resetting on edit.
export async function setProgressComplete(id: number, isComplete: boolean): Promise<void> {
  const db = await getDb();
  await db.execute(
    `UPDATE progress_nodes SET is_complete = $1, completed_at = ${isComplete ? "CURRENT_TIMESTAMP" : "NULL"}, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
    [isComplete ? 1 : 0, id]
  );
}

// Called when the detail page loads — read/unread is a lightweight
// "have I looked at this since it last changed" signal, visible at a
// glance on the web, not a content edit (doesn't touch updated_at).
export async function markProgressRead(id: number): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE progress_nodes SET is_read = 1 WHERE id = $1", [id]);
}

// "Looks" section of the Goal Web's NodeFieldVisibilityPopover, task
// variant — same convention as updateProjectWebCardScale, on top of
// whatever size difficulty already gives the node.
export async function updateProgressWebScale(id: number, scale: number | null): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE progress_nodes SET web_scale = $1 WHERE id = $2", [scale, id]);
}

export async function updateProgressFavorite(id: number, favorite: boolean): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE progress_nodes SET favorite = $1 WHERE id = $2", [favorite ? 1 : 0, id]);
}

export async function updateProgressGlowAmount(id: number, amount: number | null): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE progress_nodes SET glow_amount = $1 WHERE id = $2", [amount, id]);
}

export async function updateProgressGlowColor(id: number, color: string | null): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE progress_nodes SET glow_color = $1 WHERE id = $2", [color, id]);
}
