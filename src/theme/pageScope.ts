import { View } from "../types/nav";

// Which views carry their own independently-colorable page background
// (see PageBackgroundContext) and what identifies that specific page —
// not the view *type* (that would be shared by every project) but this
// one entity's id, so Color Mode overrides stay per-page. Views not
// listed here have no per-page surface to tag; ctrl+hover there only
// ever hits the global Color Mode targets (page/sidebar/field).
export function scopeKeyForView(view: View): string | null {
  switch (view.type) {
    case "project-detail":
      return `project:${view.projectId}`;
    case "goal-detail":
      return `goal:${view.goalId}`;
    case "dream-detail":
      return `dream:${view.dreamId}`;
    case "recipe-detail":
      return `recipe:${view.recipeId}`;
    default:
      return null;
  }
}
