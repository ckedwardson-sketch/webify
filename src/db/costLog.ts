import { getDb } from "./database";
import { CostEntry, CostGrouping, MasterCostLogSource } from "../types/project";

export async function fetchCostEntries(widgetId: number): Promise<CostEntry[]> {
  const db = await getDb();
  return db.select<CostEntry[]>(
    `SELECT id, widget_id as widgetId, amount, description, created_at as createdAt
     FROM cost_log_entries WHERE widget_id = $1 ORDER BY created_at DESC, id DESC`,
    [widgetId]
  );
}

export async function addCostEntry(widgetId: number, amount: number, description: string): Promise<number> {
  const db = await getDb();
  const result = await db.execute(
    "INSERT INTO cost_log_entries (widget_id, amount, description) VALUES ($1, $2, $3)",
    [widgetId, amount, description]
  );
  return result.lastInsertId as number;
}

export async function deleteCostEntry(id: number): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM cost_log_entries WHERE id = $1", [id]);
}

// One Cost Log widget as offered to a Master Cost Log's source picker —
// ownerLabel is the project/goal it lives on (or "On canvas" for a
// free-floating web widget) so two same-titled Cost Logs are still
// distinguishable in the picker list.
export interface CostLogWidgetOption {
  id: number;
  title: string;
  ownerLabel: string;
}

export async function fetchAllCostLogWidgets(excludeMasterWidgetId: number): Promise<CostLogWidgetOption[]> {
  const db = await getDb();
  return db.select<CostLogWidgetOption[]>(
    `SELECT w.id as id,
            w.title as title,
            COALESCE(p.name, g.name, w.web_type, 'Unfiled') as ownerLabel
     FROM project_widgets w
     LEFT JOIN projects p ON w.project_id = p.id
     LEFT JOIN goals g ON w.goal_id = g.id
     WHERE w.widget_type = 'costlog' AND w.id != $1
     ORDER BY ownerLabel, w.title`,
    [excludeMasterWidgetId]
  );
}

export async function fetchCostGroupings(masterWidgetId: number): Promise<CostGrouping[]> {
  const db = await getDb();
  return db.select<CostGrouping[]>(
    `SELECT id, master_widget_id as masterWidgetId, name, sort_order as sortOrder
     FROM cost_groupings WHERE master_widget_id = $1 ORDER BY sort_order, id`,
    [masterWidgetId]
  );
}

export async function createCostGrouping(masterWidgetId: number, name: string): Promise<number> {
  const db = await getDb();
  const existing = await db.select<{ maxOrder: number | null }[]>(
    "SELECT MAX(sort_order) as maxOrder FROM cost_groupings WHERE master_widget_id = $1",
    [masterWidgetId]
  );
  const nextOrder = (existing[0].maxOrder ?? -1) + 1;
  const result = await db.execute(
    "INSERT INTO cost_groupings (master_widget_id, name, sort_order) VALUES ($1, $2, $3)",
    [masterWidgetId, name, nextOrder]
  );
  return result.lastInsertId as number;
}

export async function renameCostGrouping(id: number, name: string): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE cost_groupings SET name = $1 WHERE id = $2", [name, id]);
}

export async function deleteCostGrouping(id: number): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM cost_groupings WHERE id = $1", [id]);
}

export async function fetchMasterCostLogSources(masterWidgetId: number): Promise<MasterCostLogSource[]> {
  const db = await getDb();
  return db.select<MasterCostLogSource[]>(
    `SELECT id, master_widget_id as masterWidgetId, cost_log_widget_id as costLogWidgetId, grouping_id as groupingId
     FROM master_cost_log_sources WHERE master_widget_id = $1`,
    [masterWidgetId]
  );
}

export async function addMasterCostLogSource(
  masterWidgetId: number,
  costLogWidgetId: number,
  groupingId: number | null
): Promise<void> {
  const db = await getDb();
  await db.execute(
    "INSERT OR IGNORE INTO master_cost_log_sources (master_widget_id, cost_log_widget_id, grouping_id) VALUES ($1, $2, $3)",
    [masterWidgetId, costLogWidgetId, groupingId]
  );
}

export async function removeMasterCostLogSource(id: number): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM master_cost_log_sources WHERE id = $1", [id]);
}

export async function setMasterCostLogSourceGrouping(id: number, groupingId: number | null): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE master_cost_log_sources SET grouping_id = $1 WHERE id = $2", [groupingId, id]);
}

// One source's title/owner (for display) plus its own cost-log total —
// what MasterCostLogWidget.tsx needs per row without re-fetching each
// source widget's full entry list itself.
export interface MasterCostLogSourceDetail extends MasterCostLogSource {
  title: string;
  ownerLabel: string;
  total: number;
}

export async function fetchMasterCostLogSourceDetails(masterWidgetId: number): Promise<MasterCostLogSourceDetail[]> {
  const db = await getDb();
  return db.select<MasterCostLogSourceDetail[]>(
    `SELECT s.id as id,
            s.master_widget_id as masterWidgetId,
            s.cost_log_widget_id as costLogWidgetId,
            s.grouping_id as groupingId,
            w.title as title,
            COALESCE(p.name, g.name, w.web_type, 'Unfiled') as ownerLabel,
            COALESCE((SELECT SUM(amount) FROM cost_log_entries WHERE widget_id = s.cost_log_widget_id), 0) as total
     FROM master_cost_log_sources s
     JOIN project_widgets w ON w.id = s.cost_log_widget_id
     LEFT JOIN projects p ON w.project_id = p.id
     LEFT JOIN goals g ON w.goal_id = g.id
     WHERE s.master_widget_id = $1
     ORDER BY ownerLabel, w.title`,
    [masterWidgetId]
  );
}
