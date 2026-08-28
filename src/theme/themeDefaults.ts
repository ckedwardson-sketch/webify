import { DEFAULT_FONT_KEY } from "./fontPresets";
import { DEFAULT_DENSITY, DEFAULT_RADIUS_SCALE } from "./scalePresets";
import { DEFAULT_SURFACE_STYLE } from "./surfacePresets";
import { DEFAULT_HEADING_STYLE } from "./headingPresets";
import { DEFAULT_BACKGROUND_STYLE } from "./backgroundPresets";
import { DEFAULT_MOTION_STYLE } from "./motionPresets";
import { DEFAULT_NODE_SHAPE } from "./nodeShapes";

export type ThemeMode = "light" | "dark";

// General, app-wide colors. Each has a CSS custom property (see
// CSS_VAR_MAP below and theme.css) so plain CSS files can pick them up
// with var(--...) — ThemeContext just keeps the custom property in sync
// with the DB override (or clears it back to the light/dark CSS preset
// when there's no override).
export interface GeneralThemeSettings {
  bg: string;
  bgSecondary: string;
  bgElevated: string;
  text: string;
  textSecondary: string;
  border: string;
  borderStrong: string;
  sidebarBg: string;
  sidebarText: string;
  sidebarTextActive: string;
  sidebarHoverBg: string;
  sidebarActiveBg: string;
  inputBg: string;
  inputText: string;
  primaryBg: string;
  primaryText: string;
  primaryHoverBg: string;
  accent: string;
  danger: string;
  // Raw data: URL of an uploaded image, or "" for none. Resolved into a
  // url(...) CSS value by ThemeContext, not stored that way.
  appBackgroundImage: string;
}

// A named preset key (see fontPresets.ts / scalePresets.ts), not a raw
// CSS value — keeps themes portable instead of depending on whatever
// font happens to be installed.
export interface ScaleThemeSettings {
  fontFamily: string;
  radiusScale: string;
  density: string;
}

// Big, structural/atmospheric knobs — each a named preset key (see the
// matching *Presets.ts file) that fans out across the whole app rather
// than one component. navLayout is the exception: it drives a
// data-nav-layout attribute on <html> (same mechanism as data-theme)
// instead of a CSS variable, since repositioning the sidebar needs
// actual layout rules, not just a value swap.
export interface LayoutThemeSettings {
  navLayout: string; // "left" | "right" | "top"
  surfaceStyle: string; // see surfacePresets.ts
  headingStyle: string; // see headingPresets.ts
  backgroundStyle: string; // see backgroundPresets.ts
  motionStyle: string; // see motionPresets.ts
  // "auto" follows the actual viewport (see theme/mobileLayout.ts);
  // "on"/"off" force the mobile layout regardless of window size — lets
  // someone preview it on a desktop window, or pin the roomier desktop
  // layout on a small/split-screen window. Drives html.mobile-layout /
  // html.mobile-landscape, which CSS keys off directly instead of a raw
  // @media query, since that's the only way a forced value can actually
  // change rendering.
  mobileMode: string; // "auto" | "on" | "off"
  // Raw pixel/rem values (not named presets, unlike the fields above) —
  // three knobs that were flatly hardcoded in CSS until now and touch
  // nearly every page: the reading-width cap every .page uses, the
  // sidebar's fixed width, and every page's h1.page-title size. See
  // --page-max-width / --sidebar-width / --page-title-size in theme.css.
  pageMaxWidth: string; // px, numeric string
  sidebarWidth: string; // px, numeric string
  pageTitleSize: string; // rem, numeric string
}

// Recipe web colors + card chrome. Not backed by CSS variables — the
// graph nodes are plain React components rendered by ReactFlow, so they
// just read theme.webX directly via useTheme().
export interface WebThemeSettings {
  webBackground: string;
  webBackgroundImage: string; // raw data: URL, or "" for none
  webNodeProvenBackground: string;
  webNodeUnprovenBackground: string;
  webNodeOutlineColor: string;
  webCategoryNodeBackground: string;
  webIterationNodeBackground: string;
  webCardShadow: string; // "none" | "soft" | "strong"
  webCardRadius: string; // px, numeric string
  webCardImageStyle: string; // "boxed" | "fill"
  webCardShape: string; // "rectangle" | "hexagon" | "blob" | "diamond" — see nodeShapes.ts
}

