import { getDb } from "./database";
import {
  Responsibility,
  ResponsibilityCategory,
  ResponsibilityCompletion,
  ResponsibilitySchedule,
  defaultScheduleFor,
  normalizeSchedule,
} from "../types/responsibility";

type RawRow = {
  id: number;
  name: string;
  description: string;
  consequences: string;
  reasoning: string;
  category: ResponsibilityCategory;
  icon: string;
  soundKey: string;
  scheduleJson: string;
  sortOrder: number;
  pendingLeadTimeHours: number;
  createdAt: string | null;
  updatedAt: string | null;
};

const COLUMNS = `
  id, name, description, consequences, reasoning, category, icon,
  sound_key as soundKey, schedule_json as scheduleJson,
  sort_order as sortOrder, pending_lead_time_hours as pendingLeadTimeHours,
  created_at as createdAt, updated_at as updatedAt
`;

function mapRow(row: RawRow, goalIds: number[]): Responsibility {
  let schedule: ResponsibilitySchedule;
  try {
    schedule = normalizeSchedule(row.category, JSON.parse(row.scheduleJson));
  } catch {
    console.warn(`Responsibility ${row.id} has unparseable schedule_json, using default.`);
    schedule = defaultScheduleFor(row.category);
  }
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    consequences: row.consequences,
    reasoning: row.reasoning,
    category: row.category,
    icon: row.icon,
    soundKey: row.soundKey,
    schedule,
    sortOrder: row.sortOrder,
    pendingLeadTimeHours: row.pendingLeadTimeHours ?? 0,
    goalIds,
    createdAt: row.createdAt ?? undefined,
    updatedAt: row.updatedAt ?? undefined,
  };
}

// Every (goal_id, responsibility_id) link in one query — cheaper than
// one query per responsibility. Callers group this by responsibility_id.
async function fetchAllLinks(): Promise<{ goalId: number; responsibilityId: number }[]> {
  const db = await getDb();
  return db.select<{ goalId: number; responsibilityId: number }[]>(
    "SELECT goal_id as goalId, responsibility_id as responsibilityId FROM goal_responsibility_links"
  );
}

function groupLinksByResponsibility(links: { goalId: number; responsibilityId: number }[]): Map<number, number[]> {
  const map = new Map<number, number[]>();
  for (const link of links) {
    const list = map.get(link.responsibilityId);
    if (list) list.push(link.goalId);
    else map.set(link.responsibilityId, [link.goalId]);
  }
  return map;
}

export async function fetchResponsibilities(
  category?: ResponsibilityCategory
): Promise<Responsibility[]> {
  const db = await getDb();
  const [rows, links] = await Promise.all([
    category
      ? db.select<RawRow[]>(
          `SELECT ${COLUMNS} FROM responsibilities WHERE category = $1 ORDER BY sort_order`,
          [category]
        )
      : db.select<RawRow[]>(`SELECT ${COLUMNS} FROM responsibilities ORDER BY sort_order`),
    fetchAllLinks(),
  ]);
  const byResp = groupLinksByResponsibility(links);
  return rows.map((row) => mapRow(row, byResp.get(row.id) ?? []));
}

export async function fetchResponsibility(id: number): Promise<Responsibility | null> {
  const db = await getDb();
  const [rows, links] = await Promise.all([
    db.select<RawRow[]>(`SELECT ${COLUMNS} FROM responsibilities WHERE id = $1`, [id]),
    db.select<{ goalId: number }[]>(
      "SELECT goal_id as goalId FROM goal_responsibility_links WHERE responsibility_id = $1",
      [id]
    ),
  ]);
  return rows[0] ? mapRow(rows[0], links.map((l) => l.goalId)) : null;
}

