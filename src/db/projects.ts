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
import { fetchCostEntries, addCostEntry } from "./costLog";
import { recordEntityHistory, deleteEntityHistoryFor } from "./entityHistory";

const PROJECT_COLUMNS = `
  id, dream_id as dreamId, goal_id as goalId, name, goals, reasoning, needs_doing as needsDoing,
  estimated_start_date as estimatedStartDate,
  expected_date_start as expectedDateStart, expected_date_end as expectedDateEnd,
  web_pos_x as webPosX, web_pos_y as webPosY,
  sort_order as sortOrder, created_at as createdAt, updated_at as updatedAt, image_data as imageData,
  web_card_scale as webCardScale, web_card_color as webCardColor
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
  webPosX: number | null;
  webPosY: number | null;
  sortOrder: number;
  createdAt: string | null;
  updatedAt: string | null;
  imageData: string | null;
  webCardScale: number | null;
  webCardColor: string | null;
};

function mapProjectRow(row: RawProjectRow): Project {
  return {
    ...row,
    estimatedStartDate: row.estimatedStartDate ?? undefined,
    expectedDateStart: row.expectedDateStart ?? undefined,
    expectedDateEnd: row.expectedDateEnd ?? undefined,
    createdAt: row.createdAt ?? undefined,
    updatedAt: row.updatedAt ?? undefined,
    imageData: row.imageData ?? undefined,
  };
}

// "Looks" section of the Goal Web's NodeFieldVisibilityPopover.
export async function updateProjectWebCardScale(id: number, scale: number | null): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE projects SET web_card_scale = $1 WHERE id = $2", [scale, id]);
}

export async function updateProjectWebCardColor(id: number, color: string | null): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE projects SET web_card_color = $1 WHERE id = $2", [color, id]);
}

export async function updateProjectImage(id: number, imageData: string): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE projects SET image_data = $1 WHERE id = $2", [imageData, id]);
}

// A project card's dragged offset from its automatic grid slot on its
// goal's web (see webGraph/goalCluster.ts) — null/unset = sits exactly
// at the grid slot, same "offset from base" convention progress nodes
// already use for their own drag position.
export async function updateProjectWebPosition(id: number, x: number, y: number): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE projects SET web_pos_x = $1, web_pos_y = $2 WHERE id = $3", [x, y, id]);
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

const PROJECT_FIELD_LABELS: Record<"name" | "goals" | "reasoning" | "needsDoing", string> = {
  name: "Name",
  goals: "Goals",
  reasoning: "Reasoning",
  needsDoing: "What needs doing",
};

// Logs to entity_history alongside the write (see db/entityHistory.ts) —
// silent, no reason prompt, matching how most of Dream's own fields
// already behave. This is what gives a Project's portable Memory field
// (if added — see fieldLayout.ts's FieldType) real content.
export async function updateProjectField(
  id: number,
  field: "name" | "goals" | "reasoning" | "needsDoing",
  value: string
): Promise<void> {
  const db = await getDb();
  const column = field === "needsDoing" ? "needs_doing" : field;
  const current = await db.select<Record<string, string>[]>(`SELECT ${column} as value FROM projects WHERE id = $1`, [id]);
  const oldValue = current[0]?.value ?? "";
  await db.execute(
    `UPDATE projects SET ${column} = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
    [value, id]
  );
  await recordEntityHistory("project", id, PROJECT_FIELD_LABELS[field], oldValue, value);
}

function formatDateRangeForHistory(start: string | null, end: string | null): string {
  if (!start && !end) return "No date set";
  if (start === end) return start ?? "";
  return `${start ?? "?"} → ${end ?? "?"}`;
}

export async function updateProjectExpectedDate(
  id: number,
  start: string | null,
  end: string | null
): Promise<void> {
  const db = await getDb();
  const current = await db.select<{ start: string | null; end: string | null }[]>(
    "SELECT expected_date_start as start, expected_date_end as end FROM projects WHERE id = $1",
    [id]
  );
  await db.execute(
    "UPDATE projects SET expected_date_start = $1, expected_date_end = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3",
    [start, end, id]
  );
  await recordEntityHistory(
    "project",
    id,
    "When it should be done",
    formatDateRangeForHistory(current[0]?.start ?? null, current[0]?.end ?? null),
    formatDateRangeForHistory(start, end)
  );
}

export async function updateProjectEstimatedStartDate(id: number, date: string | null): Promise<void> {
  const db = await getDb();
  const current = await db.select<{ value: string | null }[]>(
    "SELECT estimated_start_date as value FROM projects WHERE id = $1",
    [id]
  );
  await db.execute(
    "UPDATE projects SET estimated_start_date = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2",
    [date, id]
  );
  await recordEntityHistory("project", id, "Estimated start date", current[0]?.value ?? null, date);
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
  await deleteEntityHistoryFor("project", id);
  await db.execute("DELETE FROM projects WHERE id = $1", [id]);
}

// ---- Widgets ----------------------------------------------------------

// Exported so db/goals.ts's goal-scoped widget functions can select the
// same shape — a widget belongs to exactly one of project_id/goal_id,
// but both owners read it identically.
export const WIDGET_COLUMNS = `
  id, project_id as projectId, goal_id as goalId, widget_type as widgetType, title,
  sort_order as sortOrder, created_at as createdAt,
  web_type as webType, web_owner_id as webOwnerId,
  pos_x as posX, pos_y as posY, width, height,
  dock_big_display as dockBigDisplay
`;

