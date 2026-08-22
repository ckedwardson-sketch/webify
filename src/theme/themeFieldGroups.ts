import { ThemeSettings } from "./themeDefaults";

export interface ThemeColorField {
  key: keyof ThemeSettings;
  label: string;
}

export interface ThemeColorGroup {
  title: string;
  fields: ThemeColorField[];
}

export const THEME_COLOR_GROUPS: ThemeColorGroup[] = [
  {
    title: "Surfaces",
    fields: [
      { key: "bg", label: "Page background" },
      { key: "bgSecondary", label: "Secondary background" },
      { key: "bgElevated", label: "Card / row background" },
      { key: "border", label: "Border" },
      { key: "borderStrong", label: "Strong border (focus, dividers)" },
    ],
  },
  {
    title: "Text",
    fields: [
      { key: "text", label: "Primary text" },
      { key: "textSecondary", label: "Secondary text" },
    ],
  },
  {
    title: "Sidebar",
    fields: [
      { key: "sidebarBg", label: "Background" },
      { key: "sidebarText", label: "Text" },
      { key: "sidebarTextActive", label: "Active item text" },
      { key: "sidebarHoverBg", label: "Hover background" },
      { key: "sidebarActiveBg", label: "Active item background" },
    ],
  },
  {
    title: "Inputs & Buttons",
    fields: [
      { key: "inputBg", label: "Input background" },
      { key: "inputText", label: "Input text" },
      { key: "primaryBg", label: "Primary button background" },
      { key: "primaryText", label: "Primary button text" },
      { key: "primaryHoverBg", label: "Primary button hover" },
      { key: "accent", label: "Links / accent" },
      { key: "danger", label: "Danger / delete" },
    ],
  },
  {
    title: "Recipe web",
    fields: [
      { key: "webBackground", label: "Web background" },
      { key: "webNodeProvenBackground", label: "Proven recipe node background" },
      { key: "webNodeUnprovenBackground", label: "Unproven recipe node background" },
      { key: "webNodeOutlineColor", label: "Recipe node outline color" },
      { key: "webCategoryNodeBackground", label: "Category node background" },
      { key: "webIterationNodeBackground", label: "Iteration node background" },
    ],
  },
];
