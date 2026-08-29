import { getDb } from "./database";
import { Dream, DreamHistoryEntry, DreamHistoryField, DreamLink, DreamPriority } from "../types/models";
import { recordEntityHistory, deleteEntityHistoryFor } from "./entityHistory";

type RawDreamRow = {
  id: number;
  name: string;
  reasoning: string;
  expectedDateStart: string | null;
  expectedDateEnd: string | null;
  priority: string;
  notes: string;
  posX: number;
  posY: number;
  isAsleep: number;
  sleepUntil: string | null;
  estimatedStartDate: string | null;
  createdAt: string;
  updatedAt: string;
};

function mapDreamRow(row: RawDreamRow): Dream {
  return {
    ...row,
    expectedDateStart: row.expectedDateStart ?? undefined,
    expectedDateEnd: row.expectedDateEnd ?? undefined,
    priority: (row.priority as DreamPriority) || "medium",
    isAsleep: !!row.isAsleep,
    sleepUntil: row.sleepUntil ?? undefined,
    estimatedStartDate: row.estimatedStartDate ?? undefined,
  };
}

const DREAM_COLUMNS = `
  id,
  name,
  reasoning,
  expected_date_start as expectedDateStart,
  expected_date_end as expectedDateEnd,
  priority,
  notes,
  pos_x as posX,
  pos_y as posY,
  is_asleep as isAsleep,
  sleep_until as sleepUntil,
  estimated_start_date as estimatedStartDate,
  created_at as createdAt,
  updated_at as updatedAt
`;

export interface DreamGraphData {
  dreams: Dream[];
  links: DreamLink[];
}

export async function fetchDreamGraphData(): Promise<DreamGraphData> {
  const db = await getDb();
  const rawDreams = await db.select<RawDreamRow[]>(`SELECT ${DREAM_COLUMNS} FROM dreams ORDER BY id`);
  const links = await db.select<DreamLink[]>(
    `SELECT id, source_dream_id as sourceDreamId, target_dream_id as targetDreamId,
            source_angle as sourceAngle, target_angle as targetAngle
     FROM dream_links`
  );
  return { dreams: rawDreams.map(mapDreamRow), links };
}

export async function fetchDream(id: number): Promise<Dream | null> {
  const db = await getDb();
  const rows = await db.select<RawDreamRow[]>(`SELECT ${DREAM_COLUMNS} FROM dreams WHERE id = $1`, [id]);
  return rows[0] ? mapDreamRow(rows[0]) : null;
}

