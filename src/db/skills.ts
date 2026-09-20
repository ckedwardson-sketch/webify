// src/db/skills.ts
import { getDb } from "./database";
import {
  DEFAULT_SKILL_SETTINGS,
  Skill,
  SkillDreamNodeField,
  SkillGoal,
  SkillGoalStatus,
  SkillSettings,
  SkillTask,
  SkillTaskPath,
  SkillWorkLog,
  WorkType,
} from "../types/skill";

// ---- Skills ----------------------------------------------------------

export async function fetchSkills(): Promise<Skill[]> {
  const db = await getDb();
  return db.select<Skill[]>(
    `SELECT id, name, current_level_name as currentLevelName, created_at as createdAt, updated_at as updatedAt
     FROM skills ORDER BY sort_order, name COLLATE NOCASE`
  );
}

// Same pattern as reorderRecipes/reorderCategories — the dragged-to
// order is simply written back as 0..N sequential sort_order values.
export async function reorderSkills(orderedIds: number[]): Promise<void> {
  const db = await getDb();
  for (let i = 0; i < orderedIds.length; i++) {
    await db.execute("UPDATE skills SET sort_order = $1 WHERE id = $2", [i, orderedIds[i]]);
  }
}

export async function fetchSkill(id: number): Promise<Skill | null> {
  const db = await getDb();
  const rows = await db.select<Skill[]>(
    `SELECT id, name, current_level_name as currentLevelName, created_at as createdAt, updated_at as updatedAt
     FROM skills WHERE id = $1`,
    [id]
  );
  return rows[0] ?? null;
}

export async function addSkill(name: string): Promise<number> {
  const db = await getDb();
  const result = await db.execute(
    `INSERT INTO skills (name, created_at, updated_at) VALUES ($1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    [name]
  );
  return result.lastInsertId as number;
}

export async function updateSkillName(id: number, name: string): Promise<void> {
  const db = await getDb();
  await db.execute(`UPDATE skills SET name = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`, [name, id]);
}

export async function updateSkillCurrentLevelName(id: number, currentLevelName: string): Promise<void> {
  const db = await getDb();
  await db.execute(
    `UPDATE skills SET current_level_name = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
    [currentLevelName, id]
  );
}

export async function deleteSkill(id: number): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM skills WHERE id = $1", [id]);
}

// ---- Dream <-> Skill ---------------------------------------------------

export async function fetchSkillsForDream(
  dreamId: number
): Promise<(Skill & { linkId: number; posX: number | null; posY: number | null })[]> {
  const db = await getDb();
  return db.select(
    `SELECT ds.id as linkId, ds.pos_x as posX, ds.pos_y as posY, s.id, s.name, s.current_level_name as currentLevelName,
            s.created_at as createdAt, s.updated_at as updatedAt
     FROM dream_skills ds JOIN skills s ON s.id = ds.skill_id
     WHERE ds.dream_id = $1 ORDER BY s.name COLLATE NOCASE`,
    [dreamId]
  );
}

// Batch variant for DreamWebPage, which needs every active dream's
// skill links at once rather than one query per dream.
export async function fetchSkillsForDreams(
  dreamIds: number[]
): Promise<(Skill & { linkId: number; dreamId: number; posX: number | null; posY: number | null })[]> {
  if (dreamIds.length === 0) return [];
  const db = await getDb();
  const placeholders = dreamIds.map((_, i) => `$${i + 1}`).join(", ");
  return db.select(
    `SELECT ds.id as linkId, ds.dream_id as dreamId, ds.pos_x as posX, ds.pos_y as posY,
            s.id, s.name, s.current_level_name as currentLevelName,
            s.created_at as createdAt, s.updated_at as updatedAt
     FROM dream_skills ds JOIN skills s ON s.id = ds.skill_id
     WHERE ds.dream_id IN (${placeholders}) ORDER BY s.name COLLATE NOCASE`,
    dreamIds
  );
}

export async function updateDreamSkillPosition(linkId: number, x: number, y: number): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE dream_skills SET pos_x = $1, pos_y = $2 WHERE id = $3", [x, y, linkId]);
}

