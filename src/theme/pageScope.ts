import { View } from "../types/nav";

// Which views carry their own independently-colorable page background
// (see PageBackgroundContext) and what identifies that specific page —
// not the view *type* (that would be shared by every project) but this
// one entity's id, so Color Mode overrides stay per-page. Views not
// listed here have no per-page surface to tag; ctrl+hover there only
// ever hits the global Color Mode targets (page/sidebar/field).
//
// Section-level views (a "section:*" key) are the exception: there's
// no single entity to scope to (e.g. the Projects home page lists many
// projects), so every visit to that view type shares one background —
// this is what lets an AI/user give each top-level section (Dreams,
// Goals, Projects, Recipes, Responsibilities, Skills, Notes) its own
// distinct page background image, independent of the others.
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
    case "projects-home":
      return "section:projects-home";
    case "goals-home":
      return "section:goals-home";
    case "goal-web":
      return "section:goal-web";
    case "dreams-web":
      return "section:dreams-web";
    case "recipes-home":
      return "section:recipes-home";
    case "recipes-graph":
      return "section:recipes-graph";
    case "responsibilities-home":
      return "section:responsibilities-home";
    case "skills-home":
      return "section:skills-home";
    case "notes":
      return "section:notes";
    default:
      return null;
  }
}
