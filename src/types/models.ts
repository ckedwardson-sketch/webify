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
  // Future Slot — a planning/idea card for a recipe that doesn't exist
  // yet. isFutureSlot is true while it's still in that planning stage;
  // futureSlotOrigin stays true forever once it ever was one, even
  // after "Make it a Real Recipe" flips isFutureSlot back to false, so
  // the inspiration/links it collected stay reachable (just hidden).
  isFutureSlot?: boolean;
  futureSlotOrigin?: boolean;
  inspiration?: string;
  // Links to OUTSIDE recipe pages (a blog post, a recipe site) — not
  // links to other recipes in this app. Clicking one fetches the
  // page's schema.org Recipe data (see src-tauri/src/recipe_extract.rs)
  // and hands the result to the second column per recipeLinkClickMode.
  futureSlotLinks?: FutureSlotLink[];
  // The Future Slot's persistent "second column" — whatever was placed
  // there by a link's replace/instant-place action. Saved like
  // inspiration/instructions; a fresh visit doesn't reset it.
  referenceContent?: string;
  // User-draggable width (px) of this recipe's editor column on desktop —
  // a per-recipe layout preference (see RecipeDetailPage's resize handle).
  editorWidth?: number;
}

export interface FutureSlotLink {
  id: string;
  url: string;
  title?: string; // the fetched page's <title>, falls back to the raw URL
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
  // The portable "Estimated start date" field (see db/fieldLayout.ts) —
  // unset unless the user has added it via rearrange mode's Add-field
  // menu; Project/Goal have always had this, Dream didn't until it
  // became addable everywhere.
  estimatedStartDate?: string;
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
  // A project/goal task belongs to exactly one of projectId/goalId —
  // never both (mirrors ProjectWidget's dual ownership); a task
  // attached directly to a goal (no project layer) is the "some goals
  // only need tasks, not a whole project" case. The one exception is a
  // standalone Tasks-page task (taskIsStandalone true) — neither, since
  // it has no project/goal home at all.
  projectId: number | null;
  goalId: number | null;
  // A checklist, not a single choice — a task can be multiple labor
  // types at once (e.g. both "conceive" and "labor") rather than
  // forcing it to split into separate tasks. Always at least one
  // entry; stored as a comma-separated string in the DB (see
  // db/progress.ts), never empty.
  categories: ProgressCategory[];
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
  cost: number | null; // optional logged cost, shown on completed-task detail/web card if set
  completedAt: string | null; // set when isComplete flips true, cleared when flipped back
  createdAt?: string;
  updatedAt?: string;
  // "Looks" section of NodeFieldVisibilityPopover on Goal Web — a
  // percentage-scale override for the task's dot size on top of
  // whatever difficulty already gives it (see progressNodeSize). Null
  // means 100% (no extra scaling).
  webScale: number | null;
  // Favorite toggle — when true, shows a glowing circular outline
  // around the node (amount/color below), independent of difficulty
  // or category coloring.
  favorite: boolean;
  glowAmount: number | null; // null = default amount
  glowColor: string | null; // null = theme default (accent)
  // Tasks page (src/pages/TasksPage.tsx) fields — see db/database.ts's
  // migration comment. null taskBoardStatus = not part of the Tasks
  // system at all.
  taskBoardStatus: "bank" | "board" | "archive" | null;
  taskIsStandalone: boolean;
  taskAddedAt: string | null;
  taskGoalDays: number | null;
  taskDueAt: string | null;
  taskCompletionImage: string | null;
  // Why the task was archived — asked every time a task is sent to the
  // Task Archive (from the bank, board, or Uncompleted column). Cleared
  // when restored back to the bank/board.
  taskArchiveReason: string | null;
  // How many times this task has been on the board past its due_at
  // without being completed — one per distinct due date, not per day
  // overdue. Shown as a small red badge next to the task's title.
  taskMissedCount: number;
  // Linking to a skill (see db/database.ts's migration comment) — when
  // set, hold-to-complete logs time/notes onto this skill_tasks row
  // instead of the usual completion-image step, and the task itself
  // stays on the board (see taskLastCompletedAt) rather than
  // disappearing.
  linkedSkillTaskId: number | null;
  // Stamped by each skill-linked completion — drives the cooldown/
  // gray-out check (src/tasks/taskCooldown.ts) against the linked
  // skill's settings. Unrelated to completedAt/isComplete, which never
  // change for a skill-linked task.
  taskLastCompletedAt: string | null;
}

// One entry in the Tasks page's Completed section for a skill-linked
// task (src/db/database.ts's progress_node_completions table) — a
// lightweight record of one hold-to-complete, kept separate from the
// task itself since that stays on the board, cooling down, not
// actually completed/removed.
export interface ProgressNodeCompletion {
  id: number;
  progressNodeId: number;
  header: string;
  completedAt: string;
  durationMinutes: number | null;
  note: string | null;
}
