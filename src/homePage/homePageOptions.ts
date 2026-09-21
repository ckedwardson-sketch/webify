import { View } from "../types/nav";

// Where the Home page assignment lives in page_settings (see
// db/pageSettings.ts). "section:home" matches the scope-key style the
// other Page Settings entries use, and doubles as the value of the
// "Home Page" entry in Settings > Page Settings' Page dropdown.
export const HOME_PAGE_SCOPE_KEY = "section:home";
export const HOME_PAGE_SETTING_KEY = "homePage";

export interface HomePageOption {
  // Stored in the database — keep stable. Renaming a label is safe,
  // renaming a key silently un-assigns Home for anyone who'd picked it.
  key: string;
  label: string;
  // The view Home renders in place of itself. The current view stays
  // { type: "home" } — only what's drawn inside it changes.
  view: View;
}

// Pages that can stand in as Home. Only top-level section landing
// pages that need no parameters belong here (detail pages need an id).
// Notes is left out on purpose: its dual-pane mode re-renders the
// current view on the right, which would nest a second Notes inside it.
export const HOME_PAGE_OPTIONS: HomePageOption[] = [
  { key: "checklist-home", label: "Checklist", view: { type: "checklist-home" } },
  { key: "quick-apps-home", label: "Quick Apps", view: { type: "quick-apps-home" } },
  { key: "dreams-web", label: "Dreams", view: { type: "dreams-web" } },
  { key: "goals-home", label: "Goals", view: { type: "goals-home" } },
  { key: "projects-home", label: "Projects", view: { type: "projects-home" } },
  { key: "skills-home", label: "Skills", view: { type: "skills-home" } },
  { key: "recipes-home", label: "Recipes", view: { type: "recipes-home" } },
  { key: "responsibilities-home", label: "Responsibilities", view: { type: "responsibilities-home" } },
  { key: "tasks-home", label: "Tasks", view: { type: "tasks-home" } },
];

// Unknown or stale keys (an option that was later removed) resolve to
// undefined, which Home treats the same as "not assigned".
export function findHomePageOption(key: string | null | undefined): HomePageOption | undefined {
  if (!key) return undefined;
  return HOME_PAGE_OPTIONS.find((o) => o.key === key);
}
