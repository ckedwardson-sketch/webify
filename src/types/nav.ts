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
  | { type: "settings-theme"; focusKey?: string }
  | { type: "settings-editor"; focusKey?: string }
  | { type: "settings-headers"; focusKey?: string }
  | { type: "settings-issues" }
  | { type: "settings-dynamic-search" }
  | { type: "responsibilities-home" }
  | { type: "responsibilities-manage" }
  | { type: "responsibility-detail"; responsibilityId: number }
  | { type: "dreams-web" }
  | { type: "dream-detail"; dreamId: number }
  | { type: "goals-home" }
  | { type: "goal-detail"; goalId: number }
  | { type: "goal-web"; goalId: number }
  | { type: "projects-home" }
  | { type: "project-detail"; projectId: number }
  // Belongs to a project or a goal, never both — same widget system.
  | { type: "project-journal"; widgetId: number; projectId?: number; goalId?: number }
  | { type: "project-board"; widgetId: number; projectId?: number; goalId?: number }
  | { type: "project-table"; widgetId: number; projectId?: number; goalId?: number }
  // Progress Web was retired as its own screen — tasks now render
  // directly on Goal Web (see GoalWebPage.tsx). A task's detail page is
  // still its own route, scoped back to whichever owner it belongs to
  // (exactly one of projectId/goalId, same dual-ownership rule as the
  // task itself) so "back" can return to the right Goal Web.
  | { type: "progress-node-detail"; nodeId: number; projectId?: number; goalId?: number }
  | { type: "notes"; pageId?: number };
