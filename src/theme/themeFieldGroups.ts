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

const SIDEBAR_MODE_OPTIONS = [
  { value: "vertical", label: "Vertical list (default)" },
  { value: "horizontal", label: "Horizontal row" },
  { value: "horizontal-tiled", label: "Horizontal, tiled" },
  { value: "icon-small", label: "Icons, small" },
  { value: "icon-large", label: "Icons, large" },
];

const VIEW_MODE_OPTIONS = [
  { value: "list", label: "List (default)" },
  { value: "list-image-left", label: "List, image on left" },
  { value: "pane-small", label: "Panes, small" },
  { value: "pane-large", label: "Panes, large" },
  { value: "icon-grid", label: "Icon grid" },
];

const COLUMN_COUNT_OPTIONS = [
  { value: "1", label: "1 column (default)" },
  { value: "2", label: "2 columns" },
  { value: "3", label: "3 columns" },
];

const SKILL_HOME_VIEW_MODE_OPTIONS = [
  { value: "grid", label: "Card grid (default)" },
  { value: "list", label: "List" },
];

const SKILL_ADD_CONTROL_POSITION_OPTIONS = [
  { value: "top-left", label: "Top left (default)" },
  { value: "top-right", label: "Top right" },
  { value: "bottom-left", label: "Bottom left" },
  { value: "bottom-right", label: "Bottom right" },
  { value: "floating", label: "Floating (bottom-right corner)" },
];

const SKILL_CREATE_MODE_OPTIONS = [
  { value: "form", label: "Name box + button (default)" },
  { value: "quick-add", label: "Quick add (no text box)" },
];

const CLUSTER_DIRECTION_OPTIONS = [
  { value: "horizontal", label: "Horizontal (default)" },
  { value: "vertical", label: "Vertical" },
];

const DETAIL_COLUMN_COUNT_OPTIONS = [
  { value: "1", label: "1 column (default)" },
  { value: "2", label: "2 columns" },
  { value: "3", label: "3 columns" },
];

const DETAIL_HEADER_POSITION_OPTIONS = [
  { value: "above", label: "Above the fields (default)" },
  { value: "none", label: "Hidden" },
  { value: "beside", label: "Beside the fields (sticky left rail)" },
  { value: "overlay", label: "Overlaid on the fields" },
];

const WIDGET_GRID_STYLE_OPTIONS = [
  { value: "auto", label: "Auto — Goal uses cards, Project uses tiles (default)" },
  { value: "cards", label: "Cards — plain grid (both pages)" },
  { value: "tiles", label: "Tiles — icon + live preview (both pages)" },
];

const RECIPE_DUAL_PANE_MODE_OPTIONS = [
  { value: "permanent", label: "Permanent — always two columns" },
  { value: "smart", label: "Smart — opens once a link is clicked (default)" },
  { value: "none", label: "None — never split (stacked, like mobile)" },
];

const RECIPE_LINK_CLICK_MODE_OPTIONS = [
  { value: "copy", label: "Copy — puts it on the clipboard only" },
  { value: "replace", label: "Replace — overwrites the second column" },
  { value: "instant-place", label: "Instant place — appends with a divider (default)" },
];

const SORT_ORDER_OPTIONS = [
  { value: "manual", label: "Manual (drag to reorder, default)" },
  { value: "name", label: "Name" },
  { value: "created", label: "Date created" },
  { value: "updated", label: "Date last updated" },
];

export const MOBILE_MODE_OPTIONS = [
  { value: "auto", label: "Automatic" },
  { value: "on", label: "Mobile" },
  { value: "off", label: "Desktop" },
];

// Lives on Settings > Mobile rather than Theme, but still a ThemeSettings
// field so OverlayQuickEdit / search can reuse the same write path.
export const MOBILE_LAYOUT_FIELD: ThemeColorField = {
  key: "mobileMode",
  label: "Layout Mode",
  kind: "select",
  options: MOBILE_MODE_OPTIONS,
};

// Settings > Mobile — whether tapping a sidebar link on a phone-width
// screen automatically closes the sidebar afterward.
export const MOBILE_AUTOCLOSE_FIELD: ThemeColorField = {
  key: "sidebarAutoCloseOnMobileNav",
  label: "Close sidebar after tapping a link",
  kind: "select",
  options: [
    { value: "1", label: "Yes, close it (default)" },
    { value: "0", label: "No, leave it open" },
  ],
};

