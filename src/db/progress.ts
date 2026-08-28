import { getDb } from "./database";
import { ProgressCategory, ProgressDifficulty, ProgressNode } from "../types/models";

const PROGRESS_COLUMNS = `
  id, project_id as projectId, goal_id as goalId, category, short_description as shortDescription, description,
  difficulty, reason, instructions, image_data as imageData,
  is_complete as isComplete, is_read as isRead,
  pos_x as posX, pos_y as posY, created_at as createdAt, updated_at as updatedAt
`;

type RawProgressRow = {
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
  createdAt: string | null;
  updatedAt: string | null;
};

function mapRow(row: RawProgressRow): ProgressNode {
  return {
    ...row,
    imageData: row.imageData ?? undefined,
    isComplete: !!row.isComplete,
    isRead: !!row.isRead,
    createdAt: row.createdAt ?? undefined,
    updatedAt: row.updatedAt ?? undefined,
  };
}

export async function fetchProgressNodes(projectId: number): Promise<ProgressNode[]> {
  const db = await getDb();
  const rows = await db.select<RawProgressRow[]>(
    `SELECT ${PROGRESS_COLUMNS} FROM progress_nodes WHERE project_id = $1 ORDER BY id`,
    [projectId]
  );
  return rows.map(mapRow);
}

// Tasks attached directly to a goal (no project layer) — see
// GoalWebPage.tsx, the "not every goal needs a project" case.
export async function fetchProgressNodesForGoal(goalId: number): Promise<ProgressNode[]> {
  const db = await getDb();
  const rows = await db.select<RawProgressRow[]>(
    `SELECT ${PROGRESS_COLUMNS} FROM progress_nodes WHERE goal_id = $1 ORDER BY id`,
    [goalId]
  );
  return rows.map(mapRow);
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
  return rows.map(mapRow);
}

export async function fetchProgressNode(id: number): Promise<ProgressNode | null> {
  const db = await getDb();
  const rows = await db.select<RawProgressRow[]>(
    `SELECT ${PROGRESS_COLUMNS} FROM progress_nodes WHERE id = $1`,
    [id]
  );
  return rows[0] ? mapRow(rows[0]) : null;
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
  category: "category",
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

export async function setProgressImage(id: number, imageData: string | null): Promise<void> {
  const db = await getDb();
  await db.execute(
    "UPDATE progress_nodes SET image_data = $1, is_read = 0, updated_at = CURRENT_TIMESTAMP WHERE id = $2",
    [imageData, id]
  );
}

export async function setProgressComplete(id: number, isComplete: boolean): Promise<void> {
  const db = await getDb();
  await db.execute(
    "UPDATE progress_nodes SET is_complete = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2",
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
