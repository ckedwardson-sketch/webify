import { getDb } from "./database";
import { CostEntry } from "../types/project";

export async function fetchCostEntries(widgetId: number): Promise<CostEntry[]> {
  const db = await getDb();
  return db.select<CostEntry[]>(
    `SELECT id, widget_id as widgetId, amount, description, created_at as createdAt
     FROM cost_log_entries WHERE widget_id = $1 ORDER BY created_at DESC, id DESC`,
    [widgetId]
  );
}

export async function addCostEntry(widgetId: number, amount: number, description: string): Promise<number> {
  const db = await getDb();
  const result = await db.execute(
    "INSERT INTO cost_log_entries (widget_id, amount, description) VALUES ($1, $2, $3)",
    [widgetId, amount, description]
  );
  return result.lastInsertId as number;
}

export async function deleteCostEntry(id: number): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM cost_log_entries WHERE id = $1", [id]);
}