// Advanced / power-user knobs. customCss is the escape hatch for
// whatever a structured field doesn't cover yet — stored as plain text,
// injected verbatim as a <style> tag (see ThemeContext.tsx), so it can
// override literally anything. The three *ThemeOverrides fields are
// per-section palette layers: each is a JSON-serialized
// Partial<GeneralThemeSettings> (not a nested object directly on
// ThemeSettings, since every other field here — and the whole
// export/import/preset pipeline — assumes flat string values) that
// SectionThemeScope merges on top of the global theme for just that
// section. Empty ("" / "{}") means "inherit the global theme
// everywhere", so this is zero-risk to any existing saved preset.
export interface AdvancedThemeSettings {
  customCss: string;
  recipeThemeOverrides: string;
  dreamThemeOverrides: string;
  responsibilityThemeOverrides: string;
}

// Progress web colors — one per work category (see ProgressCategory in
// types/models.ts). Same pattern as WebThemeSettings — not backed by
// CSS variables, read directly via useTheme() by the progress graph node.
export interface ProgressWebThemeSettings {
  progressWebBackground: string;
  progressLaborColor: string;
  progressPurchaseColor: string;
  progressDesignColor: string;
  progressConceiveColor: string;
  progressTaskColor: string;
}

// Dream web colors. Same pattern as WebThemeSettings — not backed by
// CSS variables, read directly via useTheme() by the dream graph nodes.
export interface DreamWebThemeSettings {
  dreamWebBackground: string;
  dreamWebBackgroundImage: string; // raw data: URL, or "" for none
  dreamNodeBackground: string;
  dreamNodeOutlineColor: string;
  dreamLinkColor: string;
  dreamPriorityLow: string;
  dreamPriorityMedium: string;
  dreamPriorityHigh: string;
  dreamNodeShape: string; // "rectangle" | "hexagon" | "blob" | "diamond" — see nodeShapes.ts, also drives project nodes
  // A goal auto-appears on its parent dream's node as a smaller,
  // distinctly-colored node (see DreamGoalNode in DreamGraphNodes.tsx) —
  // these two colors are that node's whole visual identity.
  dreamGoalNodeBackground: string;
  dreamGoalNodeOutlineColor: string;
}

// Goal Web — one per goal, auto-populated with every project linked to
// it (Project.goalId). Same flat "background + a couple of node colors"
// shape as ProgressWebThemeSettings, for the same reason: read directly
// by plain React components via useTheme(), not CSS variables.
export interface GoalWebThemeSettings {
  goalWebBackground: string;
  goalProjectNodeBackground: string;
  goalProjectNodeOutlineColor: string;
}

export interface ThemeSettings
  extends GeneralThemeSettings,
    ScaleThemeSettings,
    LayoutThemeSettings,
    AdvancedThemeSettings,
    WebThemeSettings,
    ProgressWebThemeSettings,
    DreamWebThemeSettings,
    GoalWebThemeSettings {
  mode: ThemeMode;
}

