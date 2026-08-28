import { View } from "../types/nav";
import { fetchCategories } from "../db/categories";
import { fetchAllRecipesFlat } from "../db/recipes";
import { fetchDreamGraphData } from "../db/dreams";
import { fetchAllGoals } from "../db/goals";
import { fetchAllProjects } from "../db/projects";
import { fetchResponsibilities } from "../db/responsibilities";

export interface CaptureTarget {
  key: string;
  label: string;
  group: "App Pages" | "Categories" | "Recipes" | "Dreams" | "Goals" | "Projects" | "Responsibilities";
  view: View;
}

export async function buildCaptureTargets(): Promise<CaptureTarget[]> {
  const targets: CaptureTarget[] = [
    { key: "static:home", label: "Home", group: "App Pages", view: { type: "home" } },
    { key: "static:recipes-home", label: "Recipes Home", group: "App Pages", view: { type: "recipes-home" } },
    { key: "static:recipes-web", label: "Recipe Web (full)", group: "App Pages", view: { type: "recipes-graph" } },
    { key: "static:settings-home", label: "Settings Home", group: "App Pages", view: { type: "settings-home" } },
    { key: "static:settings-icons", label: "Settings: Icons", group: "App Pages", view: { type: "settings-icons" } },
    { key: "static:settings-text", label: "Settings: Text Elements", group: "App Pages", view: { type: "settings-text" } },
    { key: "static:settings-buttons", label: "Settings: Buttons", group: "App Pages", view: { type: "settings-buttons" } },
    { key: "static:settings-theme", label: "Settings: Theme", group: "App Pages", view: { type: "settings-theme" } },
    { key: "static:dreams-web", label: "Dream Web", group: "App Pages", view: { type: "dreams-web" } },
    { key: "static:goals-home", label: "Goals Home", group: "App Pages", view: { type: "goals-home" } },
    { key: "static:projects-home", label: "Projects Home", group: "App Pages", view: { type: "projects-home" } },
    { key: "static:responsibilities-home", label: "Responsibilities Home", group: "App Pages", view: { type: "responsibilities-home" } },
    { key: "static:responsibilities-manage", label: "Responsibilities: Manage", group: "App Pages", view: { type: "responsibilities-manage" } },
  ];

  const categories = await fetchCategories();
  for (const cat of categories) {
    targets.push({
      key: `category:${cat.id}`,
      label: `Category: ${cat.name}`,
      group: "Categories",
      view: { type: "recipes-category", categoryId: cat.id, categoryName: cat.name },
    });
  }

  const recipes = await fetchAllRecipesFlat();
  for (const rec of recipes) {
    targets.push({
      key: `recipe:${rec.id}`,
      label: `Recipe: ${rec.name}`,
      group: "Recipes",
      view: {
        type: "recipe-detail",
        categoryId: rec.categoryId,
        categoryName: rec.categoryName,
        recipeId: rec.id,
      },
    });
  }

  const { dreams } = await fetchDreamGraphData();
  for (const dream of dreams) {
    targets.push({
      key: `dream:${dream.id}`,
      label: `Dream: ${dream.name}`,
      group: "Dreams",
      view: { type: "dream-detail", dreamId: dream.id },
    });
  }

  const goals = await fetchAllGoals();
  for (const goal of goals) {
    targets.push({
      key: `goal:${goal.id}`,
      label: `Goal: ${goal.name}`,
      group: "Goals",
      view: { type: "goal-detail", goalId: goal.id },
    });
  }

  const projects = await fetchAllProjects();
  for (const project of projects) {
    targets.push({
      key: `project:${project.id}`,
      label: `Project: ${project.name}`,
      group: "Projects",
      view: { type: "project-detail", projectId: project.id },
    });
  }

  const responsibilities = await fetchResponsibilities();
  for (const resp of responsibilities) {
    targets.push({
      key: `responsibility:${resp.id}`,
      label: `Responsibility: ${resp.name}`,
      group: "Responsibilities",
      view: { type: "responsibility-detail", responsibilityId: resp.id },
    });
  }

  return targets;
}