// New dreams start undated (no expected_date_start/end) — placed near
// wherever the user was looking (caller passes y), and shown in the
// web's "undated" lane until a date is set.
export async function addDream(name: string, x: number, y: number): Promise<number> {
  const db = await getDb();
  const result = await db.execute(
    `INSERT INTO dreams (name, pos_x, pos_y, created_at, updated_at)
     VALUES ($1, $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    [name, x, y]
  );
  return result.lastInsertId as number;
}

export async function deleteDream(id: number): Promise<void> {
  const db = await getDb();
  // field_layout.owner_id can't be a real FK (it means a project, goal,
  // or dream id depending on category) — clean up by hand, same as
  // deleteProject/deleteGoal do.
  await db.execute(
    "DELETE FROM freetext_fields WHERE id IN (SELECT ref_id FROM field_layout WHERE category = 'dream' AND owner_id = $1 AND field_type = 'freetext')",
    [id]
  );
  await db.execute("DELETE FROM field_layout WHERE category = 'dream' AND owner_id = $1", [id]);
  await deleteEntityHistoryFor("dream", id);
  await db.execute("DELETE FROM dreams WHERE id = $1", [id]);
}

// The portable "Estimated start date" field (see fieldLayout.ts) — a
// Dream doesn't have this by default (it only ever had the expected
// date *range*), but can add it the same way a Project/Goal can add a
// Memory field. Deliberately not logged to dream_history/entity_history
// with the ceremony updateDreamField gives simple fields — it's a new,
// optional field, not part of the dream's original tracked shape.
export async function updateDreamEstimatedStartDate(id: number, date: string | null): Promise<void> {
  const db = await getDb();
  await db.execute(
    "UPDATE dreams SET estimated_start_date = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2",
    [date, id]
  );
}

// Canvas X is the only freely-dragged coordinate for a dated dream (Y
// follows the dream's date, future up/past down) — this is deliberately
// not logged to dream_history, it's layout, not content.
export async function updateDreamPositionX(id: number, x: number): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE dreams SET pos_x = $1 WHERE id = $2", [x, id]);
}

// Undated dreams sit in a fixed lane but can still be dragged within it
// (both x and y are free until a date pins the x).
export async function updateDreamPosition(id: number, x: number, y: number): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE dreams SET pos_x = $1, pos_y = $2 WHERE id = $3", [x, y, id]);
}

export function formatDateRange(start?: string | null, end?: string | null): string {
  if (!start && !end) return "No date set";
  if (start === end) return start ?? "";
  return `${start ?? "?"} → ${end ?? "?"}`;
}

const SIMPLE_FIELD_COLUMNS: Partial<Record<DreamHistoryField, string>> = {
  name: "name",
  reasoning: "reasoning",
  priority: "priority",
  notes: "notes",
};

// The one place simple dream content actually changes (expected date
// has its own function below, since it's two columns at once). Before
// writing the new value, the current value — plus the reason the user
// gave for the change — is appended to dream_history. That's the "deep
// memory": past reasoning/priority/etc stay visible, with the why,
// even after being edited away.
export async function updateDreamField(
  id: number,
  field: Exclude<DreamHistoryField, "expectedDate" | "sleep">,
  value: string,
  reason: string | null
): Promise<void> {
  const db = await getDb();
  const column = SIMPLE_FIELD_COLUMNS[field]!;
  const current = await db.select<Record<string, string | null>[]>(
    `SELECT ${column} as value FROM dreams WHERE id = $1`,
    [id]
  );
  const oldValue = current[0]?.value ?? null;
  const newValue = value || null;
  if (oldValue === newValue) return;

  await db.execute(
    `INSERT INTO dream_history (dream_id, field, old_value, new_value, reason) VALUES ($1, $2, $3, $4, $5)`,
    [id, field, oldValue, newValue, reason]
  );
  await db.execute(
    `UPDATE dreams SET ${column} = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
    [newValue, id]
  );
  // Additive: also logs to the generalized entity_history table (see
  // db/entityHistory.ts) — dream_history above remains the source for
  // the dream's own built-in Memory field; this is what a second,
  // portable Memory field added to a Dream (see fieldLayout.ts) reads.
  await recordEntityHistory("dream", id, field, oldValue, newValue, reason);
}

// start/end are both null for "no date set". A single exact day is
// start === end; a month or year is modeled as that whole span.
export async function updateDreamExpectedDate(
  id: number,
  start: string | null,
  end: string | null,
  reason: string | null
): Promise<void> {
  const db = await getDb();
  const current = await db.select<{ start: string | null; end: string | null }[]>(
    `SELECT expected_date_start as start, expected_date_end as end FROM dreams WHERE id = $1`,
    [id]
  );
  const oldStart = current[0]?.start ?? null;
  const oldEnd = current[0]?.end ?? null;
  if (oldStart === start && oldEnd === end) return;

  await db.execute(
    `INSERT INTO dream_history (dream_id, field, old_value, new_value, reason) VALUES ($1, 'expectedDate', $2, $3, $4)`,
    [id, formatDateRange(oldStart, oldEnd), formatDateRange(start, end), reason]
  );
  await db.execute(
    `UPDATE dreams SET expected_date_start = $1, expected_date_end = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3`,
    [start, end, id]
  );
  await recordEntityHistory("dream", id, "expectedDate", formatDateRange(oldStart, oldEnd), formatDateRange(start, end), reason);
}