export async function fetchDreamsForSkill(skillId: number): Promise<{ linkId: number; dreamId: number; dreamName: string }[]> {
  const db = await getDb();
  return db.select(
    `SELECT ds.id as linkId, d.id as dreamId, d.name as dreamName
     FROM dream_skills ds JOIN dreams d ON d.id = ds.dream_id
     WHERE ds.skill_id = $1 ORDER BY d.name COLLATE NOCASE`,
    [skillId]
  );
}

export async function linkSkillToDream(skillId: number, dreamId: number): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT OR IGNORE INTO dream_skills (dream_id, skill_id) VALUES ($1, $2)`,
    [dreamId, skillId]
  );
}

export async function unlinkSkillFromDream(linkId: number): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM dream_skills WHERE id = $1", [linkId]);
}

// ---- Skill Goals ---------------------------------------------------

type RawGoalRow = {
  id: number;
  skillId: number;
  parentGoalId: number | null;
  name: string;
  description: string;
  reason: string;
  completionImage: string | null;
  status: string;
  isActive: number;
  historyOrder: number | null;
  createdAt: string;
  completedAt: string | null;
};

const GOAL_COLUMNS = `
  id, skill_id as skillId, parent_goal_id as parentGoalId, name, description, reason,
  completion_image as completionImage, status, is_active as isActive,
  history_order as historyOrder, created_at as createdAt, completed_at as completedAt
