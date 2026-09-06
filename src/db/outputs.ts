import { getDb } from "./database";

// A record of something actually produced by a Task — an artifact, not
// another task. Content is a TipTap HTML blob, same shape as a Note's
// (see db/notes.ts), so the two can share NoteContentEditor. Unlimited
// per task. displayVariant picks how the card renders on a Web (see
// components/OutputWebNode.tsx) — purely presentational, never affects
// the stored content itself.
export type OutputDisplayVariant = "card" | "image-grid" | "file-list";

export interface Output {
  id: number;
  taskId: number;
  title: string;
  icon: string | null;
  content: string;
  displayVariant: OutputDisplayVariant;
  sortOrder: number;
  posX: number | null;
  posY: number | null;
  createdAt: string;
  updatedAt: string;
}

const OUTPUT_COLUMNS = `
  id, task_id as taskId, title, icon, content,
  display_variant as displayVariant, sort_order as sortOrder,
  pos_x as posX, pos_y as posY, created_at as createdAt, updated_at as updatedAt
`;

export async function fetchOutputsForTask(taskId: number): Promise<Output[]> {
  const db = await getDb();
  return db.select<Output[]>(`SELECT ${OUTPUT_COLUMNS} FROM outputs WHERE task_id = $1 ORDER BY sort_order`, [
    taskId,
  ]);
}

// Batch variant for a Web canvas that shows outputs for many tasks at
// once (Goal Web / Passion Project Web) — one query instead of N.
export async function fetchOutputsForTasks(taskIds: number[]): Promise<Output[]> {
  if (taskIds.length === 0) return [];
  const db = await getDb();
  const placeholders = taskIds.map((_, i) => `$${i + 1}`).join(", ");
  return db.select<Output[]>(
    `SELECT ${OUTPUT_COLUMNS} FROM outputs WHERE task_id IN (${placeholders}) ORDER BY sort_order`,
    taskIds
  );
}

export async function fetchOutput(id: number): Promise<Output | null> {
  const db = await getDb();
  const rows = await db.select<Output[]>(`SELECT ${OUTPUT_COLUMNS} FROM outputs WHERE id = $1`, [id]);
  return rows[0] ?? null;
}

export async function addOutput(taskId: number, title = "New output", x: number | null = null, y: number | null = null): Promise<number> {
  const db = await getDb();
  const existing = await db.select<{ maxOrder: number | null }[]>(
    "SELECT MAX(sort_order) as maxOrder FROM outputs WHERE task_id = $1",
    [taskId]
  );
  const nextOrder = (existing[0].maxOrder ?? -1) + 1;
  const result = await db.execute(
    `INSERT INTO outputs (task_id, title, content, sort_order, pos_x, pos_y, created_at, updated_at)
     VALUES ($1, $2, '<p></p>', $3, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    [taskId, title, nextOrder, x, y]
  );
  return result.lastInsertId as number;
}

export async function updateOutputTitle(id: number, title: string): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE outputs SET title = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2", [title, id]);
}

export async function updateOutputContent(id: number, content: string): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE outputs SET content = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2", [content, id]);
}

export async function updateOutputIcon(id: number, icon: string | null): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE outputs SET icon = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2", [icon, id]);
}

export async function updateOutputDisplayVariant(id: number, variant: OutputDisplayVariant): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE outputs SET display_variant = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2", [
    variant,
    id,
  ]);
}

export async function updateOutputPosition(id: number, x: number, y: number): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE outputs SET pos_x = $1, pos_y = $2 WHERE id = $3", [x, y, id]);
}

export async function deleteOutput(id: number): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM outputs WHERE id = $1", [id]);
}
