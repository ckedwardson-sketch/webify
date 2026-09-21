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
  | { type: "settings-mobile" }
  | { type: "settings-lockscreen" }
  | { type: "settings-editor"; focusKey?: string }
  | { type: "settings-headers"; focusKey?: string }
  | { type: "settings-issues" }
  | { type: "settings-context-capture" }
  // Three tabs: wifi sync, automatic backups, one-off DB download.
  | { type: "settings-sync"; tab?: "sync" | "cloud-backups" | "db-download" }
  | { type: "settings-widget-visibility"; focusKey?: string }
  | { type: "settings-panel-memory"; focusKey?: string }
  | { type: "settings-dynamic-search" }
  | { type: "settings-page-settings"; focusKey?: string }
  | { type: "responsibilities-home" }
  | { type: "responsibilities-manage" }
  | { type: "responsibility-detail"; responsibilityId: number }
  | { type: "tasks-home" }
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
  | { type: "notes"; pageId?: number }
  | { type: "vault" }
  | { type: "skills-home" }
  | { type: "skill-tree"; skillId: number }
  | { type: "checklist-home" }
  // Two tabs: the lock screen settings, and the checklist page's own.
  | { type: "checklist-settings"; tab?: "lockscreen" | "page" }
  | { type: "quick-apps-home" }
  | { type: "quick-apps-raft-dog-fullscreen" }
  | { type: "quick-apps-sleep-study" };
