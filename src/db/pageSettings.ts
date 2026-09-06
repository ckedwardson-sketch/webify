import { getDb } from "./database";

// Generic per-page-type settings store — see database.ts's
// create_page_settings_table for why this is scoped by (scopeKey,
// settingKey) instead of living in the flat theme_settings table.
export async function fetchPageSetting(scopeKey: string, settingKey: string): Promise<string | null> {
  const db = await getDb();
  const rows = await db.select<{ value: string }[]>(
    "SELECT value FROM page_settings WHERE scope_key = $1 AND setting_key = $2",
    [scopeKey, settingKey]
  );
  return rows[0]?.value ?? null;
}

export async function setPageSetting(scopeKey: string, settingKey: string, value: string): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT INTO page_settings (scope_key, setting_key, value)
     VALUES ($1, $2, $3)
     ON CONFLICT(scope_key, setting_key) DO UPDATE SET value = excluded.value`,
    [scopeKey, settingKey, value]
  );
}

export async function clearPageSetting(scopeKey: string, settingKey: string): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM page_settings WHERE scope_key = $1 AND setting_key = $2", [
    scopeKey,
    settingKey,
  ]);
}