// Settings > Mobile > Page Spacing — per-page-section padding/gap knobs
// that only take effect inside html.mobile-layout (see the matching
// var(--mobile-*, default) fallbacks in theme.css / theme/mobile.css).
export const MOBILE_SPACING_FIELDS: ThemeColorField[] = [
  {
    key: "mobilePagePaddingX",
    label: "Page edge padding, left/right (px)",
    kind: "number",
    min: 8,
    max: 48,
    step: 1,
  },
  {
    key: "mobilePagePaddingY",
    label: "Page edge padding, top/bottom (px)",
    kind: "number",
    min: 8,
    max: 48,
    step: 1,
  },
  {
    key: "mobileCardGap",
    label: "Card / list spacing (px)",
    kind: "number",
    min: 4,
    max: 32,
    step: 1,
  },
];

// Shared by every Color Mode-capable background's Tile field below (see
// overlay/ColorModePanel.tsx) — "Off" leaves the image at its normal
// cover-the-surface size, same as before tiling existed.
const TILE_OPTIONS = [
  { value: "0", label: "Off — fill the surface (default)" },
  { value: "1", label: "On — repeat as a tile" },
];

const GROW_TO_FIT_OPTIONS = [
  { value: "0", label: "Off — fixed size, scroll to see more (default)" },
  { value: "1", label: "On — card grows downward to fit everything" },
];

const VISIBLE_OPTIONS = [
  { value: "1", label: "Shown (default)" },
  { value: "0", label: "Hidden" },
];

