import { getDb } from "./database";
import {
  Project,
  ProjectWidget,
  ProjectWidgetType,
  ProjectJournalEntry,
  ProjectBoardItem,
} from "../types/project";

const PROJECT_COLUMNS = `
  id, dream_id as dreamId, name, goals, reasoning, needs_doing as needsDoing,
  expected_date_start as expectedDateStart, expected_date_end as expectedDateEnd,
  sort_order as sortOrder, created_at as createdAt, updated_at as updatedAt
`;

type RawProjectRow = {
  id: number;
  dreamId: number;
  name: string;
  goals: string;
  reasoning: string;
  needsDoing: string;
  expectedDateStart: string | null;
  expectedDateEnd: string | null;
  sortOrder: number;
  createdAt: string | null;
  updatedAt: string | null;
};

function mapProjectRow(row: RawProjectRow): Project {
  return {
    ...row,
    expectedDateStart: row.expectedDateStart ?? undefined,
    expectedDateEnd: row.expectedDateEnd ?? undefined,
    createdAt: row.createdAt ?? undefined,
    updatedAt: row.updatedAt ?? undefined,
  };
}

export async function fetchAllProjects(): Promise<Project[]> {
  const db = await getDb();
  const rows = await db.select<RawProjectRow[]>(
    `SELECT ${PROJECT_COLUMNS} FROM projects ORDER BY sort_order`
  );
  return rows.map(mapProjectRow);
}

export async function fetchProjectsForDream(dreamId: number): Promise<Project[]> {
  const db = await getDb();
  const rows = await db.select<RawProjectRow[]>(
    `SELECT ${PROJECT_COLUMNS} FROM projects WHERE dream_id = $1 ORDER BY sort_order`,
    [dreamId]
  );
  return rows.map(mapProjectRow);
}

export async function fetchProject(id: number): Promise<Project | null> {
  const db = await getDb();
  const rows = await db.select<RawProjectRow[]>(
    `SELECT ${PROJECT_COLUMNS} FROM projects WHERE id = $1`,
    [id]
  );
  return rows[0] ? mapProjectRow(rows[0]) : null;
}

export async function addProject(dreamId: number, name: string): Promise<number> {
  const db = await getDb();
  const existing = await db.select<{ maxOrder: number | null }[]>(
    "SELECT MAX(sort_order) as maxOrder FROM projects WHERE dream_id = $1",
    [dreamId]
  );
  const nextOrder = (existing[0].maxOrder ?? -1) + 1;
  const result = await db.execute(
    `INSERT INTO projects (dream_id, name, sort_order, created_at, updated_at)
     VALUES ($1, $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    [dreamId, name, nextOrder]
  );
  return result.lastInsertId as number;
}

export async function updateProjectField(
  id: number,
  field: "name" | "goals" | "reasoning" | "needsDoing",
  value: string
): Promise<void> {
  const db = await getDb();
  const column = field === "needsDoing" ? "needs_doing" : field;
  await db.execute(
    `UPDATE projects SET ${column} = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
    [value, id]
  );
}

export async function updateProjectExpectedDate(
  id: number,
  start: string | null,
  end: string | null
): Promise<void> {
  const db = await getDb();
  await db.execute(
    "UPDATE projects SET expected_date_start = $1, expected_date_end = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3",
    [start, end, id]
  );
}

export async function deleteProject(id: number): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM projects WHERE id = $1", [id]);
}

// ---- Widgets ----------------------------------------------------------

const WIDGET_COLUMNS = `
  id, project_id as projectId, widget_type as widgetType, title,
  sort_order as sortOrder, created_at as createdAt
`;

export async function fetchWidgetsForProject(projectId: number): Promise<ProjectWidget[]> {
  const db = await getDb();
  return db.select<ProjectWidget[]>(
    `SELECT ${WIDGET_COLUMNS} FROM project_widgets WHERE project_id = $1 ORDER BY sort_order`,
    [projectId]
  );
}

