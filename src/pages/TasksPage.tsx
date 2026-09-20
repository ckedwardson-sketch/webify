import { useEffect, useState } from "react";
import { View } from "../types/nav";
import { ProgressNode, ProgressNodeCompletion } from "../types/models";
import {
  fetchBoardTasks,
  fetchBankTasks,
  fetchCompletedTasks,
  fetchArchivedTasks,
  fetchLinkableTasks,
  addQuickTask,
  linkIntoBank,
  kickFromBank,
  sendTaskToBoard,
  sendBoardTaskToBank,
  archiveTask,
  restoreArchivedTaskToBank,
  restoreArchivedTaskToBoard,
  setCompletionImage,
  linkCompletedTaskToWeb,
  dismissCompletedTask,
  deleteTask,
  linkTaskToSkillTask,
  unlinkTaskFromSkillTask,
  fetchSkillTaskCooldowns,
  logSkillTaskCompletion,
  fetchCompletionLogs,
  dismissCompletionLog,
} from "../db/tasksBoard";
import {
  updateProgressWebScale,
  updateProgressFavorite,
  updateProgressGlowAmount,
  updateProgressGlowColor,
  setProgressComplete,
} from "../db/progress";
import { TaskCooldownStatus, taskCooldownStatus } from "../tasks/taskCooldown";
import { TaskCooldownType } from "../types/skill";
import { TaskBoardCard } from "../components/TaskBoardCard";
import { TaskCompletionImageModal } from "../components/TaskCompletionImageModal";
import { TaskQuickAddModal } from "../components/TaskQuickAddModal";
import { TaskDaysPromptModal } from "../components/TaskDaysPromptModal";
import { TaskArchiveReasonModal } from "../components/TaskArchiveReasonModal";
import { TaskLinkToWebModal } from "../components/TaskLinkToWebModal";
import { TaskLinkPickerModal } from "../components/TaskLinkPickerModal";
import { TaskQuickViewOverlay } from "../components/TaskQuickViewOverlay";
import { TaskCategoryKeyPopover } from "../components/TaskCategoryKeyPopover";
import { TaskSkillLinkModal } from "../components/TaskSkillLinkModal";
import { TaskWorkLogModal } from "../components/TaskWorkLogModal";
import { ConfirmDeleteIconButton } from "../components/ConfirmDeleteIconButton";
import { usePageBackground, pageSurfaceStyle } from "../theme/PageBackgroundContext";
import "./Page.css";
import "./TasksPage.css";

function isOverdue(task: ProgressNode): boolean {
  if (!task.taskDueAt) return false;
  return new Date(task.taskDueAt.replace(" ", "T") + "Z").getTime() < Date.now();
}

// "13 Sep" — no year, kept short so the Completed list doesn't clutter.
function formatShortDate(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso.replace(" ", "T") + "Z");
  return date.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

