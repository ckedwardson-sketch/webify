import { getDb } from "./database";

export interface GoalWebBookmark {
  id: number;
  goalId: number;
  label: string;
  x: number;
  y: number;
  zoom: number;
  sortOrder: number;
  createdAt: string;
}

const COLUMNS = `
  id, goal_id as goalId, label, x, y, zoom, sort_order as sortOrder, created_at as createdAt
`;

// Named viewport snapshots within one goal's web — see
// database.ts's create_goal_web_bookmarks_table migration and
// GoalWebPage.tsx. This is the "instead of a separate screen per
// project, save a zoom and jump back to it" mechanism.
export async function fetchBookmarksForGoal(goalId: number): Promise<GoalWebBookmark[]> {
  const db = await getDb();
  return db.select<GoalWebBookmark[]>(
    `SELECT ${COLUMNS} FROM goal_web_bookmarks WHERE goal_id = $1 ORDER BY sort_order, id`,
    [goalId]
  );
}

export async function addBookmark(
  goalId: number,
  label: string,
  x: number,
  y: number,
  zoom: number
): Promise<number> {
  const db = await getDb();
  const existing = await db.select<{ maxOrder: number | null }[]>(
    "SELECT MAX(sort_order) as maxOrder FROM goal_web_bookmarks WHERE goal_id = $1",
    [goalId]
  );
  const nextOrder = (existing[0].maxOrder ?? -1) + 1;
  const result = await db.execute(
    "INSERT INTO goal_web_bookmarks (goal_id, label, x, y, zoom, sort_order) VALUES ($1, $2, $3, $4, $5, $6)",
    [goalId, label, x, y, zoom, nextOrder]
  );
  return result.lastInsertId as number;
}

export async function deleteBookmark(id: number): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM goal_web_bookmarks WHERE id = $1", [id]);
}