export async function fetchWidget(id: number): Promise<ProjectWidget | null> {
  const db = await getDb();
  const rows = await db.select<ProjectWidget[]>(
    `SELECT ${WIDGET_COLUMNS} FROM project_widgets WHERE id = $1`,
    [id]
  );
  return rows[0] ?? null;
}

export async function addWidget(
  projectId: number,
  widgetType: ProjectWidgetType,
  title: string
): Promise<number> {
  const db = await getDb();
  const existing = await db.select<{ maxOrder: number | null }[]>(
    "SELECT MAX(sort_order) as maxOrder FROM project_widgets WHERE project_id = $1",
    [projectId]
  );
  const nextOrder = (existing[0].maxOrder ?? -1) + 1;
  const result = await db.execute(
    "INSERT INTO project_widgets (project_id, widget_type, title, sort_order) VALUES ($1, $2, $3, $4)",
    [projectId, widgetType, title, nextOrder]
  );
  return result.lastInsertId as number;
}

export async function deleteWidget(id: number): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM project_widgets WHERE id = $1", [id]);
}

// ---- Journal ------------------------------------------------------------

export async function fetchJournalEntries(widgetId: number): Promise<ProjectJournalEntry[]> {
  const db = await getDb();
  return db.select<ProjectJournalEntry[]>(
    `SELECT id, widget_id as widgetId, content, created_at as createdAt
     FROM project_journal_entries WHERE widget_id = $1 ORDER BY created_at DESC, id DESC`,
    [widgetId]
  );
}

export async function addJournalEntry(widgetId: number, content: string): Promise<void> {
  const db = await getDb();
  await db.execute(
    "INSERT INTO project_journal_entries (widget_id, content) VALUES ($1, $2)",
    [widgetId, content]
  );
}

export async function updateJournalEntry(id: number, content: string): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE project_journal_entries SET content = $1 WHERE id = $2", [content, id]);
}

export async function deleteJournalEntry(id: number): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM project_journal_entries WHERE id = $1", [id]);
}

// ---- Link / image board -------------------------------------------------

export async function fetchBoardItems(widgetId: number): Promise<ProjectBoardItem[]> {
  const db = await getDb();
  return db.select<ProjectBoardItem[]>(
    `SELECT id, widget_id as widgetId, item_type as itemType, text_content as textContent,
            link_href as linkHref, link_label as linkLabel, image_data as imageData,
            sort_order as sortOrder, created_at as createdAt
     FROM project_board_items WHERE widget_id = $1 ORDER BY sort_order`,
    [widgetId]
  );
}

async function nextBoardOrder(widgetId: number): Promise<number> {
  const db = await getDb();
  const existing = await db.select<{ maxOrder: number | null }[]>(
    "SELECT MAX(sort_order) as maxOrder FROM project_board_items WHERE widget_id = $1",
    [widgetId]
  );
  return (existing[0].maxOrder ?? -1) + 1;
}

export async function addTextBoardItem(widgetId: number, text: string): Promise<void> {
  const db = await getDb();
  const order = await nextBoardOrder(widgetId);
  await db.execute(
    "INSERT INTO project_board_items (widget_id, item_type, text_content, sort_order) VALUES ($1, 'text', $2, $3)",
    [widgetId, text, order]
  );
}

export async function addLinkBoardItem(widgetId: number, href: string, label: string): Promise<void> {
  const db = await getDb();
  const order = await nextBoardOrder(widgetId);
  await db.execute(
    "INSERT INTO project_board_items (widget_id, item_type, link_href, link_label, sort_order) VALUES ($1, 'link', $2, $3, $4)",
    [widgetId, href, label, order]
  );
}

export async function addImageBoardItem(widgetId: number, imageData: string): Promise<void> {
  const db = await getDb();
  const order = await nextBoardOrder(widgetId);
  await db.execute(
    "INSERT INTO project_board_items (widget_id, item_type, image_data, sort_order) VALUES ($1, 'image', $2, $3)",
    [widgetId, imageData, order]
  );
}

export async function deleteBoardItem(id: number): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM project_board_items WHERE id = $1", [id]);
}
