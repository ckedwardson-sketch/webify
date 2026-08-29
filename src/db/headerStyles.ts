import { getDb } from "./database";

export interface HeaderStyleOverride {
  text?: string;
  size?: number;
  color?: string;
  bold?: boolean;
  underline?: boolean;
}

type RawRow = { header_key: string; text: string | null; size: number | null; color: string | null; bold: number | null; underline: number | null };

export async function fetchHeaderStyleOverrides(): Promise<Record<string, HeaderStyleOverride>> {
  const db = await getDb();
  const rows = await db.select<RawRow[]>("SELECT header_key, text, size, color, bold, underline FROM header_style_overrides");
  const map: Record<string, HeaderStyleOverride> = {};
  for (const row of rows) {
    map[row.header_key] = {
      text: row.text ?? undefined,
      size: row.size ?? undefined,
      color: row.color ?? undefined,
      bold: row.bold == null ? undefined : !!row.bold,
      underline: row.underline == null ? undefined : !!row.underline,
    };
  }
  return map;
}

export async function setHeaderStyleOverride(key: string, override: HeaderStyleOverride): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT INTO header_style_overrides (header_key, text, size, color, bold, underline)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT(header_key) DO UPDATE SET
       text = excluded.text,
       size = excluded.size,
       color = excluded.color,
       bold = excluded.bold,
       underline = excluded.underline`,
    [
      key,
      override.text ?? null,
      override.size ?? null,
      override.color ?? null,
      override.bold === undefined ? null : override.bold ? 1 : 0,
      override.underline === undefined ? null : override.underline ? 1 : 0,
    ]
  );
}

export async function clearHeaderStyleOverride(key: string): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM header_style_overrides WHERE header_key = $1", [key]);
}
