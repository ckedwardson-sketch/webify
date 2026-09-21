import { getDb } from "./database";

// Generic key/value UI-preference store — backs several unrelated,
// small pieces of session/navigation state (sidebar open, dual-pane
// default, notes-tree expand memory, dream WebFullView) rather than one
// grouped settings object like editor_settings/theme_settings. Any
// string key/value pair may be stored; callers own their own key
// naming and value encoding (e.g. "1"/"0" for booleans, JSON for
// structured blobs like the notes-tree expand-state).

export async function fetchUiPreferences(): Promise<Record<string, string>> {
  const db = await getDb();
  const rows = await db.select<{ key: string; value: string }[]>(
    "SELECT key, value FROM ui_preferences"
  );
  const result: Record<string, string> = {};
  for (const row of rows) {
    result[row.key] = row.value;
  }
  return result;
}

export async function setUiPreference(key: string, value: string): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT INTO ui_preferences (key, value) VALUES ($1, $2) ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [key, value]
  );
}