// Tasks page (src/pages/TasksPage.tsx) — a cross-app board built on top
// of the same progress_nodes rows the Project/Goal Web renders (see
// db/progress.ts). A row only shows up here once task_board_status is
// set to 'bank' or 'board'; ordinary project/goal tasks are invisible
// to this page until explicitly linked in.
import { getDb } from "./database";
import { ProgressNode, ProgressNodeCompletion } from "../types/models";
import { PROGRESS_COLUMNS, mapProgressRow, RawProgressRow } from "./progress";
import { logWork } from "./skills";
import { todayISO } from "../responsibilities/scheduling";
import { TaskCooldownType } from "../types/skill";

// Excludes completed tasks — those are done via fetchCompletedTasks
// below, until they're dismissed off this page entirely.
async function fetchByStatus(status: "bank" | "board" | "archive"): Promise<ProgressNode[]> {
  const db = await getDb();
  const rows = await db.select<RawProgressRow[]>(
    `SELECT ${PROGRESS_COLUMNS} FROM progress_nodes WHERE task_board_status = $1 AND is_complete = 0
     ORDER BY task_added_at IS NULL, task_added_at, id`,
    [status]
  );
  return rows.map(mapProgressRow);
}

export async function fetchBankTasks(): Promise<ProgressNode[]> {
  return fetchByStatus("bank");
}

// A task counts as "missed" once per distinct task_due_at it sails past
// while still sitting on the board incomplete — not once per day
// overdue. task_missed_last_counted_due_at remembers which due date has
// already been counted so re-running this on every load doesn't
// double-count; a fresh due date (task sent back to the board again)
// naturally doesn't match it, so it counts again next time it's missed.
async function bumpMissedCounts(): Promise<void> {
  const db = await getDb();
  await db.execute(
    `UPDATE progress_nodes
     SET task_missed_count = task_missed_count + 1, task_missed_last_counted_due_at = task_due_at
     WHERE task_board_status = 'board' AND is_complete = 0 AND task_due_at IS NOT NULL
       AND task_due_at < CURRENT_TIMESTAMP
       AND (task_missed_last_counted_due_at IS NULL OR task_missed_last_counted_due_at != task_due_at)`
  );
}

// All board tasks — the page itself splits these into "on track" vs.
// "uncompleted" (past task_due_at) since that split is purely a
// function of the current time, not stored state.
export async function fetchBoardTasks(): Promise<ProgressNode[]> {
  await bumpMissedCounts();
  return fetchByStatus("board");
}

export async function fetchArchivedTasks(): Promise<ProgressNode[]> {
  return fetchByStatus("archive");
}

// Finished but still sitting in the Tasks system awaiting a dismiss —
// see dismissCompletedTask below.
export async function fetchCompletedTasks(): Promise<ProgressNode[]> {
  const db = await getDb();
  const rows = await db.select<RawProgressRow[]>(
    `SELECT ${PROGRESS_COLUMNS} FROM progress_nodes
     WHERE task_board_status IS NOT NULL AND is_complete = 1
     ORDER BY completed_at DESC`
  );
  return rows.map(mapProgressRow);
}

// Candidates for the "link tasks into task bank" picker — ordinary
// project/goal tasks nobody's pulled onto this page yet.
export async function fetchLinkableTasks(): Promise<ProgressNode[]> {
  const db = await getDb();
  const rows = await db.select<RawProgressRow[]>(
    `SELECT ${PROGRESS_COLUMNS} FROM progress_nodes
     WHERE task_board_status IS NULL AND task_is_standalone = 0 AND is_complete = 0
     ORDER BY id DESC`
  );
  return rows.map(mapProgressRow);
}

function computeDueAt(days: number): string {
  const due = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  return due.toISOString().slice(0, 19).replace("T", " ");
}

