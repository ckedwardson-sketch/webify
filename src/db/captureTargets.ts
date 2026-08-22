import { getDb } from "./database";

export async function fetchCaptureSelection(): Promise<string[]> {
  const db = await getDb();
  const rows = await db.select<{ target_key: string }[]>(
    "SELECT target_key FROM capture_targets"
  );
  return rows.map((r) => r.target_key);
}

export async function setCaptureTargetSelected(key: string, selected: boolean): Promise<void> {
  const db = await getDb();
  if (selected) {
    await db.execute("INSERT OR IGNORE INTO capture_targets (target_key) VALUES ($1)", [key]);
  } else {
    await db.execute("DELETE FROM capture_targets WHERE target_key = $1", [key]);
  }
}
