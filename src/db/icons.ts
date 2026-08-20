import { getDb } from "./database";

export async function fetchIconOverrides(): Promise<Record<string, string>> {
  const db = await getDb();
  const rows = await db.select<{ icon_key: string; image_data: string }[]>(
    "SELECT icon_key, image_data FROM icon_overrides"
  );
  const map: Record<string, string> = {};
  for (const row of rows) map[row.icon_key] = row.image_data;
  return map;
}

export async function setIconOverride(key: string, imageData: string): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT INTO icon_overrides (icon_key, image_data) VALUES ($1, $2)
     ON CONFLICT(icon_key) DO UPDATE SET image_data = excluded.image_data`,
    [key, imageData]
  );
}

export async function clearIconOverride(key: string): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM icon_overrides WHERE icon_key = $1", [key]);
}