// Parks a dream off the timeline instead of deleting it. Logged to
// history automatically (the duration prompt already captures the
// "why" — no separate reason prompt needed on top of it).
export async function putDreamToBed(id: number, sleepUntil: string): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT INTO dream_history (dream_id, field, old_value, new_value, reason) VALUES ($1, 'sleep', 'awake', $2, NULL)`,
    [id, `asleep until ${sleepUntil}`]
  );
  await db.execute(
    `UPDATE dreams SET is_asleep = 1, sleep_until = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
    [sleepUntil, id]
  );
}

export async function wakeDream(id: number): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT INTO dream_history (dream_id, field, old_value, new_value, reason) VALUES ($1, 'sleep', 'asleep', 'awake', NULL)`,
    [id]
  );
  await db.execute(
    `UPDATE dreams SET is_asleep = 0, sleep_until = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
    [id]
  );
}

export async function fetchDreamHistory(dreamId: number): Promise<DreamHistoryEntry[]> {
  const db = await getDb();
  return db.select<DreamHistoryEntry[]>(
    `SELECT id, dream_id as dreamId, field, old_value as oldValue, new_value as newValue, reason, changed_at as changedAt
     FROM dream_history WHERE dream_id = $1 ORDER BY changed_at DESC, id DESC`,
    [dreamId]
  );
}

// sourceAngle/targetAngle are the rotational anchor points the link was
// dragged from/to (see DreamLink's comment) — omitted (left null) when
// a link is created some other way than dragging between two boundary
// handles, e.g. a future non-visual link-creation path.
export async function addDreamLink(
  sourceDreamId: number,
  targetDreamId: number,
  sourceAngle: number | null = null,
  targetAngle: number | null = null
): Promise<void> {
  if (sourceDreamId === targetDreamId) return;
  const db = await getDb();
  await db.execute(
    `INSERT INTO dream_links (source_dream_id, target_dream_id, source_angle, target_angle)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT(source_dream_id, target_dream_id) DO UPDATE SET source_angle = excluded.source_angle, target_angle = excluded.target_angle`,
    [sourceDreamId, targetDreamId, sourceAngle, targetAngle]
  );
}

export async function removeDreamLink(id: number): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM dream_links WHERE id = $1", [id]);
}

export interface LinkedDream {
  linkId: number;
  dream: Dream;
}

// Links are stored directed (source -> target) since that's how the
// connection was drawn, but they're not meaningfully directional to the
// user — a dream page shows everything it's connected to either way.
export async function fetchLinkedDreams(dreamId: number): Promise<LinkedDream[]> {
  const db = await getDb();
  const rows = await db.select<(RawDreamRow & { linkId: number })[]>(
    `SELECT
       dl.id as linkId,
       d.id, d.name, d.reasoning, d.expected_date_start as expectedDateStart, d.expected_date_end as expectedDateEnd,
       d.priority, d.notes, d.pos_x as posX, d.pos_y as posY, d.is_asleep as isAsleep, d.sleep_until as sleepUntil,
       d.created_at as createdAt, d.updated_at as updatedAt
     FROM dream_links dl
     JOIN dreams d ON d.id = CASE WHEN dl.source_dream_id = $1 THEN dl.target_dream_id ELSE dl.source_dream_id END
     WHERE dl.source_dream_id = $1 OR dl.target_dream_id = $1`,
    [dreamId]
  );
  return rows.map((row) => ({ linkId: row.linkId, dream: mapDreamRow(row) }));
}

// Loosely parses things like "6 months", "2 years", "3 weeks" into a
// target ISO date from today. Returns null if it can't make sense of it.
// Shared by DreamDetailPage's "put to bed" menu action — colocated here
// with putDreamToBed rather than in a page file, since both belong to
// the same feature.
export function parseSleepDuration(input: string): string | null {
  const match = input.trim().match(/^(\d+)\s*(day|week|month|year)s?$/i);
  if (!match) return null;
  const n = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();
  const d = new Date();
  if (unit === "day") d.setDate(d.getDate() + n);
  else if (unit === "week") d.setDate(d.getDate() + n * 7);
  else if (unit === "month") d.setMonth(d.getMonth() + n);
  else if (unit === "year") d.setFullYear(d.getFullYear() + n);
  return d.toISOString().slice(0, 10);
}
