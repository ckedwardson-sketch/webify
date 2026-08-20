import { getDb } from "./database";
import { THEME_SETTING_KEYS, ThemeSettings } from "../theme/themeDefaults";

export async function fetchThemeSettings(): Promise<Partial<ThemeSettings>> {
  const db = await getDb();
  const rows = await db.select<{ key: string; value: string }[]>(
    "SELECT key, value FROM theme_settings"
  );
  const result: Partial<ThemeSettings> = {};
  for (const row of rows) {
    if ((THEME_SETTING_KEYS as string[]).includes(row.key)) {
      (result as Record<string, string>)[row.key] = row.value;
    }
  }
  return result;
}

export async function setThemeSetting(
  key: keyof ThemeSettings,
  value: string
): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT INTO theme_settings (key, value) VALUES ($1, $2)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [key, value]
  );
}

export async function clearThemeSetting(key: keyof ThemeSettings): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM theme_settings WHERE key = $1", [key]);
}
