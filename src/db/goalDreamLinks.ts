import { getDb } from "./database";

// A goal can attach to any number of dreams — each row here is one
// instance of that goal rendered on the Dream Web (see DreamWebPage.tsx),
// with its own drag position and attachment angle rather than sharing a
// single one across every attachment.
export interface GoalDreamLink {
  id: number;
  goalId: number;
  dreamId: number;
  attachAngle: number | null;
  posX: number | null;
}

const COLUMNS = `
  id, goal_id as goalId, dream_id as dreamId,
  attach_angle as attachAngle, pos_x as posX
`;

export async function fetchAllGoalDreamLinks(): Promise<GoalDreamLink[]> {
  const db = await getDb();
  return db.select<GoalDreamLink[]>(`SELECT ${COLUMNS} FROM goal_dream_links`);
}

// Dragging a fresh connection from a dream's boundary onto an
// already-rendered goal node (see DreamWebPage.tsx's onConnect) calls
// this. If that exact (goal, dream) pair isn't linked yet, it adds a
// brand new attachment — the goal then renders as one more node,
// clustered under this dream too. If the pair is already linked, this
// just repositions the existing attachment's angle instead of
// duplicating it.
export async function addOrUpdateGoalDreamLink(
  goalId: number,
  dreamId: number,
  attachAngle: number | null
): Promise<void> {
  const db = await getDb();
  const existing = await db.select<{ id: number }[]>(
    "SELECT id FROM goal_dream_links WHERE goal_id = $1 AND dream_id = $2",
    [goalId, dreamId]
  );
  if (existing[0]) {
    await db.execute("UPDATE goal_dream_links SET attach_angle = $1 WHERE id = $2", [attachAngle, existing[0].id]);
  } else {
    await db.execute(
      "INSERT INTO goal_dream_links (goal_id, dream_id, attach_angle) VALUES ($1, $2, $3)",
      [goalId, dreamId, attachAngle]
    );
  }
}

export async function removeGoalDreamLink(id: number): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM goal_dream_links WHERE id = $1", [id]);
}

export async function updateGoalDreamLinkPosX(id: number, x: number): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE goal_dream_links SET pos_x = $1 WHERE id = $2", [x, id]);
}

export async function updateGoalDreamLinkAngle(id: number, angle: number | null): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE goal_dream_links SET attach_angle = $1 WHERE id = $2", [angle, id]);
}
