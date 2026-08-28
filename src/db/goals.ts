import { getDb } from "./database";
import { Goal, ProjectWidget, ProjectWidgetType } from "../types/project";
import { WIDGET_COLUMNS } from "./projects";

const GOAL_COLUMNS = `
  id, dream_id as dreamId, name, goals, reasoning, needs_doing as needsDoing,
  pos_x as posX, dream_attach_angle as dreamAttachAngle, is_passion_project as isPassionProject,
  estimated_start_date as estimatedStartDate,
  expected_date_start as expectedDateStart, expected_date_end as expectedDateEnd,
  sort_order as sortOrder, created_at as createdAt, updated_at as updatedAt
`;

type RawGoalRow = {
  id: number;
  dreamId: number | null;
  name: string;
  goals: string;
  reasoning: string;
  needsDoing: string;
  posX: number | null;
  dreamAttachAngle: number | null;
  isPassionProject: number;
  estimatedStartDate: string | null;
  expectedDateStart: string | null;
  expectedDateEnd: string | null;
  sortOrder: number;
  createdAt: string | null;
  updatedAt: string | null;
};

function mapGoalRow(row: RawGoalRow): Goal {
  return {
    ...row,
    isPassionProject: !!row.isPassionProject,
    estimatedStartDate: row.estimatedStartDate ?? undefined,
    expectedDateStart: row.expectedDateStart ?? undefined,
    expectedDateEnd: row.expectedDateEnd ?? undefined,
    createdAt: row.createdAt ?? undefined,
    updatedAt: row.updatedAt ?? undefined,
  };
}

// Goals proper — passion projects are excluded so GoalsHomePage doesn't
// need to filter itself.
export async function fetchAllGoals(): Promise<Goal[]> {
  const db = await getDb();
  const rows = await db.select<RawGoalRow[]>(
    `SELECT ${GOAL_COLUMNS} FROM goals WHERE is_passion_project = 0 ORDER BY sort_order`
  );
  return rows.map(mapGoalRow);
}

// See ProjectsHomePage.tsx — shown there instead of on the Goals page.
export async function fetchPassionProjects(): Promise<Goal[]> {
  const db = await getDb();
  const rows = await db.select<RawGoalRow[]>(
    `SELECT ${GOAL_COLUMNS} FROM goals WHERE is_passion_project = 1 ORDER BY sort_order`
  );
  return rows.map(mapGoalRow);
}

export async function fetchGoal(id: number): Promise<Goal | null> {
  const db = await getDb();
  const rows = await db.select<RawGoalRow[]>(`SELECT ${GOAL_COLUMNS} FROM goals WHERE id = $1`, [id]);
  return rows[0] ? mapGoalRow(rows[0]) : null;
}

// dreamId is optional — same as projects, a goal can just exist on its
// own, linked later or never.
export async function addGoal(dreamId: number | null, name: string): Promise<number> {
  const db = await getDb();
  const existing = await db.select<{ maxOrder: number | null }[]>(
    "SELECT MAX(sort_order) as maxOrder FROM goals WHERE dream_id IS $1",
    [dreamId]
  );
  const nextOrder = (existing[0].maxOrder ?? -1) + 1;
  const result = await db.execute(
    `INSERT INTO goals (dream_id, name, sort_order, created_at, updated_at)
     VALUES ($1, $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    [dreamId, name, nextOrder]
  );
  const id = result.lastInsertId as number;
  // Also seeds goal_dream_links (see database.ts) so the goal shows up
  // on the Dream Web immediately, same as before this table existed.
  if (dreamId !== null) {
    await db.execute("INSERT INTO goal_dream_links (goal_id, dream_id) VALUES ($1, $2)", [id, dreamId]);
  }
  return id;
}

// A passion project is a goal with is_passion_project = 1 and, unlike
// a regular goal, always starts with one Image Dock widget already on
// it — that's the "viewed the instant you click on projects" preview
// (see ProjectsHomePage.tsx), so it shouldn't require a separate "add
// a widget" step to exist.
export async function addPassionProject(name: string): Promise<number> {
  const db = await getDb();
  const existing = await db.select<{ maxOrder: number | null }[]>(
    "SELECT MAX(sort_order) as maxOrder FROM goals WHERE is_passion_project = 1"
  );
  const nextOrder = (existing[0].maxOrder ?? -1) + 1;
  const result = await db.execute(
    `INSERT INTO goals (dream_id, name, sort_order, is_passion_project, created_at, updated_at)
     VALUES (NULL, $1, $2, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    [name, nextOrder]
  );
  const id = result.lastInsertId as number;
  await addGoalWidget(id, "dock", "Image Dock");
  return id;
}

export async function updateGoalField(
  id: number,
  field: "name" | "goals" | "reasoning" | "needsDoing",
  value: string
): Promise<void> {
  const db = await getDb();
  const column = field === "needsDoing" ? "needs_doing" : field;
  await db.execute(
    `UPDATE goals SET ${column} = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
    [value, id]
  );
}

export async function updateGoalExpectedDate(
  id: number,
  start: string | null,
  end: string | null
): Promise<void> {
  const db = await getDb();
  await db.execute(
    "UPDATE goals SET expected_date_start = $1, expected_date_end = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3",
    [start, end, id]
  );
}

export async function updateGoalEstimatedStartDate(id: number, date: string | null): Promise<void> {
  const db = await getDb();
  await db.execute(
    "UPDATE goals SET estimated_start_date = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2",
    [date, id]
  );
}

export async function deleteGoal(id: number): Promise<void> {
  const db = await getDb();
  // See deleteProject's comment — field_layout/freetext_fields aren't
  // covered by goals' own cascades since owner_id isn't a real FK.
  await db.execute(
    "DELETE FROM freetext_fields WHERE id IN (SELECT ref_id FROM field_layout WHERE category = 'goal' AND owner_id = $1 AND field_type = 'freetext')",
    [id]
  );
  await db.execute("DELETE FROM field_layout WHERE category = 'goal' AND owner_id = $1", [id]);
  await db.execute("DELETE FROM goals WHERE id = $1", [id]);
}

// ---- Widgets ------------------------------------------------------------
// Same project_widgets table as projects (see database.ts's
// add_project_widgets_goal_id migration) — journal/board content tables
// key off widget_id alone, so fetchJournalEntries/addTextBoardItem/etc.
// from db/projects.ts work unchanged for a goal's widgets too.

export async function fetchWidgetsForGoal(goalId: number): Promise<ProjectWidget[]> {
  const db = await getDb();
  return db.select<ProjectWidget[]>(
    `SELECT ${WIDGET_COLUMNS} FROM project_widgets WHERE goal_id = $1 ORDER BY sort_order`,
    [goalId]
  );
}

export async function addGoalWidget(
  goalId: number,
  widgetType: ProjectWidgetType,
  title: string
): Promise<number> {
  const db = await getDb();
  const existing = await db.select<{ maxOrder: number | null }[]>(
    "SELECT MAX(sort_order) as maxOrder FROM project_widgets WHERE goal_id = $1",
    [goalId]
  );
  const nextOrder = (existing[0].maxOrder ?? -1) + 1;
  const result = await db.execute(
    "INSERT INTO project_widgets (goal_id, widget_type, title, sort_order) VALUES ($1, $2, $3, $4)",
    [goalId, widgetType, title, nextOrder]
  );
  return result.lastInsertId as number;
}