export function TasksPage({ onNavigate }: { onNavigate: (view: View) => void }) {
  const { overrides: pageBgOverrides } = usePageBackground();
  const [board, setBoard] = useState<ProgressNode[]>([]);
  const [bank, setBank] = useState<ProgressNode[]>([]);
  const [completed, setCompleted] = useState<ProgressNode[]>([]);
  const [archived, setArchived] = useState<ProgressNode[]>([]);
  const [loading, setLoading] = useState(true);

  const [looksTargetId, setLooksTargetId] = useState<number | null>(null);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [showLinkPicker, setShowLinkPicker] = useState(false);
  const [linkCandidates, setLinkCandidates] = useState<ProgressNode[]>([]);
  const [daysPromptFor, setDaysPromptFor] = useState<number | null>(null);
  const [restoreToBoardId, setRestoreToBoardId] = useState<number | null>(null);
  const [archiveTargetId, setArchiveTargetId] = useState<number | null>(null);
  const [addPhotoTargetId, setAddPhotoTargetId] = useState<number | null>(null);
  const [linkToWebTaskId, setLinkToWebTaskId] = useState<number | null>(null);
  const [pendingCompletionId, setPendingCompletionId] = useState<number | null>(null);
  const [quickViewTask, setQuickViewTask] = useState<ProgressNode | null>(null);
  const [skillLinkTargetId, setSkillLinkTargetId] = useState<number | null>(null);
  const [workLogTarget, setWorkLogTarget] = useState<ProgressNode | null>(null);
  const [completionLogs, setCompletionLogs] = useState<ProgressNodeCompletion[]>([]);
  const [cooldowns, setCooldowns] = useState<Map<number, { type: TaskCooldownType; hours: number }>>(new Map());

  const load = async () => {
    const [b, k, c, a, logs] = await Promise.all([
      fetchBoardTasks(),
      fetchBankTasks(),
      fetchCompletedTasks(),
      fetchArchivedTasks(),
      fetchCompletionLogs(),
    ]);
    setBoard(b);
    setBank(k);
    setCompleted(c);
    setArchived(a);
    setCompletionLogs(logs);
    const linkedSkillTaskIds = b
      .map((t) => t.linkedSkillTaskId)
      .filter((id): id is number => id != null);
    setCooldowns(await fetchSkillTaskCooldowns(linkedSkillTaskIds));
    setLoading(false);
  };

  const cooldownFor = (task: ProgressNode): TaskCooldownStatus | undefined => {
    if (task.linkedSkillTaskId == null) return undefined;
    return taskCooldownStatus(task.taskLastCompletedAt, cooldowns.get(task.linkedSkillTaskId) ?? null);
  };

  useEffect(() => {
    load();
  }, []);

  const activeBoard = board.filter((t) => !isOverdue(t));
  const uncompletedBoard = board.filter((t) => isOverdue(t));

  const handleQuickAdd = async (
    header: string,
    description: string,
    reason: string,
    days: number,
    owner: { goalId: number } | { projectId: number } | undefined
  ) => {
    await addQuickTask(header, description, reason, days, owner);
    setShowQuickAdd(false);
    load();
  };

  const handleOpenLinkPicker = async () => {
    setLinkCandidates(await fetchLinkableTasks());
    setShowLinkPicker(true);
  };

  const handleLink = async (ids: number[]) => {
    await Promise.all(ids.map((id) => linkIntoBank(id)));
    setShowLinkPicker(false);
    load();
  };

  // A standalone bank task has no project/goal to fall back to, so
  // "kick" (which just detaches from the Tasks system) would orphan it
  // invisibly — delete it outright instead.
  const handleKick = async (task: ProgressNode) => {
    if (task.taskIsStandalone) await deleteTask(task.id);
    else await kickFromBank(task.id);
    load();
  };

  const handleSendToBoard = async (id: number, days: number) => {
    await sendTaskToBoard(id, days);
    setDaysPromptFor(null);
    load();
  };

  const handleSendToBank = async (id: number) => {
    await sendBoardTaskToBank(id);
    load();
  };

  const handleConfirmArchive = async (reason: string) => {
    if (archiveTargetId == null) return;
    await archiveTask(archiveTargetId, reason);
    setArchiveTargetId(null);
    load();
  };

  const handleRestoreArchivedToBank = async (id: number) => {
    await restoreArchivedTaskToBank(id);
    load();
  };

  const handleRestoreArchivedToBoard = async (days: number) => {
    if (restoreToBoardId == null) return;
    await restoreArchivedTaskToBoard(restoreToBoardId, days);
    setRestoreToBoardId(null);
    load();
  };

  const handleAddPhoto = async (image: string) => {
    if (addPhotoTargetId == null) return;
    await setCompletionImage(addPhotoTargetId, image);
    setAddPhotoTargetId(null);
    load();
  };

  const handleLinkToWeb = async (owner: { goalId: number } | { projectId: number }) => {
    if (linkToWebTaskId == null) return;
    await linkCompletedTaskToWeb(linkToWebTaskId, owner);
    setLinkToWebTaskId(null);
    load();
  };

  // A skill-linked task logs time/notes instead of the usual
  // completion-image step, and stays on the board — see
  // handleWorkLogSubmit below.
  const handleHoldComplete = (task: ProgressNode) => {
    if (task.linkedSkillTaskId != null) {
      setWorkLogTarget(task);
    } else {
      setPendingCompletionId(task.id);
    }
  };

  const handleWorkLogSubmit = async (minutes: number, note: string | null) => {
    if (!workLogTarget || workLogTarget.linkedSkillTaskId == null) return;
    await logSkillTaskCompletion(workLogTarget.id, workLogTarget.linkedSkillTaskId, minutes, note);
    setWorkLogTarget(null);
    load();
  };

  const handleLinkSkill = async (skillTaskId: number) => {
    if (skillLinkTargetId == null) return;
    await linkTaskToSkillTask(skillLinkTargetId, skillTaskId);
    setSkillLinkTargetId(null);
    load();
  };

  const handleUnlinkSkill = async (id: number) => {
    await unlinkTaskFromSkillTask(id);
    load();
  };

  const handleDismissCompletionLog = async (id: number) => {
    await dismissCompletionLog(id);
    load();
  };

  const handleOpenDetail = (task: ProgressNode) => {
    if (task.taskIsStandalone) {
      setQuickViewTask(task);
    } else {
      onNavigate({
        type: "progress-node-detail",
        nodeId: task.id,
        projectId: task.projectId ?? undefined,
        goalId: task.goalId ?? undefined,
      });
    }
  };

  const finishCompletion = async (image: string | null) => {
    if (pendingCompletionId == null) return;
    if (image) await setCompletionImage(pendingCompletionId, image);
    await setProgressComplete(pendingCompletionId, true);
    setPendingCompletionId(null);
    load();
  };

  const handleDismissCompleted = async (task: ProgressNode) => {
    await dismissCompletedTask(task.id, task.taskIsStandalone);
    load();
  };

  const handleDelete = async (id: number) => {
    await deleteTask(id);
    load();
  };

  if (loading) {
    return (
      <div className="page">
        <p className="page-text">Loading…</p>
      </div>
    );
  }

  return (
    <div className="page" data-color-surface="page-bg" style={pageSurfaceStyle(pageBgOverrides["page-bg"])}>
      <div className="page-header">
        <h1 className="page-title">Tasks</h1>
        <div className="page-header-actions">
          <TaskCategoryKeyPopover />
          <button type="button" className="add-button" onClick={() => setShowQuickAdd(true)}>
            + Daily/Random Task
          </button>
        </div>
      </div>

      <section className="tasks-board-grid">
        {activeBoard.length === 0 ? (
          <p className="page-text">Nothing on the board — send a task here from the bank, or add a daily task.</p>
        ) : (
          activeBoard.map((task) => (
            <TaskBoardCard
              key={task.id}
              task={task}
              onHoldComplete={() => handleHoldComplete(task)}
              onOpenDetail={() => handleOpenDetail(task)}
              onDelete={() => handleDelete(task.id)}
              onSendToBank={() => handleSendToBank(task.id)}
              onArchive={() => setArchiveTargetId(task.id)}
              cooldown={cooldownFor(task)}
              onLinkSkill={() => setSkillLinkTargetId(task.id)}
              onUnlinkSkill={() => handleUnlinkSkill(task.id)}
              looksOpen={looksTargetId === task.id}
              onOpenLooks={() => setLooksTargetId(task.id)}
              onCloseLooks={() => setLooksTargetId(null)}
              onUpdateScale={(percent) => {
                updateProgressWebScale(task.id, percent);
                setBoard((prev) => prev.map((t) => (t.id === task.id ? { ...t, webScale: percent } : t)));
              }}
              onUpdateFavorite={(value) => {
                updateProgressFavorite(task.id, value);
                setBoard((prev) => prev.map((t) => (t.id === task.id ? { ...t, favorite: value } : t)));
              }}
              onUpdateGlowAmount={(amount) => {
                updateProgressGlowAmount(task.id, amount);
                setBoard((prev) => prev.map((t) => (t.id === task.id ? { ...t, glowAmount: amount } : t)));
              }}
              onUpdateGlowColor={(color) => {
                updateProgressGlowColor(task.id, color);
                setBoard((prev) => prev.map((t) => (t.id === task.id ? { ...t, glowColor: color } : t)));
              }}
            />
          ))
        )}
      </section>

      <div className="tasks-columns">
        <section className="tasks-column">
          <div className="tasks-column-header">
            <h2 className="tasks-column-title">Task Bank</h2>
            <button type="button" className="add-button secondary" onClick={handleOpenLinkPicker}>
              + Link Task
            </button>
          </div>
          {bank.length === 0 ? (
            <p className="page-text">Nothing in the bank.</p>
          ) : (
            <ul className="list tasks-bank-list">
              {bank.map((task) => (
                <li key={task.id} className="tasks-bank-row">
                  <button type="button" className="tasks-bank-row-name" onClick={() => handleOpenDetail(task)}>
                    {task.shortDescription || "(untitled task)"}
                  </button>
                  {task.taskMissedCount > 0 && (
                    <span className="task-missed-badge" title={`Missed ${task.taskMissedCount} time(s) before`}>
                      {task.taskMissedCount}
                    </span>
                  )}
                  <div className="tasks-bank-row-actions">
                    <button type="button" className="add-button secondary" onClick={() => setDaysPromptFor(task.id)}>
                      To Board
                    </button>
                    <button type="button" className="add-button secondary" onClick={() => setArchiveTargetId(task.id)}>
                      Archive
                    </button>
                    {!task.taskIsStandalone && (
                      <button type="button" className="add-button secondary" onClick={() => handleKick(task)}>
                        Kick
                      </button>
                    )}
                    <ConfirmDeleteIconButton onConfirm={() => handleDelete(task.id)} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="tasks-column">
          <div className="tasks-column-header">
            <h2 className="tasks-column-title">Uncompleted</h2>
          </div>
          {uncompletedBoard.length === 0 ? (
            <p className="page-text">Nothing overdue.</p>
          ) : (
            <ul className="list tasks-bank-list">
              {uncompletedBoard.map((task) => (
                <li key={task.id} className="tasks-bank-row tasks-bank-row-overdue">
                  <button type="button" className="tasks-bank-row-name" onClick={() => handleOpenDetail(task)}>
                    {task.shortDescription || "(untitled task)"}
                  </button>
                  {task.taskMissedCount > 0 && (
                    <span className="task-missed-badge" title={`Missed ${task.taskMissedCount} time(s) before`}>
                      {task.taskMissedCount}
                    </span>
                  )}
                  <div className="tasks-bank-row-actions">
                    <button type="button" className="add-button secondary" onClick={() => handleSendToBank(task.id)}>
                      To Bank
                    </button>
                    <button type="button" className="add-button secondary" onClick={() => setDaysPromptFor(task.id)}>
                      To Board
                    </button>
                    <button type="button" className="add-button secondary" onClick={() => setArchiveTargetId(task.id)}>
                      Archive
                    </button>
                    <ConfirmDeleteIconButton onConfirm={() => handleDelete(task.id)} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="tasks-completed-section">
        <h2 className="tasks-column-title">Completed</h2>
        {completed.length === 0 && completionLogs.length === 0 ? (
          <p className="page-text">Nothing waiting here.</p>
        ) : (
          <ul className="list tasks-completed-list">
            {completed.map((task) => (
              <li key={`task-${task.id}`} className="tasks-completed-row">
                <span className="tasks-completed-row-name">{task.shortDescription || "(untitled task)"}</span>
                <span className="tasks-completed-row-date">{formatShortDate(task.completedAt)}</span>
                <div className="tasks-bank-row-actions">
                  <button type="button" className="add-button secondary" onClick={() => setAddPhotoTargetId(task.id)}>
                    {task.taskCompletionImage || task.imageData ? "Photo" : "+Photo"}
                  </button>
                  <button type="button" className="add-button secondary" onClick={() => setLinkToWebTaskId(task.id)}>
                    To Web
                  </button>
                  <button type="button" className="add-button secondary" onClick={() => handleDismissCompleted(task)}>
                    Dismiss
                  </button>
                </div>
              </li>
            ))}
            {completionLogs.map((log) => (
              <li key={`log-${log.id}`} className="tasks-completed-row">
                <span className="tasks-completed-row-name">
                  {log.header || "(untitled task)"}
                  {log.durationMinutes != null && ` — ${log.durationMinutes}m`}
                  {log.note && `: ${log.note}`}
                </span>
                <button type="button" className="add-button secondary" onClick={() => handleDismissCompletionLog(log.id)}>
                  Dismiss
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="tasks-archive-section">
        <h2 className="tasks-column-title">Task Archive</h2>
        {archived.length === 0 ? (
          <p className="page-text">Nothing archived.</p>
        ) : (
          <ul className="list tasks-bank-list">
            {archived.map((task) => (
              <li key={task.id} className="tasks-bank-row">
                <div className="tasks-archive-row-body">
                  <button type="button" className="tasks-bank-row-name" onClick={() => handleOpenDetail(task)}>
                    {task.shortDescription || "(untitled task)"}
                  </button>
                  {task.taskArchiveReason && (
                    <span className="tasks-archive-reason">{task.taskArchiveReason}</span>
                  )}
                </div>
                <div className="tasks-bank-row-actions">
                  <button type="button" className="add-button secondary" onClick={() => handleRestoreArchivedToBank(task.id)}>
                    To Bank
                  </button>
                  <button type="button" className="add-button secondary" onClick={() => setRestoreToBoardId(task.id)}>
                    To Board
                  </button>
                  <ConfirmDeleteIconButton onConfirm={() => handleDelete(task.id)} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {showQuickAdd && <TaskQuickAddModal onAdd={handleQuickAdd} onClose={() => setShowQuickAdd(false)} />}
      {showLinkPicker && (
        <TaskLinkPickerModal
          candidates={linkCandidates}
          onLink={handleLink}
          onClose={() => setShowLinkPicker(false)}
        />
      )}
      {daysPromptFor != null && (
        <TaskDaysPromptModal
          title="Send this task to the board"
          onSubmit={(days) => handleSendToBoard(daysPromptFor, days)}
          onClose={() => setDaysPromptFor(null)}
        />
      )}
      {restoreToBoardId != null && (
        <TaskDaysPromptModal
          title="Send this task to the board"
          onSubmit={handleRestoreArchivedToBoard}
          onClose={() => setRestoreToBoardId(null)}
        />
      )}
      {archiveTargetId != null && (
        <TaskArchiveReasonModal
          title="Send this task to the archive"
          onSubmit={handleConfirmArchive}
          onClose={() => setArchiveTargetId(null)}
        />
      )}
      {addPhotoTargetId != null && (
        <TaskCompletionImageModal
          onDone={handleAddPhoto}
          onSkip={() => setAddPhotoTargetId(null)}
        />
      )}
      {linkToWebTaskId != null && (
        <TaskLinkToWebModal onLink={handleLinkToWeb} onClose={() => setLinkToWebTaskId(null)} />
      )}
      {pendingCompletionId != null && (
        <TaskCompletionImageModal
          onDone={(image) => finishCompletion(image)}
          onSkip={() => finishCompletion(null)}
        />
      )}
      {quickViewTask && (
        <TaskQuickViewOverlay
          task={quickViewTask}
          onClose={() => setQuickViewTask(null)}
          onChanged={load}
        />
      )}
      {skillLinkTargetId != null && (
        <TaskSkillLinkModal onLink={handleLinkSkill} onClose={() => setSkillLinkTargetId(null)} />
      )}
      {workLogTarget && (
        <TaskWorkLogModal
          title={`Log work — ${workLogTarget.shortDescription || "Task"}`}
          onSubmit={handleWorkLogSubmit}
          onClose={() => setWorkLogTarget(null)}
        />
      )}
    </div>
  );
}
