import { getDb } from "./database";
import {
  Project,
  ProjectWidget,
  ProjectWidgetType,
  ProjectJournalEntry,
  ProjectBoardItem,
} from "../types/project";
import { fetchTable, saveTable } from "./tables";
import { fetchPhotoSettings, savePhotoSettings, fetchPhotos, addPhoto } from "./photos";
import { fetchDockImages, addDockImage } from "./dockImages";

const PROJECT_COLUMNS = `
  id, dream_id as dreamId, goal_id as goalId, name, goals, reasoning, needs_doing as needsDoing,
  estimated_start_date as estimatedStartDate,
  expected_date_start as expectedDateStart, expected_date_end as expectedDateEnd,
  sort_order as sortOrder, created_at as createdAt, updated_at as updatedAt
`;

type RawProjectRow = {
  id: number;
  dreamId: number | null;
  goalId: number | null;
  name: string;
  goals: string;
  reasoning: string;
  needsDoing: string;
  estimatedStartDate: string | null;
  expectedDateStart: string | null;
  expectedDateEnd: string | null;
  sortOrder: number;
  createdAt: string | null;
  updatedAt: string | null;
};

function mapProjectRow(row: RawProjectRow): Project {
  return {
    ...row,
    estimatedStartDate: row.estimatedStartDate ?? undefined,
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

// Backs the Goal Web (GoalWebPage) — every project linked to a goal
// auto-populates there as a node.
export async function fetchProjectsForGoal(goalId: number): Promise<Project[]> {
  const db = await getDb();
  const rows = await db.select<RawProjectRow[]>(
    `SELECT ${PROJECT_COLUMNS} FROM projects WHERE goal_id = $1 ORDER BY sort_order`,
    [goalId]
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

// dreamId is optional — a project can just exist on its own, linked
// later or never. "IS $1" (not "=") since SQL equality never matches
// NULL, and dreamId is frequently NULL now.
export async function addProject(dreamId: number | null, name: string): Promise<number> {
  const db = await getDb();
  const existing = await db.select<{ maxOrder: number | null }[]>(
    "SELECT MAX(sort_order) as maxOrder FROM projects WHERE dream_id IS $1",
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

export async function updateProjectEstimatedStartDate(id: number, date: string | null): Promise<void> {
  const db = await getDb();
  await db.execute(
    "UPDATE projects SET estimated_start_date = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2",
    [date, id]
  );
}

// "IS $1" (not "=") — same reasoning as addProject's dreamId lookup:
// SQL equality never matches NULL, and goalId (unassigning a project
// from a goal) is a real, common value here.
export async function updateProjectGoalId(id: number, goalId: number | null): Promise<void> {
  const db = await getDb();
  await db.execute(
    "UPDATE projects SET goal_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2",
    [goalId, id]
  );
}

export async function deleteProject(id: number): Promise<void> {
  const db = await getDb();
  // field_layout.owner_id can't be a real FK (it means either a project
  // or a goal id depending on category), so it isn't covered by
  // projects' ON DELETE CASCADE the way project_widgets is — clean up
  // by hand, same as freetext_fields it may reference.
  await db.execute(
    "DELETE FROM freetext_fields WHERE id IN (SELECT ref_id FROM field_layout WHERE category = 'project' AND owner_id = $1 AND field_type = 'freetext')",
    [id]
  );
  await db.execute("DELETE FROM field_layout WHERE category = 'project' AND owner_id = $1", [id]);
  await db.execute("DELETE FROM projects WHERE id = $1", [id]);
}

// ---- Widgets ----------------------------------------------------------

// Exported so db/goals.ts's goal-scoped widget functions can select the
// same shape — a widget belongs to exactly one of project_id/goal_id,
// but both owners read it identically.
export const WIDGET_COLUMNS = `
  id, project_id as projectId, goal_id as goalId, widget_type as widgetType, title,
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

// Rearrange mode's drag-reorder (see components/RearrangeToolbar.tsx) —
// takes the widget ids in their new order and just writes 0..N-1 as
// sort_order, same "whole-list rewrite" approach used for board items'
// insert-order rather than a shuffle-in-place algorithm.
export async function updateWidgetOrder(orderedIds: number[]): Promise<void> {
  const db = await getDb();
  for (let i = 0; i < orderedIds.length; i++) {
    await db.execute("UPDATE project_widgets SET sort_order = $1 WHERE id = $2", [i, orderedIds[i]]);
  }
}

// Rearrange mode's "Duplicate field" — clones the widget row and its
// content. Content-cloning is type-specific but all funnel through
// each type's own fetch/add functions rather than raw SQL here, so
// this stays correct if any of those tables' shapes ever change.
export async function duplicateWidget(id: number): Promise<number | null> {
  const original = await fetchWidget(id);
  if (!original) return null;
  const db = await getDb();

  const ownerColumn = original.projectId !== null ? "project_id" : "goal_id";
  const ownerValue = original.projectId !== null ? original.projectId : original.goalId;
  const existing = await db.select<{ maxOrder: number | null }[]>(
    `SELECT MAX(sort_order) as maxOrder FROM project_widgets WHERE ${ownerColumn} = $1`,
    [ownerValue]
  );
  const nextOrder = (existing[0].maxOrder ?? -1) + 1;

  const result = await db.execute(
    "INSERT INTO project_widgets (project_id, goal_id, widget_type, title, sort_order) VALUES ($1, $2, $3, $4, $5)",
    [original.projectId, original.goalId, original.widgetType, `${original.title} (copy)`, nextOrder]
  );
  const newId = result.lastInsertId as number;

  switch (original.widgetType) {
    case "journal": {
      const entries = await fetchJournalEntries(id);
      for (const e of entries) await addJournalEntry(newId, e.content);
      break;
    }
    case "linkboard": {
      const items = await fetchBoardItems(id);
      for (const it of items) {
        if (it.itemType === "text" && it.textContent) await addTextBoardItem(newId, it.textContent);
        else if (it.itemType === "link" && it.linkHref) await addLinkBoardItem(newId, it.linkHref, it.linkLabel ?? "");
        else if (it.itemType === "image" && it.imageData) await addImageBoardItem(newId, it.imageData);
      }
      break;
    }
    case "table": {
      const data = await fetchTable(id);
      await saveTable(newId, data);
      break;
    }
    case "photo": {
      const settings = await fetchPhotoSettings(id);
      await savePhotoSettings(newId, settings);
      const photos = await fetchPhotos(id);
      for (const p of photos) {
        await addPhoto(newId, p.imageData, p.caption ?? null, p.latitude ?? null, p.longitude ?? null);
      }
      break;
    }
    case "dock": {
      const images = await fetchDockImages(id);
      for (const img of images) await addDockImage(newId, img.imageData);
      break;
    }
  }

  return newId;
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
