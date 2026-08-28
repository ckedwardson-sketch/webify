import { getDb } from "./database";
import { CustomSliderDef, CustomSliderState } from "../theme/customSliders";

type RawRow = {
  id: string;
  label: string;
  css_var: string;
  min_value: number;
  max_value: number;
  step_value: number;
  default_value: number;
  value: number;
  unit: string;
  description: string;
};

function mapRow(row: RawRow): CustomSliderState {
  return {
    id: row.id,
    label: row.label,
    cssVar: row.css_var,
    min: row.min_value,
    max: row.max_value,
    step: row.step_value,
    default: row.default_value,
    value: row.value,
    unit: row.unit,
    description: row.description || undefined,
  };
}

export async function fetchCustomSliders(): Promise<CustomSliderState[]> {
  const db = await getDb();
  const rows = await db.select<RawRow[]>(
    "SELECT * FROM theme_custom_sliders ORDER BY sort_order, id"
  );
  return rows.map(mapRow);
}

// Full replace, same convention as replaceTheme/applyThemeExport — a
// newly imported/applied theme's slider set entirely supersedes
// whatever custom sliders were defined before, rather than merging.
// Each slider starts at its authored default value.
export async function replaceCustomSliders(defs: CustomSliderDef[]): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM theme_custom_sliders");
  for (let i = 0; i < defs.length; i++) {
    const d = defs[i];
    await db.execute(
      `INSERT INTO theme_custom_sliders
        (id, label, css_var, min_value, max_value, step_value, default_value, value, unit, description, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [d.id, d.label, d.cssVar, d.min, d.max, d.step, d.default, d.default, d.unit, d.description ?? "", i]
    );
  }
}

// Live user adjustment — updates only the current value, leaving the
// slider's definition (label/range/default) untouched.
export async function setCustomSliderValue(id: string, value: number): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE theme_custom_sliders SET value = $1 WHERE id = $2", [value, id]);
}

export async function clearCustomSliders(): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM theme_custom_sliders");
}