// SQLite hands INTEGER columns back as JS numbers — this is the one
// boolean-shaped column on project_widgets, so every SELECT using
// WIDGET_COLUMNS runs its rows through this rather than exposing the
// raw 0/1 as ProjectWidget.dockBigDisplay.
export type RawWidgetRow = Omit<ProjectWidget, "dockBigDisplay"> & { dockBigDisplay: number };
export function mapWidgetRow(row: RawWidgetRow): ProjectWidget {
  return { ...row, dockBigDisplay: !!row.dockBigDisplay };
}

export async function fetchWidgetsForProject(projectId: number): Promise<ProjectWidget[]> {
  const db = await getDb();
  const rows = await db.select<RawWidgetRow[]>(
    `SELECT ${WIDGET_COLUMNS} FROM project_widgets WHERE project_id = $1 AND is_solo_field = 0 ORDER BY sort_order`,
    [projectId]
  );
  return rows.map(mapWidgetRow);
}

export async function fetchWidget(id: number): Promise<ProjectWidget | null> {
  const db = await getDb();
  const rows = await db.select<RawWidgetRow[]>(
    `SELECT ${WIDGET_COLUMNS} FROM project_widgets WHERE id = $1`,
    [id]
  );
  return rows[0] ? mapWidgetRow(rows[0]) : null;
}

// Batch fetch by id — used to pull in solo_dock fields' widget rows for
// Web-card display (see fieldLayout.ts's soloDockRefIdsToShowOnWeb),
// since those are otherwise excluded from fetchWidgetsForProject/Goal.
export async function fetchWidgetsByIds(ids: number[]): Promise<ProjectWidget[]> {
  if (ids.length === 0) return [];
  const db = await getDb();
  const placeholders = ids.map((_, i) => `$${i + 1}`).join(", ");
  const rows = await db.select<RawWidgetRow[]>(`SELECT ${WIDGET_COLUMNS} FROM project_widgets WHERE id IN (${placeholders})`, ids);
  return rows.map(mapWidgetRow);
}

export async function updateWidgetDockBigDisplay(id: number, bigDisplay: boolean): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE project_widgets SET dock_big_display = $1 WHERE id = $2", [bigDisplay ? 1 : 0, id]);
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
  // A Master Cost Log source row isn't foreign-keyed to project_widgets
  // (see database.ts's create_cost_grouping_tables comment), so clean up
  // any master's reference to this widget before it's gone.
  await db.execute("DELETE FROM master_cost_log_sources WHERE cost_log_widget_id = $1", [id]);
  await db.execute("DELETE FROM project_widgets WHERE id = $1", [id]);
}

// ---- Web (canvas) widgets ------------------------------------------------
// The same project_widgets rows as above, but free-floating on a Goal
// Web or Dream Web canvas instead of living in a grid — see
// components/WebWidgetNode.tsx. project_id/goal_id stay NULL; web_type/
// web_owner_id take their place, same "one owner column pair, mutually
// exclusive" convention note_web_links uses.

export async function fetchWidgetsForWeb(webType: "goal" | "dream", ownerId: number): Promise<ProjectWidget[]> {
  const db = await getDb();
  const rows = await db.select<RawWidgetRow[]>(
    `SELECT ${WIDGET_COLUMNS} FROM project_widgets WHERE web_type = $1 AND web_owner_id = $2 ORDER BY sort_order`,
    [webType, ownerId]
  );
  return rows.map(mapWidgetRow);
}

// Batch variant for Dream Web, which renders every dream at once — same
// convention as fetchNoteWebLinksForOwners.
export async function fetchWidgetsForWebOwners(webType: "goal" | "dream", ownerIds: number[]): Promise<ProjectWidget[]> {
  if (ownerIds.length === 0) return [];
  const db = await getDb();
  const placeholders = ownerIds.map((_, i) => `$${i + 2}`).join(", ");
  const rows = await db.select<RawWidgetRow[]>(
    `SELECT ${WIDGET_COLUMNS} FROM project_widgets WHERE web_type = $1 AND web_owner_id IN (${placeholders})`,
    [webType, ...ownerIds]
  );
  return rows.map(mapWidgetRow);
}

export async function addWebWidget(
  webType: "goal" | "dream",
  ownerId: number,
  widgetType: ProjectWidgetType,
  title: string,
  x: number,
  y: number,
  width: number,
  height: number
): Promise<number> {
  const db = await getDb();
  const result = await db.execute(
    `INSERT INTO project_widgets (web_type, web_owner_id, widget_type, title, pos_x, pos_y, width, height)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [webType, ownerId, widgetType, title, x, y, width, height]
  );
  return result.lastInsertId as number;
}

export async function updateWebWidgetPosition(id: number, x: number, y: number): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE project_widgets SET pos_x = $1, pos_y = $2 WHERE id = $3", [x, y, id]);
}

export async function updateWebWidgetSize(id: number, width: number, height: number): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE project_widgets SET width = $1, height = $2 WHERE id = $3", [width, height, id]);
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
    case "costlog": {
      const entries = await fetchCostEntries(id);
      for (const e of entries) await addCostEntry(newId, e.amount, e.description);
      break;
    }
    case "calculator": {
      // No persisted state to duplicate — the new widget starts empty.
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
