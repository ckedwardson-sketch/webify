// src/types/skill.ts
export interface Skill {
  id: number;
  name: string;
  currentLevelName: string;
  createdAt: string;
  updatedAt: string;
}

export interface DreamSkillLink {
  id: number;
  dreamId: number;
  skillId: number;
  posX: number | null;
  posY: number | null;
}

export type SkillGoalStatus = "active" | "completed" | "put_to_bed" | "historical";

export interface SkillGoal {
  id: number;
  skillId: number;
  parentGoalId: number | null;
  name: string;
  description: string;
  reason: string;
  completionImage?: string;
  status: SkillGoalStatus;
  isActive: boolean;
  // Sequential ordering for historical goals only (null for tree goals).
  historyOrder: number | null;
  createdAt: string;
  completedAt?: string;
}

export const WORK_TYPES = ["labor", "research", "simple_work", "enjoyable_work"] as const;
export type WorkType = (typeof WORK_TYPES)[number];

export const WORK_TYPE_LABELS: Record<WorkType, string> = {
  labor: "Labor",
  research: "Research",
  simple_work: "Simple Work",
  enjoyable_work: "Enjoyable Work",
};

export interface SkillTask {
  id: number;
  skillId: number;
  name: string;
  workType: WorkType;
  description: string;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SkillTaskPath {
  id: number;
  taskId: number;
  sourceGoalId: number;
  targetGoalId: number;
  offsetX: number;
  offsetY: number;
}

export interface SkillWorkLog {
  id: number;
  taskId: number;
  loggedDate: string; // ISO date
  durationMinutes: number;
  note?: string;
  createdAt: string;
}

export const RING_PALETTES = ["classic", "gradient", "vivid", "contrast"] as const;
export type RingPalette = (typeof RING_PALETTES)[number];

export type SkillDreamNodeField = "currentLevel" | "nextGoal" | "goalDescription" | "lastWorked";

export type SkillTreeDirection = "horizontal" | "vertical";

export interface SkillSettings {
  skillId: number;
  ringPalette: RingPalette;
  nodeWidth: number;
  nodeHeight: number;
  // "horizontal" (default): depth grows along x (hSpacing), siblings
  // spread along y (branchSpacing) — vSpacing is unused. "vertical":
  // depth grows along y (vSpacing), siblings spread along x
  // (branchSpacing) — hSpacing is unused. See skills/skillLayout.ts.
  direction: SkillTreeDirection;
  hSpacing: number;
  vSpacing: number;
  branchSpacing: number;
  historicalSpacing: number;
  taskOffset: number;
  pathBendDistance: number;
  dreamNodeFields: SkillDreamNodeField[];
  dreamNodeActiveGoalId: number | null;
  // Cooldown for any Tasks-page board task linked to one of this
  // skill's tasks (src/tasks/taskCooldown.ts) — 'daily'/'weekly' reset
  // at the local calendar boundary, 'hours' is a flat duration using
  // taskCooldownHours.
  taskCooldownType: TaskCooldownType;
  taskCooldownHours: number;
}

export const TASK_COOLDOWN_TYPES = ["daily", "weekly", "hours"] as const;
export type TaskCooldownType = (typeof TASK_COOLDOWN_TYPES)[number];

export const DEFAULT_SKILL_SETTINGS: Omit<SkillSettings, "skillId"> = {
  ringPalette: "classic",
  nodeWidth: 180,
  nodeHeight: 64,
  direction: "horizontal",
  hSpacing: 380,
  vSpacing: 140,
  branchSpacing: 170,
  historicalSpacing: 320,
  taskOffset: 90,
  pathBendDistance: 40,
  dreamNodeFields: ["currentLevel", "nextGoal"],
  dreamNodeActiveGoalId: null,
  taskCooldownType: "daily",
  taskCooldownHours: 24,
};