`;

function mapGoalRow(row: RawGoalRow): SkillGoal {
  return {
    id: row.id,
    skillId: row.skillId,
    parentGoalId: row.parentGoalId,
    name: row.name,
    description: row.description,
    reason: row.reason,
    completionImage: row.completionImage ?? undefined,
    status: row.status as SkillGoalStatus,
    isActive: !!row.isActive,
    historyOrder: row.historyOrder,
    createdAt: row.createdAt,
    completedAt: row.completedAt ?? undefined,
  };
}

export async function fetchSkillGoals(skillId: number): Promise<SkillGoal[]> {
  const db = await getDb();
  const rows = await db.select<RawGoalRow[]>(
    `SELECT ${GOAL_COLUMNS} FROM skill_goals WHERE skill_id = $1 ORDER BY id`,
    [skillId]
  );
  return rows.map(mapGoalRow);
}

export async function fetchSkillGoal(id: number): Promise<SkillGoal | null> {
  const db = await getDb();
  const rows = await db.select<RawGoalRow[]>(`SELECT ${GOAL_COLUMNS} FROM skill_goals WHERE id = $1`, [id]);
  return rows[0] ? mapGoalRow(rows[0]) : null;
}

// Historical goals never branch: only allowed to attach as a child of the
// last historical goal (or standalone as the first one). Forward/branch
// goals attach anywhere in the active tree. Enforced here at the app
// boundary rather than a schema CHECK, matching the rest of this codebase.
export async function addSkillGoal(
  skillId: number,
  parentGoalId: number | null,
  name: string,
  isHistorical: boolean
): Promise<number> {
  const db = await getDb();
  let historyOrder: number | null = null;
  if (isHistorical) {
    const rows = await db.select<{ maxOrder: number | null }[]>(
      `SELECT MAX(history_order) as maxOrder FROM skill_goals WHERE skill_id = $1 AND status = 'historical'`,
      [skillId]
    );
    historyOrder = (rows[0]?.maxOrder ?? 0) + 1;
  }
  const result = await db.execute(
    `INSERT INTO skill_goals (skill_id, parent_goal_id, name, status, history_order, created_at)
     VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)`,
    [skillId, parentGoalId, name, isHistorical ? "historical" : "active", historyOrder]
  );
  return result.lastInsertId as number;
}

export async function updateSkillGoalDetails(
  id: number,
  fields: Partial<Pick<SkillGoal, "name" | "description" | "reason" | "completionImage">>
): Promise<void> {
  const db = await getDb();
  const sets: string[] = [];
  const values: unknown[] = [];
  let i = 1;
  if (fields.name !== undefined) { sets.push(`name = $${i++}`); values.push(fields.name); }
  if (fields.description !== undefined) { sets.push(`description = $${i++}`); values.push(fields.description); }
  if (fields.reason !== undefined) { sets.push(`reason = $${i++}`); values.push(fields.reason); }
  if (fields.completionImage !== undefined) { sets.push(`completion_image = $${i++}`); values.push(fields.completionImage ?? null); }
  if (sets.length === 0) return;
  values.push(id);
  await db.execute(`UPDATE skill_goals SET ${sets.join(", ")} WHERE id = $${i}`, values);
}

export async function setSkillGoalActive(id: number, isActive: boolean): Promise<void> {
  const db = await getDb();
  await db.execute(`UPDATE skill_goals SET is_active = $1 WHERE id = $2`, [isActive ? 1 : 0, id]);
}

// Marks a goal completed. Bring-forward/put-to-bed handling for sibling
// branches is a separate explicit step the caller drives (see
// bringGoalForward/putGoalToBed) rather than automatic side effects here,
// since the user is prompted to choose per-branch.
export async function completeSkillGoal(id: number): Promise<void> {
  const db = await getDb();
  await db.execute(
    `UPDATE skill_goals SET status = 'completed', is_active = 0, completed_at = CURRENT_TIMESTAMP WHERE id = $1`,
    [id]
  );
}

// Bringing a put-to-bed goal forward doesn't just flip its status in
// place — left at its old parent it stays stuck behind however far the
// tree has since grown past it. Instead it's reparented onto the current
// frontier (the most recently completed goal with no active/completed
// child yet) so it lands "one level past" wherever progress currently is,
// the same depth as the tree's other active goals.
export async function bringGoalForward(id: number): Promise<void> {
  const db = await getDb();
  const goal = await fetchSkillGoal(id);
  if (!goal) return;
  const rows = await db.select<{ id: number }[]>(
    `SELECT g.id FROM skill_goals g
     WHERE g.skill_id = $1 AND g.status = 'completed' AND g.id != $2
       AND NOT EXISTS (
         SELECT 1 FROM skill_goals c WHERE c.parent_goal_id = g.id AND c.status IN ('active', 'completed')
       )
     ORDER BY g.completed_at DESC LIMIT 1`,
    [goal.skillId, id]
  );
  const newParentId = rows[0]?.id ?? goal.parentGoalId;
  await db.execute(`UPDATE skill_goals SET status = 'active', parent_goal_id = $1 WHERE id = $2`, [
    newParentId,
    id,
  ]);
}

// Freezes this goal and its whole subtree — put-to-bed is permanent and
// gray, but never deletes anything (tasks placed on its paths stay in the
// toolbar, just visually grayed by the renderer).
export async function putGoalToBed(id: number): Promise<void> {
  const db = await getDb();
  const toFreeze: number[] = [id];
  let cursor = 0;
  while (cursor < toFreeze.length) {
    const current = toFreeze[cursor++];
    const children = await db.select<{ id: number }[]>(
      `SELECT id FROM skill_goals WHERE parent_goal_id = $1`,
      [current]
    );
    for (const c of children) toFreeze.push(c.id);
  }
  for (const goalId of toFreeze) {
    await db.execute(`UPDATE skill_goals SET status = 'put_to_bed', is_active = 0 WHERE id = $1`, [goalId]);
  }
}

// Siblings sharing the same parent as `completedGoalId` (or, if it has no
// parent, other root goals) that are still active/incomplete — what the
// "deal with relevant uncompleted goals/tasks" prompt needs to show.
export async function fetchSiblingGoalsToResolve(completedGoalId: number): Promise<SkillGoal[]> {
  const db = await getDb();
  const goal = await fetchSkillGoal(completedGoalId);
  if (!goal) return [];
  const rows = await db.select<RawGoalRow[]>(
    goal.parentGoalId === null
      ? `SELECT ${GOAL_COLUMNS} FROM skill_goals WHERE skill_id = $1 AND parent_goal_id IS NULL AND id != $2 AND status = 'active'`
      : `SELECT ${GOAL_COLUMNS} FROM skill_goals WHERE parent_goal_id = $2 AND id != $3 AND status = 'active'`,
    goal.parentGoalId === null ? [goal.skillId, completedGoalId] : [goal.skillId, goal.parentGoalId, completedGoalId]
  );
  return rows.map(mapGoalRow);
}

export async function reorderHistoricalGoals(skillId: number, orderedIds: number[]): Promise<void> {
  const db = await getDb();
  for (let i = 0; i < orderedIds.length; i++) {
    await db.execute(
      `UPDATE skill_goals SET history_order = $1 WHERE id = $2 AND skill_id = $3`,
      [i, orderedIds[i], skillId]
    );
  }
}

export async function deleteSkillGoal(id: number): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM skill_goals WHERE id = $1", [id]);
}

// ---- Skill Tasks ---------------------------------------------------

type RawTaskRow = {
  id: number;
  skillId: number;
  name: string;
  workType: string;
  description: string;
  archived: number;
  createdAt: string;
  updatedAt: string;
};

const TASK_COLUMNS = `
  id, skill_id as skillId, name, work_type as workType, description,
  archived, created_at as createdAt, updated_at as updatedAt
