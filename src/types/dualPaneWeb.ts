// Dual-Pane Web Mode — types for the right pane's content.
//
// Deliberately NOT `View`-based (unlike Notes' dual-pane, which reuses
// `View` directly for its right pane) — the switch-decision logic in
// App.tsx needs cheap equality checks ("is the right pane already
// showing this goal's web") against a small, exhaustively-checkable
// set, not defensive handling of every unrelated View case.
//
// No "dreams-web" kind: Dreams is out of scope for this feature.
// DreamWebPage renders one single global graph today (no per-dream
// scoping exists), so "a project's web" can only ever mean its linked
// goal's Goal Web — a project with no linked goal has no web here.

import { View } from "./nav";

export type WebIntegratedSection = "Projects" | "Goals" | "Recipes";

export type WebPaneContent =
  | { kind: "empty" }
  | { kind: "goal-web"; goalId: number }
  | { kind: "recipes-graph"; categoryId?: number; categoryName?: string };

export interface WebPaneMemory {
  Projects: WebPaneContent | null; // in practice always {kind:"goal-web"} or null
  Goals: WebPaneContent | null;
  Recipes: WebPaneContent | null;
}

export const EMPTY_WEB_PANE_MEMORY: WebPaneMemory = {
  Projects: null,
  Goals: null,
  Recipes: null,
};

export function sameWebPaneContent(a: WebPaneContent, b: WebPaneContent): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === "goal-web" && b.kind === "goal-web") return a.goalId === b.goalId;
  if (a.kind === "recipes-graph" && b.kind === "recipes-graph") return a.categoryId === b.categoryId;
  return true; // both "empty"
}

export function webPaneContentToView(content: WebPaneContent): View | null {
  switch (content.kind) {
    case "empty":
      return null;
    case "goal-web":
      return { type: "goal-web", goalId: content.goalId };
    case "recipes-graph":
      return { type: "recipes-graph", categoryId: content.categoryId, categoryName: content.categoryName };
  }
}
