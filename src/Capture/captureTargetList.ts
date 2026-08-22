import { View } from "../types/nav";
import { fetchCategories } from "../db/categories";
import { fetchAllRecipesFlat } from "../db/recipes";

export interface CaptureTarget {
  key: string;
  label: string;
  group: "App Pages" | "Categories" | "Recipes";
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

  return targets;
}
