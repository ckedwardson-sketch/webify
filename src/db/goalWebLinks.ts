// src/db/goalWebLinks.ts
import { getDb } from "./database";

// A link a user draws directly between two nodes on one goal's Goal
// Web. sourceNodeId/targetNodeId reuse GoalWebPage's existing per-node
// id scheme ("goal-end", "pr-<id>", "tk-<id>", "rs-<id>") — plain text,
// not a typed FK pair, since those ids already uniquely identify a node
// within one goal's web. sourceAngle/targetAngle mirror DreamLink's own
// angle fields — null until a real connection gesture sets them (the
// same "undefined defaults to pointing at the other end" fallback
// GoalWebPage/DreamWebPage apply when rendering).
export interface GoalWebLink {
  id: number;
  goalId: number;
  sourceNodeId: string;
  targetNodeId: string;
  sourceAngle: number | null;
  targetAngle: number | null;
}

const COLUMNS = `id, goal_id as goalId, source_node_id as sourceNodeId, target_node_id as targetNodeId, source_angle as sourceAngle, target_angle as targetAngle`;

export async function fetchGoalWebLinks(goalId: number): Promise<GoalWebLink[]> {
  const db = await getDb();
  return db.select<GoalWebLink[]>(`SELECT ${COLUMNS} FROM goal_web_links WHERE goal_id = $1`, [goalId]);
}

// Batch variant for DreamWebPage's "full" view, which needs every
// visible goal's links at once rather than one query per goal.
export async function fetchGoalWebLinksForGoals(goalIds: number[]): Promise<GoalWebLink[]> {
  if (goalIds.length === 0) return [];
  const db = await getDb();
  const placeholders = goalIds.map((_, i) => `$${i + 1}`).join(", ");
  return db.select<GoalWebLink[]>(
    `SELECT ${COLUMNS} FROM goal_web_links WHERE goal_id IN (${placeholders})`,
    goalIds
  );
}

export async function addGoalWebLink(
  goalId: number,
  sourceNodeId: string,
  targetNodeId: string,
  sourceAngle: number | null,
  targetAngle: number | null
): Promise<number> {
  const db = await getDb();
  const result = await db.execute(
    "INSERT INTO goal_web_links (goal_id, source_node_id, target_node_id, source_angle, target_angle) VALUES ($1, $2, $3, $4, $5)",
    [goalId, sourceNodeId, targetNodeId, sourceAngle, targetAngle]
  );
  return result.lastInsertId as number;
}

export async function removeGoalWebLink(id: number): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM goal_web_links WHERE id = $1", [id]);
}
