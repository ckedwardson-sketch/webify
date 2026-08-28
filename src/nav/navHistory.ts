// Resolves a View to a stable identity key and a human-readable label for
// the user-path history bar (see components/NavHistoryBar.tsx). Distinct
// from the per-page Breadcrumb (Breadcrumb.tsx), which shows entity
// ancestry ("Projects / MyProject / Journal") rather than the sequence of
// pages actually visited.
import { View } from "../types/nav";

export interface PathEntry {
  key: string;
  view: View;
  label: string;
}
import { fetchDream } from "../db/dreams";
import { fetchProject, fetchWidget } from "../db/projects";
import { fetchGoal } from "../db/goals";
import { fetchResponsibility } from "../db/responsibilities";
import { fetchProgressNode } from "../db/progress";
import { fetchRecipe } from "../db/recipes";
import { fetchPage } from "../db/notes";

const STATIC_LABELS: Partial<Record<View["type"], string>> = {
  home: "Home",
  "recipes-home": "Recipes",
  "settings-home": "Settings",
  "settings-icons": "Icons",
  "settings-text": "Text",
  "settings-buttons": "Buttons",
  "settings-theme": "Theme",
  "settings-issues": "Issues",
  "responsibilities-home": "Responsibilities",
  "responsibilities-manage": "Manage",
  "dreams-web": "Dream Web",
  "goals-home": "Goals",
  "projects-home": "Projects",
  notes: "Notes",
};

// Identity for path compaction/dedup purposes — deliberately ignores
// transient params like a settings page's focusKey, which scroll to a
// field rather than describe a distinct page.
export function viewKey(view: View): string {
  switch (view.type) {
    case "placeholder":
      return `placeholder:${view.label}`;
    case "recipes-graph":
      return `recipes-graph:${view.categoryId ?? "all"}`;
    case "recipes-category":
      return `recipes-category:${view.categoryId}`;
    case "recipe-detail":
      return `recipe-detail:${view.recipeId}`;
    case "responsibility-detail":
      return `responsibility-detail:${view.responsibilityId}`;
    case "dream-detail":
      return `dream-detail:${view.dreamId}`;
    case "goal-detail":
      return `goal-detail:${view.goalId}`;
    case "goal-web":
      return `goal-web:${view.goalId}`;
    case "project-detail":
      return `project-detail:${view.projectId}`;
    case "project-journal":
      return `project-journal:${view.widgetId}`;
    case "project-board":
      return `project-board:${view.widgetId}`;
    case "project-table":
      return `project-table:${view.widgetId}`;
    case "progress-node-detail":
      return `progress-node-detail:${view.nodeId}`;
    case "notes":
      return `notes:${view.pageId ?? "root"}`;
    default:
      return view.type;
  }
}

export function staticLabel(view: View): string {
  if (view.type === "placeholder") return view.label;
  if (view.type === "recipes-graph") return view.categoryName ?? "All Recipes";
  if (view.type === "recipes-category") return view.categoryName;
  return STATIC_LABELS[view.type] ?? view.type;
}

// Looks up the real entity name for detail-style views (falls back to the
// static label — and swallows lookup errors the same way — when there's
// nothing to fetch, or the fetch fails).
export async function resolveLabel(view: View): Promise<string> {
  try {
    switch (view.type) {
      case "recipe-detail": {
        const r = await fetchRecipe(view.recipeId);
        return r?.name ?? "Recipe";
      }
      case "responsibility-detail": {
        const r = await fetchResponsibility(view.responsibilityId);
        return r?.name ?? "Responsibility";
      }
      case "dream-detail": {
        const d = await fetchDream(view.dreamId);
        return d?.name ?? "Dream";
      }
      case "goal-detail": {
        const g = await fetchGoal(view.goalId);
        return g?.name ?? "Goal";
      }
      case "goal-web": {
        const g = await fetchGoal(view.goalId);
        return g ? `${g.name} Web` : "Goal Web";
      }
      case "project-detail": {
        const p = await fetchProject(view.projectId);
        return p?.name ?? "Project";
      }
      case "project-journal":
      case "project-board":
      case "project-table": {
        const w = await fetchWidget(view.widgetId);
        return w?.title ?? "Widget";
      }
      case "progress-node-detail": {
        const n = await fetchProgressNode(view.nodeId);
        return n?.shortDescription ?? "Task";
      }
      case "notes": {
        if (view.pageId == null) return "Notes";
        const p = await fetchPage(view.pageId);
        return p?.title ?? "Note";
      }
      default:
        return staticLabel(view);
    }
  } catch {
    return staticLabel(view);
  }
}