`;

function mapTaskRow(row: RawTaskRow): SkillTask {
  return {
    id: row.id,
    skillId: row.skillId,
    name: row.name,
    workType: row.workType as WorkType,
    description: row.description,
    archived: !!row.archived,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function fetchSkillTasks(skillId: number): Promise<SkillTask[]> {
  const db = await getDb();
  const rows = await db.select<RawTaskRow[]>(
    `SELECT ${TASK_COLUMNS} FROM skill_tasks WHERE skill_id = $1 ORDER BY id`,
    [skillId]
  );
  return rows.map(mapTaskRow);
}

export async function fetchSkillTask(id: number): Promise<SkillTask | null> {
  const db = await getDb();
  const rows = await db.select<RawTaskRow[]>(`SELECT ${TASK_COLUMNS} FROM skill_tasks WHERE id = $1`, [id]);
  return rows[0] ? mapTaskRow(rows[0]) : null;
}

export async function addSkillTask(skillId: number, name: string, workType: WorkType): Promise<number> {
  const db = await getDb();
  const result = await db.execute(
    `INSERT INTO skill_tasks (skill_id, name, work_type, created_at, updated_at)
     VALUES ($1, $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    [skillId, name, workType]
  );
  return result.lastInsertId as number;
}

export async function updateSkillTaskDetails(
  id: number,
  fields: Partial<Pick<SkillTask, "name" | "workType" | "description">>
): Promise<void> {
  const db = await getDb();
  const sets: string[] = [];
  const values: unknown[] = [];
  let i = 1;
  if (fields.name !== undefined) { sets.push(`name = $${i++}`); values.push(fields.name); }
  if (fields.workType !== undefined) { sets.push(`work_type = $${i++}`); values.push(fields.workType); }
  if (fields.description !== undefined) { sets.push(`description = $${i++}`); values.push(fields.description); }
  if (sets.length === 0) return;
  sets.push(`updated_at = CURRENT_TIMESTAMP`);
  values.push(id);
  await db.execute(`UPDATE skill_tasks SET ${sets.join(", ")} WHERE id = $${i}`, values);
}

export async function setSkillTaskArchived(id: number, archived: boolean): Promise<void> {
  const db = await getDb();
  await db.execute(`UPDATE skill_tasks SET archived = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`, [
    archived ? 1 : 0,
    id,
  ]);
}

// ---- Task <-> Path placements ---------------------------------------

export async function fetchSkillTaskPaths(skillId: number): Promise<SkillTaskPath[]> {
  const db = await getDb();
  return db.select<SkillTaskPath[]>(
    `SELECT stp.id, stp.task_id as taskId, stp.source_goal_id as sourceGoalId,
            stp.target_goal_id as targetGoalId, stp.offset_x as offsetX, stp.offset_y as offsetY
     FROM skill_task_paths stp
     JOIN skill_tasks st ON st.id = stp.task_id
     WHERE st.skill_id = $1`,
    [skillId]
  );
}

