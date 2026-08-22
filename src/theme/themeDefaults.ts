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
}

// Recipe web colors. These aren't backed by CSS variables — the graph
// nodes are plain React components rendered by ReactFlow, so they just
// read theme.webX directly via useTheme().
export interface WebThemeSettings {
  webBackground: string;
  webNodeProvenBackground: string;
  webNodeUnprovenBackground: string;
  webNodeOutlineColor: string;
  webCategoryNodeBackground: string;
  webIterationNodeBackground: string;
}

export interface ThemeSettings extends GeneralThemeSettings, WebThemeSettings {
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
  "webBackground",
  "webNodeProvenBackground",
  "webNodeUnprovenBackground",
  "webNodeOutlineColor",
  "webCategoryNodeBackground",
  "webIterationNodeBackground",
];

// Maps each general-theme key to the CSS custom property it drives.
// Must stay in sync with theme.css's --color-* declarations.
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
};

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
};

export const WEB_DEFAULTS: WebThemeSettings = {
  webBackground: "#1e293b",
  webNodeProvenBackground: "#15803d",
  webNodeUnprovenBackground: "#4b5563",
  webNodeOutlineColor: "#94a3b8",
  webCategoryNodeBackground: "#1e3a8a",
  webIterationNodeBackground: "#0284c7",
};

export function defaultsForMode(mode: ThemeMode): GeneralThemeSettings {
  return mode === "dark" ? DARK_DEFAULTS : LIGHT_DEFAULTS;
}

export const DEFAULT_THEME: ThemeSettings = {
  mode: "light",
  ...LIGHT_DEFAULTS,
  ...WEB_DEFAULTS,
};
