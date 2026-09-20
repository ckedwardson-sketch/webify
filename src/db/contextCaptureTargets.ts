import { getDb } from "./database";

export async function fetchContextCaptureSelection(): Promise<string[]> {
  const db = await getDb();
  const rows = await db.select<{ target_key: string }[]>(
    "SELECT target_key FROM context_capture_targets"
  );
  return rows.map((r) => r.target_key);
}

export async function setContextCaptureTargetSelected(key: string, selected: boolean): Promise<void> {
  const db = await getDb();
  if (selected) {
    await db.execute("INSERT OR IGNORE INTO context_capture_targets (target_key) VALUES ($1)", [key]);
  } else {
    await db.execute("DELETE FROM context_capture_targets WHERE target_key = $1", [key]);
  }
}