export async function placeTaskOnPath(
  taskId: number,
  sourceGoalId: number,
  targetGoalId: number,
  offsetX: number,
  offsetY: number
): Promise<number> {
  const db = await getDb();
  const result = await db.execute(
    `INSERT INTO skill_task_paths (task_id, source_goal_id, target_goal_id, offset_x, offset_y, created_at)
     VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
     ON CONFLICT(task_id, source_goal_id, target_goal_id) DO UPDATE SET offset_x = excluded.offset_x, offset_y = excluded.offset_y`,
    [taskId, sourceGoalId, targetGoalId, offsetX, offsetY]
  );
  return result.lastInsertId as number;
}

export async function updateTaskPathOffset(id: number, offsetX: number, offsetY: number): Promise<void> {
  const db = await getDb();
  await db.execute(`UPDATE skill_task_paths SET offset_x = $1, offset_y = $2 WHERE id = $3`, [
    offsetX,
    offsetY,
    id,
  ]);
}

// Removing a placement never deletes the task itself — it just goes back
// to being unplaced (visible in the toolbar).
export async function removeTaskFromPath(pathPlacementId: number): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM skill_task_paths WHERE id = $1", [pathPlacementId]);
}

// ---- Work Logs ---------------------------------------------------

export async function fetchWorkLogs(taskId: number): Promise<SkillWorkLog[]> {
  const db = await getDb();
  return db.select<SkillWorkLog[]>(
    `SELECT id, task_id as taskId, logged_date as loggedDate, duration_minutes as durationMinutes,
            note, created_at as createdAt
     FROM skill_work_logs WHERE task_id = $1 ORDER BY logged_date DESC, id DESC`,
    [taskId]
  );
}

export async function fetchWorkLogsForSkill(skillId: number): Promise<SkillWorkLog[]> {
  const db = await getDb();
  return db.select<SkillWorkLog[]>(
    `SELECT wl.id, wl.task_id as taskId, wl.logged_date as loggedDate, wl.duration_minutes as durationMinutes,
            wl.note, wl.created_at as createdAt
     FROM skill_work_logs wl JOIN skill_tasks st ON st.id = wl.task_id
     WHERE st.skill_id = $1 ORDER BY wl.logged_date DESC, wl.id DESC`,
    [skillId]
  );
}

export async function logWork(taskId: number, loggedDate: string, durationMinutes: number, note: string | null): Promise<number> {
  const db = await getDb();
  const result = await db.execute(
    `INSERT INTO skill_work_logs (task_id, logged_date, duration_minutes, note, created_at)
     VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)`,
    [taskId, loggedDate, durationMinutes, note]
  );
  await db.execute(`UPDATE skill_tasks SET updated_at = CURRENT_TIMESTAMP WHERE id = $1`, [taskId]);
  return result.lastInsertId as number;
}

export async function deleteWorkLog(id: number): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM skill_work_logs WHERE id = $1", [id]);
}

export function lastWorkedDate(logs: SkillWorkLog[]): string | undefined {
  if (logs.length === 0) return undefined;
  return logs.reduce((latest, l) => (l.loggedDate > latest ? l.loggedDate : latest), logs[0].loggedDate);
}

// ---- Skill Settings (Dynamic Settings) ---------------------------------

