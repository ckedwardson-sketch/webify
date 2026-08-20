import { getDb } from "./database";

export interface ButtonStyleOverride {
  text?: string;
  fontFamily?: string;
  fontSize?: number;
  textColor?: string;
  backgroundColor?: string;
  borderColor?: string;
  paddingX?: number;
  paddingY?: number;
  borderRadius?: number;
}

type RawRow = {
  button_key: string;
  text: string | null;
  font_family: string | null;
  font_size: number | null;
  text_color: string | null;
  background_color: string | null;
  border_color: string | null;
  padding_x: number | null;
  padding_y: number | null;
  border_radius: number | null;
};

export async function fetchButtonStyleOverrides(): Promise<Record<string, ButtonStyleOverride>> {
  const db = await getDb();
  const rows = await db.select<RawRow[]>(
    `SELECT button_key, text, font_family, font_size, text_color,
            background_color, border_color, padding_x, padding_y, border_radius
     FROM button_style_overrides`
  );
  const map: Record<string, ButtonStyleOverride> = {};
  for (const row of rows) {
    map[row.button_key] = {
      text: row.text ?? undefined,
      fontFamily: row.font_family ?? undefined,
      fontSize: row.font_size ?? undefined,
      textColor: row.text_color ?? undefined,
      backgroundColor: row.background_color ?? undefined,
      borderColor: row.border_color ?? undefined,
      paddingX: row.padding_x ?? undefined,
      paddingY: row.padding_y ?? undefined,
      borderRadius: row.border_radius ?? undefined,
    };
  }
  return map;
}

export async function setButtonStyleOverride(
  key: string,
  override: ButtonStyleOverride
): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT INTO button_style_overrides
       (button_key, text, font_family, font_size, text_color, background_color, border_color, padding_x, padding_y, border_radius)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     ON CONFLICT(button_key) DO UPDATE SET
       text = excluded.text,
       font_family = excluded.font_family,
       font_size = excluded.font_size,
       text_color = excluded.text_color,
       background_color = excluded.background_color,
       border_color = excluded.border_color,
       padding_x = excluded.padding_x,
       padding_y = excluded.padding_y,
       border_radius = excluded.border_radius`,
    [
      key,
      override.text ?? null,
      override.fontFamily ?? null,
      override.fontSize ?? null,
      override.textColor ?? null,
      override.backgroundColor ?? null,
      override.borderColor ?? null,
      override.paddingX ?? null,
      override.paddingY ?? null,
      override.borderRadius ?? null,
    ]
  );
}

export async function clearButtonStyleOverride(key: string): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM button_style_overrides WHERE button_key = $1", [key]);
}