export const THEME_SETTING_KEYS: (keyof ThemeSettings)[] = [
  "mode",
  "bg",
  "bgSecondary",
  "bgElevated",
  "text",
  "textSecondary",
  "border",
  "borderStrong",
  "sidebarBg",
  "sidebarText",
  "sidebarTextActive",
  "sidebarHoverBg",
  "sidebarActiveBg",
  "inputBg",
  "inputText",
  "primaryBg",
  "primaryText",
  "primaryHoverBg",
  "accent",
  "danger",
  "appBackgroundImage",
  "fontFamily",
  "radiusScale",
  "density",
  "navLayout",
  "surfaceStyle",
  "headingStyle",
  "backgroundStyle",
  "motionStyle",
  "mobileMode",
  "pageMaxWidth",
  "sidebarWidth",
  "pageTitleSize",
  "customCss",
  "recipeThemeOverrides",
  "dreamThemeOverrides",
  "responsibilityThemeOverrides",
  "webBackground",
  "webBackgroundImage",
  "webNodeProvenBackground",
  "webNodeUnprovenBackground",
  "webNodeOutlineColor",
  "webCategoryNodeBackground",
  "webIterationNodeBackground",
  "webCardShadow",
  "webCardRadius",
  "webCardImageStyle",
  "webCardShape",
  "progressWebBackground",
  "progressLaborColor",
  "progressPurchaseColor",
  "progressDesignColor",
  "progressConceiveColor",
  "progressTaskColor",
  "dreamWebBackground",
  "dreamWebBackgroundImage",
  "dreamNodeBackground",
  "dreamNodeOutlineColor",
  "dreamLinkColor",
  "dreamPriorityLow",
  "dreamPriorityMedium",
  "dreamPriorityHigh",
  "dreamNodeShape",
  "dreamGoalNodeBackground",
  "dreamGoalNodeOutlineColor",
  "goalWebBackground",
  "goalProjectNodeBackground",
  "goalProjectNodeOutlineColor",
];

// Maps each general-theme key to the CSS custom property it drives.
// Must stay in sync with theme.css's --color-* / --bg-image-app
// declarations. appBackgroundImage's raw data: URL gets wrapped in
// url(...) by ThemeContext before being written to its property.
export const CSS_VAR_MAP: Record<keyof GeneralThemeSettings, string> = {
  bg: "--color-bg",
  bgSecondary: "--color-bg-secondary",
  bgElevated: "--color-bg-elevated",
  text: "--color-text",
  textSecondary: "--color-text-secondary",
  border: "--color-border",
  borderStrong: "--color-border-strong",
  sidebarBg: "--color-sidebar-bg",
  sidebarText: "--color-sidebar-text",
  sidebarTextActive: "--color-sidebar-text-active",
  sidebarHoverBg: "--color-sidebar-hover-bg",
  sidebarActiveBg: "--color-sidebar-active-bg",
  inputBg: "--color-input-bg",
  inputText: "--color-input-text",
  primaryBg: "--color-primary-bg",
  primaryText: "--color-primary-text",
  primaryHoverBg: "--color-primary-hover-bg",
  accent: "--color-accent",
  danger: "--color-danger",
  appBackgroundImage: "--bg-image-app",
};

// General-theme keys whose value is a raw data: URL that needs
// wrapping in url(...) before becoming a CSS custom property value.
export const IMAGE_GENERAL_KEYS: (keyof GeneralThemeSettings)[] = ["appBackgroundImage"];

// Light/dark preset palettes. These must mirror the :root and
// :root[data-theme="dark"] blocks in theme.css exactly — CSS owns the
// actual rendering, this copy exists so the Theme settings page can show
// a sensible starting color in each picker before the user overrides it.
export const LIGHT_DEFAULTS: GeneralThemeSettings = {
  bg: "#ffffff",
  bgSecondary: "#fafafa",
  bgElevated: "#ffffff",
  text: "#1a1a1a",
  textSecondary: "#666666",
  border: "#e5e5e5",
  borderStrong: "#999999",
  sidebarBg: "#fafafa",
  sidebarText: "#444444",
  sidebarTextActive: "#000000",
  sidebarHoverBg: "#eeeeee",
  sidebarActiveBg: "#e8e8e8",
  inputBg: "#ffffff",
  inputText: "#1a1a1a",
  primaryBg: "#333333",
  primaryText: "#ffffff",
  primaryHoverBg: "#000000",
  accent: "#2563eb",
  danger: "#cc0000",
  appBackgroundImage: "",
};