export async function fetchSkillSettings(skillId: number): Promise<SkillSettings> {
  const db = await getDb();
  const rows = await db.select<any[]>(
    `SELECT ring_palette as ringPalette, node_width as nodeWidth, node_height as nodeHeight,
            direction, h_spacing as hSpacing, v_spacing as vSpacing, branch_spacing as branchSpacing,
            historical_spacing as historicalSpacing, task_offset as taskOffset,
            path_bend_distance as pathBendDistance, dream_node_fields as dreamNodeFields,
            dream_node_active_goal_id as dreamNodeActiveGoalId,
            task_cooldown_type as taskCooldownType, task_cooldown_hours as taskCooldownHours
     FROM skill_settings WHERE skill_id = $1`,
    [skillId]
  );
  const row = rows[0];
  if (!row) return { skillId, ...DEFAULT_SKILL_SETTINGS };
  return {
    skillId,
    ringPalette: row.ringPalette ?? DEFAULT_SKILL_SETTINGS.ringPalette,
    nodeWidth: row.nodeWidth ?? DEFAULT_SKILL_SETTINGS.nodeWidth,
    nodeHeight: row.nodeHeight ?? DEFAULT_SKILL_SETTINGS.nodeHeight,
    direction: row.direction ?? DEFAULT_SKILL_SETTINGS.direction,
    hSpacing: row.hSpacing ?? DEFAULT_SKILL_SETTINGS.hSpacing,
    vSpacing: row.vSpacing ?? DEFAULT_SKILL_SETTINGS.vSpacing,
    branchSpacing: row.branchSpacing ?? DEFAULT_SKILL_SETTINGS.branchSpacing,
    historicalSpacing: row.historicalSpacing ?? DEFAULT_SKILL_SETTINGS.historicalSpacing,
    taskOffset: row.taskOffset ?? DEFAULT_SKILL_SETTINGS.taskOffset,
    pathBendDistance: row.pathBendDistance ?? DEFAULT_SKILL_SETTINGS.pathBendDistance,
    dreamNodeFields: row.dreamNodeFields ? (JSON.parse(row.dreamNodeFields) as SkillDreamNodeField[]) : DEFAULT_SKILL_SETTINGS.dreamNodeFields,
    dreamNodeActiveGoalId: row.dreamNodeActiveGoalId ?? null,
    taskCooldownType: row.taskCooldownType ?? DEFAULT_SKILL_SETTINGS.taskCooldownType,
    taskCooldownHours: row.taskCooldownHours ?? DEFAULT_SKILL_SETTINGS.taskCooldownHours,
  };
}

export async function saveSkillSettings(settings: SkillSettings): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT INTO skill_settings
       (skill_id, ring_palette, node_width, node_height, direction, h_spacing, v_spacing, branch_spacing,
        historical_spacing, task_offset, path_bend_distance, dream_node_fields, dream_node_active_goal_id,
        task_cooldown_type, task_cooldown_hours)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
     ON CONFLICT(skill_id) DO UPDATE SET
       ring_palette = excluded.ring_palette, node_width = excluded.node_width,
       node_height = excluded.node_height, direction = excluded.direction,
       h_spacing = excluded.h_spacing, v_spacing = excluded.v_spacing,
       branch_spacing = excluded.branch_spacing, historical_spacing = excluded.historical_spacing,
       task_offset = excluded.task_offset, path_bend_distance = excluded.path_bend_distance,
       dream_node_fields = excluded.dream_node_fields, dream_node_active_goal_id = excluded.dream_node_active_goal_id,
       task_cooldown_type = excluded.task_cooldown_type, task_cooldown_hours = excluded.task_cooldown_hours`,
    [
      settings.skillId,
      settings.ringPalette,
      settings.nodeWidth,
      settings.nodeHeight,
      settings.direction,
      settings.hSpacing,
      settings.vSpacing,
      settings.branchSpacing,
      settings.historicalSpacing,
      settings.taskOffset,
      settings.pathBendDistance,
      JSON.stringify(settings.dreamNodeFields),
      settings.dreamNodeActiveGoalId,
      settings.taskCooldownType,
      settings.taskCooldownHours,
    ]
  );
}

// ---- Aggregate loader for the Skill Tree page ---------------------------

export interface SkillTreeData {
  skill: Skill;
  goals: SkillGoal[];
  tasks: SkillTask[];
  taskPaths: SkillTaskPath[];
  workLogs: SkillWorkLog[];
  settings: SkillSettings;
}

export async function fetchSkillTreeData(skillId: number): Promise<SkillTreeData | null> {
  const skill = await fetchSkill(skillId);
  if (!skill) return null;
  const [goals, tasks, taskPaths, workLogs, settings] = await Promise.all([
    fetchSkillGoals(skillId),
    fetchSkillTasks(skillId),
    fetchSkillTaskPaths(skillId),
    fetchWorkLogsForSkill(skillId),
    fetchSkillSettings(skillId),
  ]);
  return { skill, goals, tasks, taskPaths, workLogs, settings };
}
