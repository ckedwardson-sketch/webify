import { useState } from "react";
import { ProgressNode } from "../types/models";
import { useTheme } from "../theme/ThemeContext";
import { categoryBackgroundFor } from "./ProgressGraphNodes";
import { NodeFieldVisibilityPopover } from "./NodeFieldVisibilityPopover";
import { TaskHoldToCompleteButton } from "./TaskHoldToCompleteButton";
import { TaskCooldownStatus } from "../tasks/taskCooldown";
import "./ManagedListRow.css"; // .menu-backdrop / .managed-row-dropdown / .dropdown-item
import "./TaskBoardCard.css";

// Elapsed-vs-goal, both pieces of info in one bar: fill % is how far
// through the time goal we are, the label spells out the actual sizes
// ("2d / 7d"). Red once overdue — this is also how the page decides
// whether a card belongs in the main grid or the Uncompleted column.
function progressInfo(task: ProgressNode): { percent: number; label: string; overdue: boolean } {
  if (!task.taskAddedAt || !task.taskGoalDays) return { percent: 0, label: "", overdue: false };
  const added = new Date(task.taskAddedAt.replace(" ", "T") + "Z").getTime();
  const elapsedDays = (Date.now() - added) / (24 * 60 * 60 * 1000);
  const goalDays = task.taskGoalDays;
  const percent = Math.min(100, Math.max(0, (elapsedDays / goalDays) * 100));
  const overdue = elapsedDays > goalDays;
  const roundedElapsed = Math.max(0, Math.round(elapsedDays * 10) / 10);
  return { percent, label: `${roundedElapsed}d / ${goalDays}d`, overdue };
}

export function TaskBoardCard({
  task,
  onHoldComplete,
  onOpenDetail,
  onDelete,
  onSendToBank,
  onArchive,
  looksOpen,
  onOpenLooks,
  onCloseLooks,
  onUpdateScale,
  onUpdateFavorite,
  onUpdateGlowAmount,
  onUpdateGlowColor,
  cooldown,
  onLinkSkill,
  onUnlinkSkill,
}: {
  task: ProgressNode;
  onHoldComplete: () => void;
  onOpenDetail: () => void;
  onDelete: () => void;
  onSendToBank: () => void;
  onArchive: () => void;
  looksOpen: boolean;
  onOpenLooks: () => void;
  onCloseLooks: () => void;
  onUpdateScale: (percent: number | null) => void;
  onUpdateFavorite: (value: boolean) => void;
  onUpdateGlowAmount: (amount: number | null) => void;
  onUpdateGlowColor: (color: string | null) => void;
  // Only meaningful once linkedSkillTaskId is set — see
  // src/tasks/taskCooldown.ts. Undefined for an unlinked task.
  cooldown?: TaskCooldownStatus;
  onLinkSkill: () => void;
  onUnlinkSkill: () => void;
}) {
  const { theme } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const { percent, label, overdue } = progressInfo(task);
  const grayed = !!cooldown?.grayed;
  const scale = task.webScale ?? 100;
  const style: React.CSSProperties = {
    width: `${(160 * scale) / 100}px`,
    boxShadow: task.favorite
      ? `0 0 ${task.glowAmount ?? 14}px ${task.glowColor ?? "var(--color-accent)"}`
      : undefined,
  };

  return (
    <div
      className={`task-board-card${overdue ? " task-board-card-overdue" : ""}${grayed ? " task-board-card-cooling-down" : ""}`}
      style={style}
      onClick={(e) => {
        if (e.ctrlKey) {
          e.stopPropagation();
          onOpenLooks();
        }
      }}
    >
      <div className="task-board-card-header">
        <button
          type="button"
          className="task-board-card-name"
          onClick={(e) => {
            e.stopPropagation();
            onOpenDetail();
          }}
        >
          {task.shortDescription || "(untitled task)"}
        </button>
        {task.taskMissedCount > 0 && (
          <span className="task-missed-badge" title={`Missed ${task.taskMissedCount} time(s) before`}>
            {task.taskMissedCount}
          </span>
        )}
        <div className="managed-row-menu">
          <button
            type="button"
            className="task-board-card-menu-trigger"
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen((v) => !v);
            }}
            title="Task options"
          >
            ⋮
          </button>
          {menuOpen && (
            <>
              <div className="menu-backdrop" onClick={() => setMenuOpen(false)} />
              <div className="managed-row-dropdown">
                <button
                  type="button"
                  className="dropdown-item"
                  onClick={() => {
                    setMenuOpen(false);
                    onSendToBank();
                  }}
                >
                  Send to task bank
                </button>
                <button
                  type="button"
                  className="dropdown-item"
                  onClick={() => {
                    setMenuOpen(false);
                    onArchive();
                  }}
                >
                  Archive
                </button>
                {task.linkedSkillTaskId == null ? (
                  <button
                    type="button"
                    className="dropdown-item"
                    onClick={() => {
                      setMenuOpen(false);
                      onLinkSkill();
                    }}
                  >
                    Link to skill
                  </button>
                ) : (
                  <button
                    type="button"
                    className="dropdown-item"
                    onClick={() => {
                      setMenuOpen(false);
                      onUnlinkSkill();
                    }}
                  >
                    Unlink skill
                  </button>
                )}
                <button
                  type="button"
                  className="dropdown-item dropdown-item-danger"
                  onClick={() => {
                    setMenuOpen(false);
                    onDelete();
                  }}
                >
                  Delete
                </button>
              </div>
            </>
          )}
        </div>
      </div>
      <div className="task-board-card-progress">
        <div className="task-board-card-progress-track">
          <div className="task-board-card-progress-fill" style={{ width: `${percent}%` }} />
        </div>
        <span className="task-board-card-progress-label">{label}</span>
      </div>
      <TaskHoldToCompleteButton
        onComplete={onHoldComplete}
        background={categoryBackgroundFor(theme, task.categories)}
        disabled={grayed}
        disabledLabel={cooldown?.label ?? undefined}
      />
      {looksOpen && (
        <NodeFieldVisibilityPopover
          title={task.shortDescription || "Task"}
          onClose={onCloseLooks}
          looks={{
            scalePercent: task.webScale,
            onScaleChange: onUpdateScale,
            favorite: {
              value: task.favorite,
              onToggle: onUpdateFavorite,
              glowAmount: task.glowAmount,
              onGlowAmountChange: onUpdateGlowAmount,
              glowColor: task.glowColor,
              onGlowColorChange: onUpdateGlowColor,
            },
          }}
        />
      )}
    </div>
  );
}
