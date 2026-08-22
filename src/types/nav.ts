// src/types/nav.ts
export type View =
  | { type: "home" }
  | { type: "placeholder"; label: string }
  | { type: "recipes-home" }
  | { type: "recipes-graph"; categoryId?: number; categoryName?: string }
  | { type: "recipes-category"; categoryId: number; categoryName: string }
  | {
      type: "recipe-detail";
      categoryId: number;
      categoryName: string;
      recipeId: number;
    }
  | { type: "settings-home" }
  | { type: "settings-icons"; focusKey?: string }
  | { type: "settings-text"; focusKey?: string }
  | { type: "settings-buttons"; focusKey?: string }
  | { type: "settings-theme"; focusKey?: string };
