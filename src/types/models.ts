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