// A quick task created straight from the Tasks board — deliberately
// skips the category/difficulty/instructions questions the full
// progress-node editor asks, so jotting one down stays fast. With no
// owner it's a "free time" errand (task_is_standalone); with one, it's
// a real task on that goal/project's own Web too — same row, this is
// just a faster way to create it than opening that Web and adding one
// there.
export async function addQuickTask(
  header: string,
  description: string,
  reason: string,
  days: number,
  owner?: { goalId: number } | { projectId: number }
): Promise<number> {
  const db = await getDb();
  const goalId = owner && "goalId" in owner ? owner.goalId : null;
  const projectId = owner && "projectId" in owner ? owner.projectId : null;
  const result = await db.execute(
    `INSERT INTO progress_nodes
       (project_id, goal_id, short_description, description, reason, task_is_standalone,
        task_board_status, task_added_at, task_goal_days, task_due_at,
        created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, 'board', CURRENT_TIMESTAMP, $7, $8, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    [projectId, goalId, header, description, reason, owner ? 0 : 1, days, computeDueAt(days)]
  );
  return result.lastInsertId as number;
}

export async function linkIntoBank(progressNodeId: number): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE progress_nodes SET task_board_status = 'bank' WHERE id = $1", [progressNodeId]);
}

// Removes a project/goal task from the Tasks system without touching
// the task itself — it just goes back to being a normal, unlinked task
// on its owning Project/Goal Web.
export async function kickFromBank(id: number): Promise<void> {
  const db = await getDb();
  await db.execute(
    "UPDATE progress_nodes SET task_board_status = NULL, task_added_at = NULL, task_goal_days = NULL, task_due_at = NULL WHERE id = $1",
    [id]
  );
}

export async function sendTaskToBoard(id: number, days: number): Promise<void> {
  const db = await getDb();
  await db.execute(
    `UPDATE progress_nodes
     SET task_board_status = 'board', task_added_at = CURRENT_TIMESTAMP, task_goal_days = $1, task_due_at = $2
     WHERE id = $3`,
    [days, computeDueAt(days), id]
  );
}

// The board card's "⋮" menu's "Send to Task Bank" — pauses the
// countdown and parks it back in the bank rather than leaving it on
// the board or deleting it. Mirrors kickFromBank's reset of the
// countdown fields, just landing on 'bank' instead of NULL.
export async function sendBoardTaskToBank(id: number): Promise<void> {
  const db = await getDb();
  await db.execute(
    "UPDATE progress_nodes SET task_board_status = 'bank', task_added_at = NULL, task_goal_days = NULL, task_due_at = NULL WHERE id = $1",
    [id]
  );
}

// Sends a task (from the bank, board, or Uncompleted column) to the
// Task Archive — always paired with a "why" prompt in the UI. Clears
// the board scheduling fields the same way kickFromBank/
// sendBoardTaskToBank do, since an archived task isn't actively
// scheduled anymore.
export async function archiveTask(id: number, reason: string): Promise<void> {
  const db = await getDb();
  await db.execute(
    `UPDATE progress_nodes
     SET task_board_status = 'archive', task_archive_reason = $1,
         task_added_at = NULL, task_goal_days = NULL, task_due_at = NULL
     WHERE id = $2`,
    [reason, id]
  );
}

// Pulls an archived task back into the bank — the archive reason no
// longer applies once it's active again.
export async function restoreArchivedTaskToBank(id: number): Promise<void> {
  const db = await getDb();
  await db.execute(
    "UPDATE progress_nodes SET task_board_status = 'bank', task_archive_reason = NULL WHERE id = $1",
    [id]
  );
}

export async function restoreArchivedTaskToBoard(id: number, days: number): Promise<void> {
  const db = await getDb();
  await db.execute(
    `UPDATE progress_nodes
     SET task_board_status = 'board', task_archive_reason = NULL,
         task_added_at = CURRENT_TIMESTAMP, task_goal_days = $1, task_due_at = $2
     WHERE id = $3`,
    [days, computeDueAt(days), id]
  );
}

export async function setCompletionImage(id: number, image: string | null): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE progress_nodes SET task_completion_image = $1 WHERE id = $2", [image, id]);
}

// Dismissing a completed task clears it out of the Tasks system. A
// standalone task has no other home, so it's deleted outright; a
// project/goal task just detaches (its completion still shows on its
// own Project/Goal Web, same as kickFromBank).
export async function dismissCompletedTask(id: number, isStandalone: boolean): Promise<void> {
  const db = await getDb();
  if (isStandalone) {
    await db.execute("DELETE FROM progress_nodes WHERE id = $1", [id]);
  } else {
    await kickFromBank(id);
  }
}

// The general "remove this task from existence" action (two-click
// confirm on the card, see ConfirmDeleteIconButton) — always a hard
// delete, unlike dismissCompletedTask/kickFromBank which spare
// project/goal tasks.
export async function deleteTask(id: number): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM progress_nodes WHERE id = $1", [id]);
}

// ---- Skill linking ---------------------------------------------------

export async function linkTaskToSkillTask(taskId: number, skillTaskId: number): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE progress_nodes SET linked_skill_task_id = $1 WHERE id = $2", [skillTaskId, taskId]);
}

// Never touches the skill_tasks row itself — its work-log history
// belongs to the skill, not to this board task.
export async function unlinkTaskFromSkillTask(taskId: number): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE progress_nodes SET linked_skill_task_id = NULL WHERE id = $1", [taskId]);
}

// One cooldown lookup per linked skill task on the board, keyed by
// skill_task id — joins skill_tasks -> skill_settings only (no
// progress_nodes involved), so there's no ambiguous-column risk from
// joining onto PROGRESS_COLUMNS' bare names.
export async function fetchSkillTaskCooldowns(
  skillTaskIds: number[]
): Promise<Map<number, { type: TaskCooldownType; hours: number }>> {
  const map = new Map<number, { type: TaskCooldownType; hours: number }>();
  if (skillTaskIds.length === 0) return map;
  const db = await getDb();
  const placeholders = skillTaskIds.map((_, i) => `$${i + 1}`).join(", ");
  const rows = await db.select<{ id: number; type: TaskCooldownType | null; hours: number | null }[]>(
    `SELECT st.id as id, ss.task_cooldown_type as type, ss.task_cooldown_hours as hours
     FROM skill_tasks st LEFT JOIN skill_settings ss ON ss.skill_id = st.skill_id
     WHERE st.id IN (${placeholders})`,
    skillTaskIds
  );
  for (const row of rows) {
    map.set(row.id, { type: row.type ?? "daily", hours: row.hours ?? 24 });
  }
  return map;
}

// Hold-to-complete on a skill-linked task: logs the real work-log entry
// on the skill (db/skills.ts's logWork, same one the Skill Tree itself
// writes through) plus a lightweight "copy" for the Tasks page's
// Completed section (see progress_node_completions in db/database.ts),
// then stamps task_last_completed_at so the board card starts cooling
// down. is_complete/completed_at are never touched — the task stays on
// the board.
export async function logSkillTaskCompletion(
  taskId: number,
  skillTaskId: number,
  durationMinutes: number,
  note: string | null
): Promise<void> {
  const db = await getDb();
  await logWork(skillTaskId, todayISO(), durationMinutes, note);
  await db.execute(
    "INSERT INTO progress_node_completions (progress_node_id, duration_minutes, note) VALUES ($1, $2, $3)",
    [taskId, durationMinutes, note]
  );
  await db.execute("UPDATE progress_nodes SET task_last_completed_at = CURRENT_TIMESTAMP WHERE id = $1", [taskId]);
}

// Completed-section "Add to a Web" action — creates a brand new,
// already-complete progress_nodes row on the chosen project/goal's Web,
// carrying over just the header/description/reason and the original
// completion date. A one-time snapshot: the new node is a separate row
// from here on, not kept in sync with the task it was copied from.
export async function linkCompletedTaskToWeb(
  taskId: number,
  owner: { goalId: number } | { projectId: number }
): Promise<number> {
  const db = await getDb();
  const rows = await db.select<
    { shortDescription: string; description: string; reason: string; completedAt: string | null }[]
  >(
    "SELECT short_description as shortDescription, description, reason, completed_at as completedAt FROM progress_nodes WHERE id = $1",
    [taskId]
  );
  const task = rows[0];
  if (!task) throw new Error("Task not found");
  const goalId = "goalId" in owner ? owner.goalId : null;
  const projectId = "projectId" in owner ? owner.projectId : null;
  const result = await db.execute(
    `INSERT INTO progress_nodes
       (project_id, goal_id, short_description, description, reason, is_complete, completed_at, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, 1, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    [projectId, goalId, task.shortDescription, task.description, task.reason, task.completedAt]
  );
  return result.lastInsertId as number;
}

export async function fetchCompletionLogs(): Promise<ProgressNodeCompletion[]> {
  const db = await getDb();
  return db.select<ProgressNodeCompletion[]>(
    `SELECT cl.id, cl.progress_node_id as progressNodeId, pn.short_description as header,
            cl.completed_at as completedAt, cl.duration_minutes as durationMinutes, cl.note
     FROM progress_node_completions cl JOIN progress_nodes pn ON pn.id = cl.progress_node_id
     ORDER BY cl.completed_at DESC`
  );
}

export async function dismissCompletionLog(id: number): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM progress_node_completions WHERE id = $1", [id]);
}