export const DARK_DEFAULTS: GeneralThemeSettings = {
  bg: "#16181d",
  bgSecondary: "#1e2128",
  bgElevated: "#22252c",
  text: "#e8e8e8",
  textSecondary: "#9aa0a8",
  border: "#30343c",
  borderStrong: "#4b5058",
  sidebarBg: "#1a1c22",
  sidebarText: "#c3c7cf",
  sidebarTextActive: "#ffffff",
  sidebarHoverBg: "#262932",
  sidebarActiveBg: "#2c3038",
  inputBg: "#22252c",
  inputText: "#e8e8e8",
  primaryBg: "#4b5563",
  primaryText: "#ffffff",
  primaryHoverBg: "#64748b",
  accent: "#60a5fa",
  danger: "#f87171",
  appBackgroundImage: "",
};

export const WEB_DEFAULTS: WebThemeSettings = {
  webBackground: "#1e293b",
  webBackgroundImage: "",
  webNodeProvenBackground: "#15803d",
  webNodeUnprovenBackground: "#4b5563",
  webNodeOutlineColor: "#94a3b8",
  webCategoryNodeBackground: "#1e3a8a",
  webIterationNodeBackground: "#0284c7",
  webCardShadow: "soft",
  webCardRadius: "10",
  webCardImageStyle: "boxed",
  webCardShape: DEFAULT_NODE_SHAPE,
};

export const SCALE_DEFAULTS: ScaleThemeSettings = {
  fontFamily: DEFAULT_FONT_KEY,
  radiusScale: DEFAULT_RADIUS_SCALE,
  density: DEFAULT_DENSITY,
};

export const LAYOUT_DEFAULTS: LayoutThemeSettings = {
  navLayout: "left",
  surfaceStyle: DEFAULT_SURFACE_STYLE,
  headingStyle: DEFAULT_HEADING_STYLE,
  backgroundStyle: DEFAULT_BACKGROUND_STYLE,
  motionStyle: DEFAULT_MOTION_STYLE,
  mobileMode: "auto",
  pageMaxWidth: "640",
  sidebarWidth: "220",
  pageTitleSize: "1.6",
};

export const ADVANCED_DEFAULTS: AdvancedThemeSettings = {
  customCss: "",
  recipeThemeOverrides: "",
  dreamThemeOverrides: "",
  responsibilityThemeOverrides: "",
};

export const PROGRESS_WEB_DEFAULTS: ProgressWebThemeSettings = {
  progressWebBackground: "#1c1917",
  progressLaborColor: "#f97316",
  progressPurchaseColor: "#22c55e",
  progressDesignColor: "#a855f7",
  progressConceiveColor: "#3b82f6",
  progressTaskColor: "#64748b",
};

export const DREAM_WEB_DEFAULTS: DreamWebThemeSettings = {
  dreamWebBackground: "#1e1b2e",
  dreamWebBackgroundImage: "",
  dreamNodeBackground: "#4c1d95",
  dreamNodeOutlineColor: "#a78bfa",
  dreamLinkColor: "#a78bfa",
  dreamPriorityLow: "#64748b",
  dreamPriorityMedium: "#eab308",
  dreamPriorityHigh: "#ef4444",
  dreamNodeShape: DEFAULT_NODE_SHAPE,
  dreamGoalNodeBackground: "#0f766e",
  dreamGoalNodeOutlineColor: "#5eead4",
};

export const GOAL_WEB_DEFAULTS: GoalWebThemeSettings = {
  goalWebBackground: "#0f2027",
  goalProjectNodeBackground: "#155e75",
  goalProjectNodeOutlineColor: "#67e8f9",
};

export function defaultsForMode(mode: ThemeMode): GeneralThemeSettings {
  return mode === "dark" ? DARK_DEFAULTS : LIGHT_DEFAULTS;
}

export const DEFAULT_THEME: ThemeSettings = {
  mode: "light",
  ...LIGHT_DEFAULTS,
  ...SCALE_DEFAULTS,
  ...LAYOUT_DEFAULTS,
  ...ADVANCED_DEFAULTS,
  ...WEB_DEFAULTS,
  ...PROGRESS_WEB_DEFAULTS,
  ...DREAM_WEB_DEFAULTS,
  ...GOAL_WEB_DEFAULTS,
};
