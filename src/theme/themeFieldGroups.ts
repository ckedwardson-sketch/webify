import { ThemeSettings } from "./themeDefaults";
import { FONT_PRESETS } from "./fontPresets";

export type ThemeFieldKind = "color" | "select" | "image" | "number";

export interface ThemeColorField {
  key: keyof ThemeSettings;
  label: string;
  kind?: ThemeFieldKind; // default "color"
  options?: { value: string; label: string }[]; // required for "select"
}

export interface ThemeColorGroup {
  title: string;
  fields: ThemeColorField[];
}

const RADIUS_OPTIONS = [
  { value: "sharp", label: "Sharp" },
  { value: "subtle", label: "Subtle (default)" },
  { value: "rounded", label: "Rounded" },
];

const DENSITY_OPTIONS = [
  { value: "compact", label: "Compact" },
  { value: "comfortable", label: "Comfortable (default)" },
];

const CARD_SHADOW_OPTIONS = [
  { value: "none", label: "None" },
  { value: "soft", label: "Soft (default)" },
  { value: "strong", label: "Strong" },
];

const CARD_IMAGE_STYLE_OPTIONS = [
  { value: "boxed", label: "Boxed" },
  { value: "fill", label: "Fill card" },
];

export const THEME_COLOR_GROUPS: ThemeColorGroup[] = [
  {
    title: "Typography & Layout",
    fields: [
      {
        key: "fontFamily",
        label: "Font",
        kind: "select",
        options: FONT_PRESETS.map((f) => ({ value: f.key, label: f.label })),
      },
      { key: "radiusScale", label: "Corner roundness", kind: "select", options: RADIUS_OPTIONS },
      { key: "density", label: "Density / spacing", kind: "select", options: DENSITY_OPTIONS },
    ],
  },
  {
    title: "Surfaces",
    fields: [
      { key: "bg", label: "Page background" },
      { key: "appBackgroundImage", label: "Page background image", kind: "image" },
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
      { key: "webBackgroundImage", label: "Web background image", kind: "image" },
      { key: "webNodeProvenBackground", label: "Proven recipe node background" },
      { key: "webNodeUnprovenBackground", label: "Unproven recipe node background" },
      { key: "webNodeOutlineColor", label: "Recipe node outline color" },
      { key: "webCategoryNodeBackground", label: "Category node background" },
      { key: "webIterationNodeBackground", label: "Iteration node background" },
      { key: "webCardShadow", label: "Recipe card shadow", kind: "select", options: CARD_SHADOW_OPTIONS },
      { key: "webCardRadius", label: "Recipe card corner radius (px)", kind: "number" },
      {
        key: "webCardImageStyle",
        label: "Recipe card image style",
        kind: "select",
        options: CARD_IMAGE_STYLE_OPTIONS,
      },
    ],
  },
];
