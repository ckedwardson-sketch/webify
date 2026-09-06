import { EdgeProps, Handle, NodeProps, Position } from "@xyflow/react";
import { SkillGoal, SkillTask, SkillWorkLog, WorkType, RingPalette, SkillTreeDirection } from "../types/skill";
import "./SkillTreeNodes.css";

// ---- Goal node ---------------------------------------------------

export interface GoalNodeData {
  goal: SkillGoal;
  onOpen: (goalId: number) => void;
  direction: SkillTreeDirection;
  [key: string]: unknown;
}

export function SkillGoalNodeView({ data }: NodeProps) {
  const { goal, onOpen, direction } = data as unknown as GoalNodeData;
  const vertical = direction === "vertical";
  const cls = [
    "skill-goal-node",
    `status-${goal.status}`,
    goal.isActive ? "is-active" : "",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <div className={cls} onClick={() => onOpen(goal.id)}>
      <Handle type="target" position={vertical ? Position.Top : Position.Left} style={{ opacity: 0 }} />
      {goal.status === "completed" && <span className="skill-goal-badge">✓</span>}
      {goal.isActive && goal.status === "active" && <span className="skill-goal-pulse" />}
      <div className="skill-goal-name">{goal.name}</div>
      {goal.completionImage && goal.status === "completed" && (
        <img className="skill-goal-thumb" src={goal.completionImage} alt="" />
      )}
      <Handle type="source" position={vertical ? Position.Bottom : Position.Right} style={{ opacity: 0 }} />
    </div>
  );
}

// ---- Holographic add-control node ---------------------------------------------------

export interface AddControlData {
  label: string;
  onClick: () => void;
  [key: string]: unknown;
}

export function AddControlNodeView({ data }: NodeProps) {
  const { label, onClick } = data as unknown as AddControlData;
  return (
    <button className="skill-add-control" onClick={onClick}>
      + {label}
    </button>
  );
}

// ---- Task node ---------------------------------------------------

const WORK_TYPE_ICON: Record<WorkType, string> = {
  labor: "🔨",
  research: "📚",
  simple_work: "✅",
  enjoyable_work: "✨",
};

function ringColor(palette: RingPalette, workType: WorkType, index: number): string {
  const palettes: Record<RingPalette, Record<WorkType, string[]>> = {
    classic: {
      labor: ["#8a5a2f", "#a5713f", "#c08a52"],
      research: ["#2f5d8a", "#3f75a5", "#528ac0"],
      simple_work: ["#3f8a4d", "#52a563", "#6bc07d"],
      enjoyable_work: ["#8a2f6f", "#a53f89", "#c052a5"],
    },
    gradient: {
      labor: ["#3b2412", "#7a4a20", "#c98a3f", "#f2c07a"],
      research: ["#0d2b40", "#1a5478", "#2f86b8", "#7fc4ea"],
      simple_work: ["#0f3d1f", "#1f7a3d", "#3fb85e", "#8fe0a2"],
      enjoyable_work: ["#3a0d33", "#731a66", "#b82fa0", "#e07fd4"],
    },
    vivid: {
      labor: ["#ff6b00", "#ff8c33", "#ffad66"],
      research: ["#00b4ff", "#33c6ff", "#66d8ff"],
      simple_work: ["#00e05e", "#33e880", "#66f0a2"],
      enjoyable_work: ["#ff2fd0", "#ff5fdb", "#ff8fe6"],
    },
    contrast: {
      labor: ["#111111", "#e0a800", "#111111", "#e0a800"],
      research: ["#111111", "#00b4d8", "#111111", "#00b4d8"],
      simple_work: ["#111111", "#2ecc71", "#111111", "#2ecc71"],
      enjoyable_work: ["#111111", "#e91e8c", "#111111", "#e91e8c"],
    },
  };
  const colors = palettes[palette][workType];
  return colors[index % colors.length];
}

export interface TaskNodeData {
  task: SkillTask;
  logs: SkillWorkLog[];
  palette: RingPalette;
  editMode: boolean;
  onOpen: (taskId: number) => void;
  onLogWork: (taskId: number) => void;
  [key: string]: unknown;
}

// Work rings: one ring per logged session, newest on the outside, ring
// thickness proportional to that session's duration — deliberately not a
// percentage/progress-bar (see plan section 20).
export function SkillTaskNodeView({ data }: NodeProps) {
  const { task, logs, palette, onOpen, onLogWork } = data as unknown as TaskNodeData;
  const sorted = [...logs].sort((a, b) => a.loggedDate.localeCompare(b.loggedDate) || a.id - b.id);
  const maxRings = 8; // oldest sessions still count toward total but stop adding visible ring width past this
  const visible = sorted.slice(-maxRings);
  let radius = 26;
  const rings = visible.map((log, i) => {
    const thickness = Math.max(3, Math.min(14, Math.sqrt(log.durationMinutes) * 1.6));
    const r = radius;
    radius += thickness;
    return (
      <div
        key={log.id}
        className="skill-task-ring"
        style={{
          width: r * 2,
          height: r * 2,
          left: -r,
          top: -r,
          border: `${thickness}px solid ${ringColor(palette, task.workType, i)}`,
        }}
        title={`${log.loggedDate} — ${log.durationMinutes}m`}
      />
    );
  });
  const lastWorked = sorted.length > 0 ? sorted[sorted.length - 1].loggedDate : null;

  return (
    <div className={`skill-task-node${task.archived ? " archived" : ""}`}>
      <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />
      <div className="skill-task-visual">
        <div className="skill-task-rings-wrap">{rings}</div>
        <div className="skill-task-core" onClick={() => onOpen(task.id)}>
          <span className="skill-task-icon">{WORK_TYPE_ICON[task.workType]}</span>
        </div>
      </div>
      <div className="skill-task-label" onClick={() => onOpen(task.id)}>
        <div className="skill-task-name">{task.name}</div>
        <div className="skill-task-meta">{lastWorked ? `Last: ${lastWorked}` : "Never worked"}</div>
      </div>
      <button className="skill-task-log-btn" onClick={() => onLogWork(task.id)}>
        Log Work
      </button>
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
    </div>
  );
}

// ---- Bent edge — the Skill Tree's signature look, distinct from Dream
// Web's radial AngleEdge: a horizontal run out of the source, then a
// vertical jog, then straight into the target (see plan section 12). ----

export interface BentEdgeData {
  historical?: boolean;
  bendDistance: number;
  direction?: SkillTreeDirection;
  [key: string]: unknown;
}

export function SkillTreeBentEdge({ sourceX, sourceY, targetX, targetY, data }: EdgeProps) {
  const { historical, bendDistance, direction } = (data as unknown as BentEdgeData) ?? { bendDistance: 40 };
  const path =
    direction === "vertical"
      ? (() => {
          const bend = Math.max(12, Math.min(bendDistance ?? 40, Math.abs(targetY - sourceY) - 4));
          const bendY = sourceY + bend;
          return `M ${sourceX},${sourceY} V ${bendY} H ${targetX} V ${targetY}`;
        })()
      : (() => {
          const bend = Math.max(12, Math.min(bendDistance ?? 40, Math.abs(targetX - sourceX) - 4));
          const bendX = sourceX + bend;
          return `M ${sourceX},${sourceY} H ${bendX} V ${targetY} H ${targetX}`;
        })();
  return (
    <path
      d={path}
      fill="none"
      className={`skill-tree-edge${historical ? " historical" : ""}`}
    />
  );
}
