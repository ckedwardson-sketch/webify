import { getDb } from "./database";

// Global settings governing every Tiptap editor in the app (Recipe,
// Notes, and any future one) — which tool-access surfaces are on, and
// how input mode is detected. Kept in its own KV table rather than
// theme_settings: these aren't theme concepts and shouldn't be swept
// into theme export/import/presets.
export interface EditorToolSettings {
  toolbarEnabled: boolean;
  contextMenuEnabled: boolean;
  bubbleMenuEnabled: boolean;
  slashCommandEnabled: boolean;
  inputMode: "auto" | "mouse" | "touch";
}

export const EDITOR_SETTINGS_DEFAULTS: EditorToolSettings = {
  toolbarEnabled: true,
  contextMenuEnabled: true,
  bubbleMenuEnabled: true,
  slashCommandEnabled: true,
  inputMode: "auto",
};

const BOOLEAN_KEYS: (keyof EditorToolSettings)[] = [
  "toolbarEnabled",
  "contextMenuEnabled",
  "bubbleMenuEnabled",
  "slashCommandEnabled",
];

export async function fetchEditorSettings(): Promise<EditorToolSettings> {
  const db = await getDb();
  const rows = await db.select<{ key: string; value: string }[]>("SELECT key, value FROM editor_settings");
  const result: EditorToolSettings = { ...EDITOR_SETTINGS_DEFAULTS };
  for (const row of rows) {
    if ((BOOLEAN_KEYS as string[]).includes(row.key)) {
      (result as unknown as Record<string, boolean>)[row.key] = row.value === "true";
    } else if (row.key === "inputMode" && (row.value === "auto" || row.value === "mouse" || row.value === "touch")) {
      result.inputMode = row.value;
    }
  }
  return result;
}

export async function setEditorSetting<K extends keyof EditorToolSettings>(
  key: K,
  value: EditorToolSettings[K]
): Promise<void> {
  const db = await getDb();
  const stored = typeof value === "boolean" ? String(value) : (value as string);
  await db.execute(
    `INSERT INTO editor_settings (key, value) VALUES ($1, $2)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [key, stored]
  );
}
