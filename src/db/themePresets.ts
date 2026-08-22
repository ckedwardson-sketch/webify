import { getDb } from "./database";

export interface ThemePresetRow {
  id: number;
  name: string;
  createdAt: string;
}

export async function fetchPresets(): Promise<ThemePresetRow[]> {
  const db = await getDb();
  return db.select<ThemePresetRow[]>(
    "SELECT id, name, created_at as createdAt FROM theme_presets ORDER BY created_at DESC"
  );
}

export async function fetchPresetData(id: number): Promise<string | null> {
  const db = await getDb();
  const rows = await db.select<{ data: string }[]>(
    "SELECT data FROM theme_presets WHERE id = $1",
    [id]
  );
  return rows[0]?.data ?? null;
}

// INSERT ... ON CONFLICT so saving under an existing name overwrites it
// (re-capturing the same preset) rather than erroring.
export async function savePreset(name: string, data: string): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT INTO theme_presets (name, data) VALUES ($1, $2)
     ON CONFLICT(name) DO UPDATE SET data = excluded.data, created_at = CURRENT_TIMESTAMP`,
    [name, data]
  );
}

export async function deletePreset(id: number): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM theme_presets WHERE id = $1", [id]);
}
