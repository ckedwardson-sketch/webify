import { ThemeSettings } from "./themeDefaults";
import { FONT_PRESETS } from "./fontPresets";
import { SURFACE_PRESETS } from "./surfacePresets";
import { HEADING_PRESETS } from "./headingPresets";
import { BACKGROUND_PRESETS } from "./backgroundPresets";
import { MOTION_PRESETS } from "./motionPresets";
import { NODE_SHAPE_OPTIONS } from "./nodeShapes";

export type ThemeFieldKind = "color" | "select" | "image" | "number" | "code";

export interface ThemeColorField {
  key: keyof ThemeSettings;
  label: string;
  kind?: ThemeFieldKind; // default "color"
  options?: { value: string; label: string }[]; // required for "select"
  placeholder?: string; // used by "code"
  help?: string; // short explanatory line shown under a "code" field
  // "number" only — defaults to 0/60/1 (webCardRadius's range) when unset.
  min?: number;
  max?: number;
  step?: number;
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

const NAV_LAYOUT_OPTIONS = [
  { value: "left", label: "Sidebar, left (default)" },
  { value: "right", label: "Sidebar, right" },
  { value: "top", label: "Top navigation bar" },
];

const MOBILE_MODE_OPTIONS = [
  { value: "auto", label: "Auto — follow window size (default)" },
  { value: "on", label: "Always on — force mobile layout" },
  { value: "off", label: "Always off — force desktop layout" },
];

const SURFACE_STYLE_LABELS: Record<string, string> = {
  bordered: "Bordered (default)",
  flat: "Flat — no border or shadow",
  elevated: "Elevated — drop shadow",
  glass: "Glass — blurred, translucent",
};
const SURFACE_STYLE_OPTIONS = Object.keys(SURFACE_PRESETS).map((value) => ({
  value,
  label: SURFACE_STYLE_LABELS[value] ?? value,
}));

const HEADING_STYLE_LABELS: Record<string, string> = {
  default: "Default — matches body font",
  editorial: "Editorial — uppercase serif",
  "mono-technical": "Mono / Technical",
  "soft-rounded": "Soft & Rounded",
};
const HEADING_STYLE_OPTIONS = Object.keys(HEADING_PRESETS).map((value) => ({
  value,
  label: HEADING_STYLE_LABELS[value] ?? value,
}));

const BACKGROUND_STYLE_LABELS: Record<string, string> = {
  solid: "Solid (default)",
  gradient: "Soft gradient glow",
  grid: "Grid lines",
  dotted: "Dot grid",
  noise: "Diagonal hatch",
};
const BACKGROUND_STYLE_OPTIONS = Object.keys(BACKGROUND_PRESETS).map((value) => ({
  value,
  label: BACKGROUND_STYLE_LABELS[value] ?? value,
}));

const MOTION_STYLE_LABELS: Record<string, string> = {
  none: "None — instant, no hover motion",
  subtle: "Subtle (default)",
  lively: "Lively — bouncy hover lift",
};
const MOTION_STYLE_OPTIONS = Object.keys(MOTION_PRESETS).map((value) => ({
  value,
  label: MOTION_STYLE_LABELS[value] ?? value,
}));

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
    title: "Big layout & feel",
    fields: [
      { key: "navLayout", label: "Navigation position", kind: "select", options: NAV_LAYOUT_OPTIONS },
      { key: "mobileMode", label: "Mobile layout", kind: "select", options: MOBILE_MODE_OPTIONS },
      { key: "sidebarWidth", label: "Sidebar width (px)", kind: "number", min: 140, max: 400, step: 5 },
      {
        key: "pageMaxWidth",
        label: "Page reading width (px)",
        kind: "number",
        min: 400,
        max: 1400,
        step: 10,
      },
      {
        key: "pageTitleSize",
        label: "Page heading size (rem)",
        kind: "number",
        min: 1,
        max: 3.5,
        step: 0.1,
      },
      {
        key: "surfaceStyle",
        label: "Surface style (buttons, cards, rows)",
        kind: "select",
        options: SURFACE_STYLE_OPTIONS,
      },
      { key: "headingStyle", label: "Heading voice", kind: "select", options: HEADING_STYLE_OPTIONS },
      {
        key: "backgroundStyle",
        label: "Background atmosphere",
        kind: "select",
        options: BACKGROUND_STYLE_OPTIONS,
      },
      { key: "motionStyle", label: "Motion", kind: "select", options: MOTION_STYLE_OPTIONS },
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
      { key: "webCardShape", label: "Recipe card shape", kind: "select", options: NODE_SHAPE_OPTIONS },
    ],
  },
  {
    title: "Progress web",
    fields: [
      { key: "progressWebBackground", label: "Web background" },
      { key: "progressLaborColor", label: "Labor" },
      { key: "progressPurchaseColor", label: "Purchase" },
      { key: "progressDesignColor", label: "Design" },
      { key: "progressConceiveColor", label: "Conceive" },
      { key: "progressTaskColor", label: "Task" },
    ],
  },
  {
    title: "Dream web",
    fields: [
      { key: "dreamWebBackground", label: "Web background" },
      { key: "dreamWebBackgroundImage", label: "Web background image", kind: "image" },
      { key: "dreamNodeBackground", label: "Dream node background" },
      { key: "dreamNodeOutlineColor", label: "Dream node outline color" },
      { key: "dreamLinkColor", label: "Link line color" },
      { key: "dreamPriorityLow", label: "Low priority color" },
      { key: "dreamPriorityMedium", label: "Medium priority color" },
      { key: "dreamPriorityHigh", label: "High priority color" },
      {
        key: "dreamNodeShape",
        label: "Dream / project node shape",
        kind: "select",
        options: NODE_SHAPE_OPTIONS,
      },
    ],
  },
  {
    title: "Advanced",
    fields: [
      {
        key: "customCss",
        label: "Custom CSS",
        kind: "code",
        placeholder: ".page-title { letter-spacing: 0.08em; }",
        help: "Injected last, after every other theme rule — this can override anything above.",
      },
      {
        key: "recipeThemeOverrides",
        label: "Recipes palette override",
        kind: "code",
        placeholder: '{"bg": "#fffaf0", "accent": "#c2410c"}',
        help: 'JSON of any color keys from "Surfaces" / "Text" / "Sidebar" / "Inputs & Buttons" above — only set keys change, everything else still follows the global theme. Leave empty to inherit it everywhere.',
      },
      {
        key: "dreamThemeOverrides",
        label: "Dream Web palette override",
        kind: "code",
        placeholder: '{"bg": "#0a0e27", "accent": "#818cf8"}',
        help: "Same shape as the Recipes override, applied to the Dream Web section instead.",
      },
      {
        key: "responsibilityThemeOverrides",
        label: "Responsibilities palette override",
        kind: "code",
        placeholder: '{"bg": "#f0fdf4", "accent": "#16a34a"}',
        help: "Same shape as the Recipes override, applied to the Responsibilities section instead.",
      },
    ],
  },
];
