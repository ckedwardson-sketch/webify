import { DEFAULT_FONT_KEY } from "./fontPresets";
import { DEFAULT_DENSITY, DEFAULT_RADIUS_SCALE } from "./scalePresets";

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
}

export interface ThemeSettings extends GeneralThemeSettings, ScaleThemeSettings, WebThemeSettings {
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
};

export const SCALE_DEFAULTS: ScaleThemeSettings = {
  fontFamily: DEFAULT_FONT_KEY,
  radiusScale: DEFAULT_RADIUS_SCALE,
  density: DEFAULT_DENSITY,
};

export function defaultsForMode(mode: ThemeMode): GeneralThemeSettings {
  return mode === "dark" ? DARK_DEFAULTS : LIGHT_DEFAULTS;
}

export const DEFAULT_THEME: ThemeSettings = {
  mode: "light",
  ...LIGHT_DEFAULTS,
  ...SCALE_DEFAULTS,
  ...WEB_DEFAULTS,
};