// Settings > Widget Visibility — the "0 hides it" floating-widget flags,
// grouped together instead of scattered across Theme's "Big layout &
// feel" section. Still plain ThemeSettings fields (theme_settings-backed)
// so OverlayQuickEdit / search can reuse the same write path.
export const WIDGET_VISIBILITY_FIELDS: ThemeColorField[] = [
  { key: "showCaptureButton", label: "Screen capture button", kind: "select", options: VISIBLE_OPTIONS },
  { key: "showDynamicSearchButton", label: "Dynamic Search button", kind: "select", options: VISIBLE_OPTIONS },
  { key: "showWebControls", label: "Web zoom / fit-view controls", kind: "select", options: VISIBLE_OPTIONS },
  { key: "showLaborLegend", label: "Labor color legend (Dream/Goal Web)", kind: "select", options: VISIBLE_OPTIONS },
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
      { key: "sidebarMode", label: "Sidebar layout", kind: "select", options: SIDEBAR_MODE_OPTIONS },
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
        key: "sidebarItemGap",
        label: "Sidebar item spacing (px)",
        kind: "number",
        min: 0,
        max: 20,
        step: 1,
      },
      {
        key: "fieldSpacing",
        label: "Field spacing (px)",
        kind: "number",
        min: 0,
        max: 48,
        step: 1,
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
      { key: "webGridColor", label: "Web canvas dot-grid color (Dream/Goal Web, Recipes, Skills)" },
      // showCaptureButton / showDynamicSearchButton / showWebControls /
      // showLaborLegend moved to their own "Widget Visibility" settings
      // page (see WIDGET_VISIBILITY_FIELDS below) — grouped together
      // instead of buried in this general layout section.
    ],
  },
  {
    title: "Surfaces",
    fields: [
      { key: "bg", label: "Page background" },
      { key: "appBackgroundImage", label: "Page background image", kind: "image" },
      { key: "appBackgroundTile", label: "Tile page background image", kind: "select", options: TILE_OPTIONS },
      { key: "appBackgroundScale", label: "Page background tile size (px)", kind: "number", min: 20, max: 600, step: 10 },
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
      { key: "sidebarBgImage", label: "Background image", kind: "image" },
      { key: "sidebarBgTile", label: "Tile background image", kind: "select", options: TILE_OPTIONS },
      { key: "sidebarBgScale", label: "Background tile size (px)", kind: "number", min: 20, max: 600, step: 10 },
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
      { key: "inputBgImage", label: "Input / field background image", kind: "image" },
      { key: "inputBgTile", label: "Tile input background image", kind: "select", options: TILE_OPTIONS },
      { key: "inputBgScale", label: "Input background tile size (px)", kind: "number", min: 20, max: 600, step: 10 },
      { key: "inputText", label: "Input text" },
      { key: "checkboxAccentColor", label: "Checkbox / radio accent (checked fill)" },
      { key: "checkboxBg", label: "Checkbox / radio background (unchecked)" },
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
      { key: "webBackgroundTile", label: "Tile web background image", kind: "select", options: TILE_OPTIONS },
      { key: "webBackgroundScale", label: "Web background tile size (px)", kind: "number", min: 20, max: 600, step: 10 },
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
      { key: "dreamWebBackgroundTile", label: "Tile web background image", kind: "select", options: TILE_OPTIONS },
      { key: "dreamWebBackgroundScale", label: "Web background tile size (px)", kind: "number", min: 20, max: 600, step: 10 },
      { key: "dreamNodeBackground", label: "Dream node background" },
      { key: "dreamNodeOutlineColor", label: "Dream node outline color" },
      { key: "dreamLinkColor", label: "Link line color" },
      { key: "dreamPriorityLow", label: "Low priority color" },
      { key: "dreamPriorityMedium", label: "Medium priority color" },
      { key: "dreamPriorityHigh", label: "High priority color" },
      { key: "dreamGoalNodeBackground", label: "Goal node background (on Dream Web)" },
      { key: "dreamGoalNodeOutlineColor", label: "Goal node outline color (on Dream Web)" },
      {
        key: "dreamNodeShape",
        label: "Dream / project node shape",
        kind: "select",
        options: NODE_SHAPE_OPTIONS,
      },
      {
        key: "nodeCardGrowToFit",
        label: "Fields shown on web cards",
        kind: "select",
        options: GROW_TO_FIT_OPTIONS,
      },
    ],
  },
  {
    title: "Goal web",
    fields: [
      { key: "goalWebBackground", label: "Web background" },
      { key: "goalWebBackgroundImage", label: "Web background image", kind: "image" },
      { key: "goalWebBackgroundTile", label: "Tile web background image", kind: "select", options: TILE_OPTIONS },
      { key: "goalWebBackgroundScale", label: "Web background tile size (px)", kind: "number", min: 20, max: 600, step: 10 },
      { key: "goalProjectNodeBackground", label: "Project node background" },
      { key: "goalProjectNodeOutlineColor", label: "Project node outline color" },
      { key: "outputNodeBackground", label: "Output node background" },
      { key: "outputNodeOutlineColor", label: "Output node outline color" },
      { key: "noteNodeBackground", label: "Note shortcut node background" },
      { key: "noteNodeOutlineColor", label: "Note shortcut node outline color" },
    ],
  },
  {
    title: "View modes",
    fields: [
      { key: "projectViewMode", label: "Projects list view", kind: "select", options: VIEW_MODE_OPTIONS },
      { key: "goalViewMode", label: "Goals list view", kind: "select", options: VIEW_MODE_OPTIONS },
      { key: "recipeViewMode", label: "Recipes list view", kind: "select", options: VIEW_MODE_OPTIONS },
      { key: "recipeColumnCount", label: "Recipes columns (list modes only)", kind: "select", options: COLUMN_COUNT_OPTIONS },
      { key: "responsibilityViewMode", label: "Responsibilities list view", kind: "select", options: VIEW_MODE_OPTIONS },
      { key: "skillHomeViewMode", label: "Skills home view", kind: "select", options: SKILL_HOME_VIEW_MODE_OPTIONS },
      { key: "skillAddControlPosition", label: "Skills: \"Add Skill\" control position", kind: "select", options: SKILL_ADD_CONTROL_POSITION_OPTIONS },
      { key: "skillCreateMode", label: "Skills: create flow", kind: "select", options: SKILL_CREATE_MODE_OPTIONS },
      { key: "skillCardWidth", label: "Skill card width (px, blank = auto)", kind: "number", min: 100, max: 500, step: 10 },
      { key: "skillCardHeight", label: "Skill card height (px, blank = auto)", kind: "number", min: 60, max: 500, step: 10 },
      { key: "paneGridGap", label: "Grid card spacing (px, blank = each surface's default)", kind: "number", min: 0, max: 48, step: 2 },
      { key: "skillTreeDefaultDirection", label: "New skill tree growth direction", kind: "select", options: CLUSTER_DIRECTION_OPTIONS },
      { key: "goalClusterDirection", label: "Goal/Progress Web cluster direction", kind: "select", options: CLUSTER_DIRECTION_OPTIONS },
      { key: "detailColumnCount", label: "Project/Goal/Dream/Task Detail columns", kind: "select", options: DETAIL_COLUMN_COUNT_OPTIONS },
      { key: "detailHeaderPosition", label: "Detail page header position", kind: "select", options: DETAIL_HEADER_POSITION_OPTIONS },
      { key: "widgetGridStyle", label: "Widget grid style (Goal/Project Detail)", kind: "select", options: WIDGET_GRID_STYLE_OPTIONS },
    ],
  },
  {
    title: "Recipe links (Future Slot)",
    fields: [
      { key: "recipeDualPaneMode", label: "Dual-pane mode (desktop)", kind: "select", options: RECIPE_DUAL_PANE_MODE_OPTIONS },
      { key: "recipeLinkClickMode", label: "Clicking a recipe link", kind: "select", options: RECIPE_LINK_CLICK_MODE_OPTIONS },
    ],
  },
  {
    title: "List sorting",
    fields: [
      { key: "notesSortOrder", label: "Notes tree sort order", kind: "select", options: SORT_ORDER_OPTIONS },
      { key: "goalsHomeSortOrder", label: "Goals home sort order", kind: "select", options: SORT_ORDER_OPTIONS },
      { key: "projectsHomeSortOrder", label: "Projects home sort order", kind: "select", options: SORT_ORDER_OPTIONS },
      { key: "recipeHomeSortOrder", label: "Recipes list sort order", kind: "select", options: SORT_ORDER_OPTIONS },
      { key: "responsibilityHomeSortOrder", label: "Responsibilities list sort order", kind: "select", options: SORT_ORDER_OPTIONS },
      { key: "skillHomeSortOrder", label: "Skills list sort order", kind: "select", options: SORT_ORDER_OPTIONS },
    ],
  },
  {
    title: "Uneven padding",
    fields: [
      { key: "pagePaddingTop", label: "Page padding: top (px, blank = default)", kind: "number", min: 0, max: 200, step: 4 },
      { key: "pagePaddingRight", label: "Page padding: right (px, blank = default)", kind: "number", min: 0, max: 200, step: 4 },
      { key: "pagePaddingBottom", label: "Page padding: bottom (px, blank = default)", kind: "number", min: 0, max: 200, step: 4 },
      { key: "pagePaddingLeft", label: "Page padding: left (px, blank = default)", kind: "number", min: 0, max: 200, step: 4 },
      { key: "cardPaddingTop", label: "Card padding: top (px, blank = default)", kind: "number", min: 0, max: 100, step: 2 },
      { key: "cardPaddingRight", label: "Card padding: right (px, blank = default)", kind: "number", min: 0, max: 100, step: 2 },
      { key: "cardPaddingBottom", label: "Card padding: bottom (px, blank = default)", kind: "number", min: 0, max: 100, step: 2 },
      { key: "cardPaddingLeft", label: "Card padding: left (px, blank = default)", kind: "number", min: 0, max: 100, step: 2 },
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
      {
        key: "projectPaneShape",
        label: "Projects pane shape",
        kind: "code",
        placeholder: '{"curve": "round", "truncation": "wrap-2", "borderLayers": [{"enabled": true, "color": "var(--color-accent)", "width": 2, "offset": 3}]}',
        help: 'Shape profile for Projects pane/icon-grid view. curve: sharp|soft|round|pill. truncation: clip|ellipsis|wrap|wrap-2|wrap-3. borderLayers: up to 4 concentric rings, each {enabled, color, width, offset}. Leave empty for defaults (soft curve, ellipsis, no extra border rings).',
      },
      {
        key: "skillPaneShape",
        label: "Skills pane shape",
        kind: "code",
        placeholder: '{"curve": "pill", "truncation": "ellipsis", "borderLayers": []}',
        help: "Same shape as the Projects pane shape, applied to Skill nodes/panes instead.",
      },
      {
        key: "recipePaneShape",
        label: "Recipes pane shape",
        kind: "code",
        placeholder: '{"curve": "soft", "truncation": "wrap-2", "borderLayers": []}',
        help: "Same shape as the Projects pane shape, applied to the Recipes icon grid instead.",
      },
      {
        key: "responsibilityPaneShape",
        label: "Responsibilities pane shape",
        kind: "code",
        placeholder: '{"curve": "soft", "truncation": "ellipsis", "borderLayers": []}',
        help: "Same shape as the Projects pane shape, applied to the Responsibilities icon grid instead.",
      },
      {
        key: "timeBasedThemeSchedule",
        label: "Time-based theme schedule",
        kind: "code",
        placeholder: '[{"startHour": 20, "presetName": "Night"}, {"startHour": 7, "presetName": "Day"}]',
        help: 'JSON array of {startHour (0-23), presetName}. Each presetName must match a theme already saved in Settings > Theme\'s preset library. The whole theme switches automatically as the clock crosses each startHour. Leave empty ("[]") to disable.',
      },
      {
        key: "decals",
        label: "Decals / stickers",
        kind: "code",
        placeholder:
          '[{"id": "star", "source": "\\u2b50", "target": "pane", "surface": "skill", "anchor": "corner-tr", "rotation": -8, "scale": 1}]',
        help: 'JSON array of decals — small emoji or images anchored to a card, canvas, or page background. Each entry: {id, source (an emoji, or a "data:image/..." URL), target: "pane"|"canvas"|"page-bg", surface (optional — a pane surface like "skill", or a section key like "section:dreams-web"; omit to apply everywhere for that target), anchor: "corner-tl"|"corner-tr"|"corner-bl"|"corner-br"|"center-overlap"|"edge"|"free", x/y (percent for pane/page-bg, canvas units for canvas — only used when anchor is "free"), rotation (degrees), scale (multiplier, 1 = natural size)}. Leave empty ("[]") to disable.',
      },
    ],
  },
];
