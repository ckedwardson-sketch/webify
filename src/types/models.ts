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