export async function addResponsibility(
  name: string,
  category: ResponsibilityCategory
): Promise<number> {
  const db = await getDb();
  const existing = await db.select<{ maxOrder: number | null }[]>(
    "SELECT MAX(sort_order) as maxOrder FROM responsibilities WHERE category = $1",
    [category]
  );
  const nextOrder = (existing[0].maxOrder ?? -1) + 1;
  const schedule = JSON.stringify(defaultScheduleFor(category));
  const result = await db.execute(
    `INSERT INTO responsibilities (name, category, schedule_json, sort_order, created_at, updated_at)
     VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    [name, category, schedule, nextOrder]
  );
  return result.lastInsertId as number;
}

export async function updateResponsibilityDetails(
  id: number,
  fields: { name?: string; description?: string; consequences?: string; reasoning?: string }
): Promise<void> {
  const db = await getDb();
  const sets: string[] = [];
  const params: unknown[] = [];
  let i = 1;
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined) continue;
    const column = key === "name" ? "name" : key; // description/consequences/reasoning match column names
    sets.push(`${column} = $${i}`);
    params.push(value);
    i++;
  }
  if (sets.length === 0) return;
  params.push(id);
  await db.execute(
    `UPDATE responsibilities SET ${sets.join(", ")}, updated_at = CURRENT_TIMESTAMP WHERE id = $${i}`,
    params
  );
}

export async function updateResponsibilitySchedule(
  id: number,
  schedule: ResponsibilitySchedule
): Promise<void> {
  const db = await getDb();
  await db.execute(
    "UPDATE responsibilities SET schedule_json = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2",
    [JSON.stringify(schedule), id]
  );
}

export async function updateResponsibilityIcon(id: number, icon: string): Promise<void> {
  const db = await getDb();
  await db.execute(
    "UPDATE responsibilities SET icon = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2",
    [icon, id]
  );
}

export async function updateResponsibilitySound(id: number, soundKey: string): Promise<void> {
  const db = await getDb();
  await db.execute(
    "UPDATE responsibilities SET sound_key = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2",
    [soundKey, id]
  );
}

export async function updateResponsibilityPendingLeadTime(id: number, hours: number): Promise<void> {
  const db = await getDb();
  await db.execute(
    "UPDATE responsibilities SET pending_lead_time_hours = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2",
    [hours, id]
  );
}

export async function linkResponsibilityToGoal(responsibilityId: number, goalId: number): Promise<void> {
  const db = await getDb();
  await db.execute(
    "INSERT OR IGNORE INTO goal_responsibility_links (goal_id, responsibility_id) VALUES ($1, $2)",
    [goalId, responsibilityId]
  );
}

export async function unlinkResponsibilityFromGoal(responsibilityId: number, goalId: number): Promise<void> {
  const db = await getDb();
  await db.execute(
    "DELETE FROM goal_responsibility_links WHERE goal_id = $1 AND responsibility_id = $2",
    [goalId, responsibilityId]
  );
}

// Backs Goal Web's list of responsibilities already linked to this goal.
export async function fetchResponsibilitiesForGoal(goalId: number): Promise<Responsibility[]> {
  const db = await getDb();
  const [rows, links] = await Promise.all([
    db.select<RawRow[]>(
      `SELECT ${COLUMNS} FROM responsibilities
       WHERE id IN (SELECT responsibility_id FROM goal_responsibility_links WHERE goal_id = $1)
       ORDER BY sort_order`,
      [goalId]
    ),
    fetchAllLinks(),
  ]);
  const byResp = groupLinksByResponsibility(links);
  return rows.map((row) => mapRow(row, byResp.get(row.id) ?? []));
}

export async function deleteResponsibility(id: number): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM responsibility_completions WHERE responsibility_id = $1", [id]);
  await db.execute("DELETE FROM responsibilities WHERE id = $1", [id]);
}

// ---- Completions ----------------------------------------------------

export async function fetchAllCompletions(): Promise<ResponsibilityCompletion[]> {
  const db = await getDb();
  const rows = await db.select<
    { id: number; responsibilityId: number; occurrenceDate: string; completedAt: string }[]
  >(
    `SELECT id, responsibility_id as responsibilityId, occurrence_date as occurrenceDate,
            completed_at as completedAt
     FROM responsibility_completions`
  );
  return rows;
}

// Backs the responsibility detail page's History tab — see item 11.
export async function fetchCompletionsForResponsibility(
  responsibilityId: number
): Promise<ResponsibilityCompletion[]> {
  const db = await getDb();
  return db.select<ResponsibilityCompletion[]>(
    `SELECT id, responsibility_id as responsibilityId, occurrence_date as occurrenceDate,
            completed_at as completedAt
     FROM responsibility_completions
     WHERE responsibility_id = $1
     ORDER BY occurrence_date DESC`,
    [responsibilityId]
  );
}

export async function markComplete(responsibilityId: number, occurrenceDate: string): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT OR IGNORE INTO responsibility_completions (responsibility_id, occurrence_date, completed_at)
     VALUES ($1, $2, CURRENT_TIMESTAMP)`,
    [responsibilityId, occurrenceDate]
  );
}

export async function unmarkComplete(responsibilityId: number, occurrenceDate: string): Promise<void> {
  const db = await getDb();
  await db.execute(
    "DELETE FROM responsibility_completions WHERE responsibility_id = $1 AND occurrence_date = $2",
    [responsibilityId, occurrenceDate]
  );
}

// Clears every completion within a date range for one responsibility —
// used to "uncheck" a weekly/yearly task regardless of which exact day
// within its current period it was originally marked done on.
export async function unmarkCompletionsInRange(
  responsibilityId: number,
  startDate: string,
  endDate: string
): Promise<void> {
  const db = await getDb();
  await db.execute(
    "DELETE FROM responsibility_completions WHERE responsibility_id = $1 AND occurrence_date >= $2 AND occurrence_date <= $3",
    [responsibilityId, startDate, endDate]
  );
}
