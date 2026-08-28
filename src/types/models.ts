// src/types/models.ts
export interface Category {
  id: number;
  name: string;
  sortOrder?: number;
}

export interface Recipe {
  id: number;
  categoryId: number;
  name: string;
  instructions?: string;
  sortOrder?: number;
  imageData?: string; // base64 data URL for the cover image
  isFrozen?: boolean;
  isHomegrown?: boolean;
  isFavorite?: boolean;
  isProven?: boolean; // true = proven (green), false = unproven (gray)
  parentRecipeId?: number; // for iterations
  iterationDifference?: string;
  displayId?: string; // 5-digit human-facing id, immutable after creation
  createdAt?: string;
  updatedAt?: string; // auto-maintained by a DB trigger on content edits, not sort_order
}

export interface FilterState {
  frozen: boolean;
  homegrown: boolean;
  favorite: boolean;
  proven: boolean;
  unproven: boolean;
  excludeMode: boolean;
}

export type DreamPriority = "low" | "medium" | "high";

export interface Dream {
  id: number;
  name: string;
  reasoning: string;
  // A range, not a point — exact for near-term dreams (start === end),
  // wider for far-off ones (e.g. a whole month or year) since those
  // genuinely can't be pinned to a single day.
  expectedDateStart?: string; // ISO date (yyyy-mm-dd)
  expectedDateEnd?: string; // ISO date (yyyy-mm-dd)
  priority: DreamPriority;
  notes: string;
  posX: number; // free-drag only when undated; date-derived otherwise
  posY: number; // always free-drag
  isAsleep: boolean;
  sleepUntil?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DreamLink {
  id: number;
  sourceDreamId: number;
  targetDreamId: number;
  // Rotational anchor points (degrees, 0-360, clockwise from the node's
  // top/12-o'clock) — where on each end's node boundary the link
  // visually connects, recomputed against whatever shape that node
  // currently has (see theme/nodeBoundary.ts). Null = not recorded
  // (legacy link), falls back to a default angle.
  sourceAngle: number | null;
  targetAngle: number | null;
}

export type DreamHistoryField = "name" | "reasoning" | "expectedDate" | "priority" | "notes" | "sleep";

export interface DreamHistoryEntry {
  id: number;
  dreamId: number;
  field: DreamHistoryField;
  oldValue: string | null;
  newValue: string | null;
  reason: string | null;
  changedAt: string;
}

// Tasks — a free-form set of individual pieces of work ("dots"), each
// colored by what kind of work it is and sized by how big a bite it is.
// Rendered directly on Goal Web now (see GoalWebPage.tsx) rather than a
// separate Progress Web screen. Baseline only: no dependency/ordering
// logic between nodes yet — that's meant to layer on top of this later.
export type ProgressCategory = "labor" | "purchase" | "design" | "conceive" | "task";

// Drives node size on the web — a rough "how big a bite is this" signal
// rather than a precise time estimate.
export type ProgressDifficulty = "quick" | "moderate" | "involved" | "major";

export interface ProgressNode {
  id: number;
  // A task belongs to exactly one of projectId/goalId — never both,
  // never neither (mirrors ProjectWidget's dual ownership). A task
  // attached directly to a goal (no project layer) is the "some goals
  // only need tasks, not a whole project" case.
  projectId: number | null;
  goalId: number | null;
  category: ProgressCategory;
  shortDescription: string; // shown on the node itself
  description: string; // full description, shown on the detail page
  difficulty: ProgressDifficulty;
  reason: string;
  instructions: string;
  imageData?: string; // completion evidence — shown on the node once set
  isComplete: boolean;
  isRead: boolean; // cleared on creation/edit, set when the detail page is opened
  posX: number;
  posY: number;
  createdAt?: string;
  updatedAt?: string;
}
