import { getDb } from "./database";

export interface TextElementOverride {
  text?: string;
  size?: number;
  color?: string;
}

type RawRow = { element_key: string; text: string | null; size: number | null; color: string | null };

export async function fetchTextElementOverrides(): Promise<Record<string, TextElementOverride>> {
  const db = await getDb();
  const rows = await db.select<RawRow[]>(
    "SELECT element_key, text, size, color FROM text_element_overrides"
  );
  const map: Record<string, TextElementOverride> = {};
  for (const row of rows) {
    map[row.element_key] = {
      text: row.text ?? undefined,
      size: row.size ?? undefined,
      color: row.color ?? undefined,
    };
  }
  return map;
}

export async function setTextElementOverride(
  key: string,
  override: TextElementOverride
): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT INTO text_element_overrides (element_key, text, size, color)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT(element_key) DO UPDATE SET
       text = excluded.text,
       size = excluded.size,
       color = excluded.color`,
    [key, override.text ?? null, override.size ?? null, override.color ?? null]
  );
}

export async function clearTextElementOverride(key: string): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM text_element_overrides WHERE element_key = $1", [key]);
}
