import { getDb } from "../db/database";
import { blankTaskLine, newLineId } from "./checklistLogic";
import {
  ArchiveDateFormat,
  ArchivedItem,
  ChecklistLine,
  ChecklistList,
  ChecklistSettings,
  ChecklistState,
  TRUNCATE_OFF,
} from "./checklistTypes";

// Two JSON blobs in the existing ui_preferences key/value table, the
// same trick lockscreen/lockScreenSettings.ts uses: no schema change,
// and both travel with the database when it syncs. Everything coming
// back out is normalized below, so a half-written, hand-edited or
// older blob can't produce a checklist the editor chokes on.

const STATE_KEY = "checklist.state";
const SETTINGS_KEY = "checklist.settings";

export const CHECKLIST_SETTINGS_DEFAULTS: ChecklistSettings = {
  textSize: 17,
  truncateChars: TRUNCATE_OFF,
  truncateOnBreak: true,
  archiveMode: false,
  showDate: true,
  dateFormat: "short-time",
  multiList: false,
};

const DATE_FORMATS: ArchiveDateFormat[] = [
  "numeric",
  "numeric-hour",
  "numeric-time",
  "short",
  "short-hour",
  "short-time",
  "short-year",
  "short-year-time",
  "weekday-time",
  "iso",
];

// ---- Shared little validators ----------------------------------------

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function clamp(value: unknown, lo: number, hi: number, fallback: number): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(hi, Math.max(lo, Math.round(n)));
}

function str(value: unknown, fallback: string): string {
  return typeof value === "string" ? value : fallback;
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

// ---- Settings ---------------------------------------------------------

export function normalizeChecklistSettings(raw: unknown): ChecklistSettings {
  const r = record(raw);
  const d = CHECKLIST_SETTINGS_DEFAULTS;
  const format = str(r.dateFormat, d.dateFormat) as ArchiveDateFormat;
  return {
    textSize: clamp(r.textSize, 12, 40, d.textSize),
    truncateChars: clamp(r.truncateChars, 10, TRUNCATE_OFF, d.truncateChars),
    truncateOnBreak: bool(r.truncateOnBreak, d.truncateOnBreak),
    archiveMode: bool(r.archiveMode, d.archiveMode),
    showDate: bool(r.showDate, d.showDate),
    dateFormat: DATE_FORMATS.includes(format) ? format : d.dateFormat,
    multiList: bool(r.multiList, d.multiList),
  };
}

export async function fetchChecklistSettings(): Promise<ChecklistSettings> {
  const db = await getDb();
  const rows = await db.select<{ value: string }[]>(
    "SELECT value FROM ui_preferences WHERE key = $1",
    [SETTINGS_KEY]
  );
  if (!rows[0]) return { ...CHECKLIST_SETTINGS_DEFAULTS };
  try {
    return normalizeChecklistSettings(JSON.parse(rows[0].value));
  } catch {
    return { ...CHECKLIST_SETTINGS_DEFAULTS };
  }
}

export async function saveChecklistSettings(settings: ChecklistSettings): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT INTO ui_preferences (key, value) VALUES ($1, $2)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [SETTINGS_KEY, JSON.stringify(normalizeChecklistSettings(settings))]
  );
}

// ---- State ------------------------------------------------------------

export function defaultChecklistList(name = "List 1"): ChecklistList {
  return { id: newLineId(), name, lines: [blankTaskLine()], archive: [] };
}

export function defaultChecklistState(): ChecklistState {
  const list = defaultChecklistList();
  return { lists: [list], activeListId: list.id };
}

function normalizeLine(raw: unknown): ChecklistLine {
  const r = record(raw);
  const checkbox = bool(r.checkbox, true);
  const checked = checkbox && bool(r.checked, false);
  const checkedAt = typeof r.checkedAt === "number" && Number.isFinite(r.checkedAt) ? r.checkedAt : undefined;
  return {
    id: str(r.id, "") || newLineId(),
    text: str(r.text, ""),
    checkbox,
    checked,
    checkedAt: checked ? checkedAt : undefined,
  };
}

function normalizeArchivedItem(raw: unknown): ArchivedItem | null {
  const r = record(raw);
  const text = str(r.text, "");
  if (text.trim() === "") return null;
  return {
    id: str(r.id, "") || newLineId(),
    text,
    checkedAt: typeof r.checkedAt === "number" && Number.isFinite(r.checkedAt) ? r.checkedAt : 0,
  };
}

function normalizeList(raw: unknown, index: number): ChecklistList {
  const r = record(raw);
  const lines = Array.isArray(r.lines) ? r.lines.map(normalizeLine) : [];
  const archive = Array.isArray(r.archive)
    ? r.archive.map(normalizeArchivedItem).filter((x): x is ArchivedItem => x !== null)
    : [];
  return {
    id: str(r.id, "") || newLineId(),
    name: str(r.name, "").trim() || `List ${index + 1}`,
    lines: lines.length > 0 ? lines : [blankTaskLine()],
    archive,
  };
}

export function normalizeChecklistState(raw: unknown): ChecklistState {
  const r = record(raw);
  const lists = Array.isArray(r.lists) ? r.lists.map(normalizeList) : [];
  if (lists.length === 0) return defaultChecklistState();
  // Ids have to be unique — the editor keys rows off them and the page
  // finds the active list by id.
  const seen = new Set<string>();
  for (const list of lists) {
    while (seen.has(list.id)) list.id = newLineId();
    seen.add(list.id);
  }
  const activeListId = str(r.activeListId, "");
  return {
    lists,
    activeListId: lists.some((l) => l.id === activeListId) ? activeListId : lists[0].id,
  };
}

export async function fetchChecklistState(): Promise<ChecklistState> {
  const db = await getDb();
  const rows = await db.select<{ value: string }[]>(
    "SELECT value FROM ui_preferences WHERE key = $1",
    [STATE_KEY]
  );
  if (!rows[0]) return defaultChecklistState();
  try {
    return normalizeChecklistState(JSON.parse(rows[0].value));
  } catch {
    return defaultChecklistState();
  }
}

export async function saveChecklistState(state: ChecklistState): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT INTO ui_preferences (key, value) VALUES ($1, $2)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [STATE_KEY, JSON.stringify(state)]
  );
}
