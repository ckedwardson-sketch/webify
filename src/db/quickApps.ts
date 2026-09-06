import { getDb } from "./database";

export async function fetchQuickAppTitle(appKey: string, fallback: string): Promise<string> {
  const db = await getDb();
  const rows = await db.select<{ title: string }[]>(
    `SELECT title FROM quick_app_titles WHERE app_key = $1`,
    [appKey]
  );
  return rows.length ? rows[0].title : fallback;
}

export async function setQuickAppTitle(appKey: string, title: string, fallback: string): Promise<void> {
  const db = await getDb();
  const trimmed = title.trim() || fallback;
  await db.execute(
    `INSERT INTO quick_app_titles (app_key, title) VALUES ($1, $2)
     ON CONFLICT(app_key) DO UPDATE SET title = excluded.title`,
    [appKey, trimmed]
  );
}
