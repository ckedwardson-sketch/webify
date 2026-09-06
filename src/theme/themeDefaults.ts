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
  // Native checkbox/radio styling is limited to accent-color (the
  // checked-state fill) and background-color (the unchecked box) —
  // there's no cross-browser way to theme more than that on a plain
  // <input type="checkbox">. See theme.css's input[type="checkbox"] rule.
  checkboxAccentColor: string;
  checkboxBg: string;
  primaryBg: string;
  primaryText: string;
  primaryHoverBg: string;
  accent: string;
  danger: string;
  // Raw data: URL of an uploaded image, or "" for none. Resolved into a
  // url(...) CSS value by ThemeContext, not stored that way.
  appBackgroundImage: string;
  // Color Mode's tiling controls for the three CSS-var-driven
  // backgrounds (see ColorModePanel.tsx / ThemeContext.tsx's
  // applyTileVars) — "1" tiles the image at appBackgroundScale px,
  // otherwise it covers the surface like a normal background image.
  // No effect while the matching *Image field is empty.
  appBackgroundTile: string; // "0" | "1"
  appBackgroundScale: string; // px, numeric string
  sidebarBgImage: string;
  sidebarBgTile: string;
  sidebarBgScale: string;
  inputBgImage: string;
  inputBgTile: string;
  inputBgScale: string;
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
  // Item flow + shape within the sidebar panel, orthogonal to navLayout
  // (which only controls which edge of the screen it docks to). Drives
  // a data-sidebar-mode attribute on <html>, same mechanism as
  // data-nav-layout. "vertical" is today's stacked list. "icon-small"/
  // "icon-large" render each item as a square pane (icon centered,
  // label below) via Sidebar.css keyed off the attribute value itself
  // — no separate size field needed.
  sidebarMode: string; // "vertical" | "horizontal" | "horizontal-tiled" | "icon-small" | "icon-large"
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
  // Two more previously-hardcoded spacing values, same pattern as the
  // three above: the gap between sidebar nav items, and the vertical
  // gap between fields on a Project/Goal/Dream detail page (was
  // piggybacking on generic density before — now its own knob).
  sidebarItemGap: string; // px, numeric string
  fieldSpacing: string; // px, numeric string
  // Mobile-only page spacing (see Settings > Mobile > Page Spacing) —
  // each falls back to its CSS default (theme.css / theme/mobile.css)
  // via var(--mobile-*, default) when unset, and only ever applies
  // inside html.mobile-layout, so it never touches the desktop values
  // above (pageMaxWidth etc.) even though the underlying --space-page-x/
  // -y variables are shared with desktop.
  mobilePagePaddingX: string; // px, numeric string
  mobilePagePaddingY: string; // px, numeric string
  mobileCardGap: string; // px, numeric string
  // Visibility toggles for the three floating overlay buttons/panels
  // that sit on top of every page: the capture FAB (bottom-right), the
  // "Dynamic Search" toggle (bottom-right, above it), and the web
  // zoom/fit-view control panel shown on the recipe/dream/goal/progress
  // canvases. "1" (default) shows them, "0" hides them.
  showCaptureButton: string; // "0" | "1"
  showDynamicSearchButton: string; // "0" | "1"
  showWebControls: string; // "0" | "1"
  // Same "0 hides it" convention as the three above, for the labor-color
  // legend shown on the Dream Web and Goal Web canvases.
  showLaborLegend: string; // "0" | "1"
  // Whether tapping a sidebar link on mobile auto-closes the sidebar
  // afterward. "1" (default) is today's behavior; "0" leaves it open.
  sidebarAutoCloseOnMobileNav: string; // "0" | "1"
  // Dot-grid color shown behind every React Flow canvas (Dream/Goal Web,
  // Recipes graph, Skill tree) — was hardcoded to "#64748b" on all four,
  // now one shared color so it can be tuned or hidden to match a theme.
  webGridColor: string;
  // Visual treatment for the widget grid on Goal/Project Detail pages —
  // "cards" is Goal Detail's plain card grid, "tiles" is Project Detail's
  // icon + live-preview "Wii menu" style. "auto" (default) keeps each
  // page's original look (Goal->cards, Project->tiles); picking "cards"
  // or "tiles" explicitly applies that one style to both pages.
  widgetGridStyle: string; // "auto" | "cards" | "tiles"
  // Sort order for flat, frequently-scanned lists. "manual" keeps
  // whatever order drag-reorder (or fetch order, if nothing's been
  // reordered) already produced.
  notesSortOrder: string; // "manual" | "name" | "created" | "updated"
  goalsHomeSortOrder: string; // "manual" | "name" | "created" | "updated"
  projectsHomeSortOrder: string; // "manual" | "name" | "created" | "updated"
  recipeHomeSortOrder: string; // "manual" | "name" | "created" | "updated"
  responsibilityHomeSortOrder: string; // "manual" | "name" | "created" | "updated"
  skillHomeSortOrder: string; // "manual" | "name" | "created" | "updated"
  // Per-surface list view mode — see components/PaneGrid.tsx / ManagedListRow.tsx.
  // "list" is today's plain row list; "list-image-left" adds a thumbnail
  // (ManagedListRow.imageUrl) in front of the label; "pane-small"/
  // "pane-large"/"icon-grid" switch to PaneGrid (square pane + label,
  // triple-dot rename/delete, drag-reorder). Each surface is independent
  // since they were asked to be independently stylable.
  projectViewMode: string; // "list" | "list-image-left" | "pane-small" | "pane-large" | "icon-grid"
  goalViewMode: string;
  recipeViewMode: string;
  responsibilityViewMode: string;
  // Splits a "list"/"list-image-left" recipe list into 2-3 CSS columns
  // separated by a rule line, independent of recipeViewMode — only
  // meaningful in the two list modes (pane/icon-grid modes already wrap
  // via their own grid).
  recipeColumnCount: string; // "1" | "2" | "3"
  // Skills home page (see pages/SkillsHomePage.tsx). "grid" is today's
  // skill-card grid; "list" switches to a plain row list like Projects.
  skillHomeViewMode: string; // "grid" | "list"
  // Where the "+ Add Skill" control sits on the page.
  skillAddControlPosition: string; // "top-left" | "top-right" | "bottom-left" | "bottom-right" | "floating"
  // "form" (default) is today's inline text box + button. "quick-add"
  // skips the text box entirely: clicking the control creates a skill
  // named "New Skill" and drops straight into its tree, where the
  // existing click-to-rename title (see SkillTreePage.tsx) renames it.
  skillCreateMode: string; // "form" | "quick-add"
  skillCardWidth: string; // px, numeric string ("" = auto/today's minmax grid)
  skillCardHeight: string; // px, numeric string ("" = auto)
  // Gap between cards in every PaneGrid-backed grid (Projects/Goals/
  // Recipes/Responsibilities) AND the Skills page's own grid (see
  // PaneGrid.css / SkillsHomePage.css) — one shared knob rather than
  // per-surface ones, since there was no per-surface request for this.
  paneGridGap: string; // px, numeric string ("" = each surface's own default)
  // Tree growth direction a newly-CREATED skill starts with (see
  // types/skill.ts's SkillTreeDirection). Applied once, at creation
  // time (SkillsHomePage.tsx), by writing it into that skill's own
  // skill_settings row — it does not retroactively change existing
  // skills, which each keep their own already-saved direction,
  // editable per-skill in that skill's own settings panel.
  skillTreeDefaultDirection: string; // "horizontal" | "vertical"
  // Rotates the Goal Web / Progress Web cluster (projects, tasks,
  // responsibilities around a goal — see webGraph/goalCluster.ts) from
  // its default left-right flow into a top-down one. Shared by
  // GoalWebPage and DreamWebPage's "full" per-goal view so both stay
  // consistent with each other.
  goalClusterDirection: string; // "horizontal" | "vertical"
  // Project/Goal/Dream Detail page field layout (see db/fieldLayout.ts's
  // FieldLayoutRow.column and rearrange/RearrangeModeContext.tsx's
  // columnCount/onSetFieldColumn). "1" is today's single flat list.
  detailColumnCount: string; // "1" | "2" | "3"
  // Where the page's h1 title + action buttons sit relative to the
  // field columns. "beside": header becomes a sticky left rail.
  // "overlay": header floats on top of the field area's top-left.
  detailHeaderPosition: string; // "none" | "above" | "beside" | "overlay"
  // Per-side page padding overrides (px, numeric string; "" = inherit
  // the symmetric pageMaxWidth-era --space-page-x/-y default for that
  // side) — lets an AI leave e.g. a big empty gap on one side for an
  // image, rather than only ever having symmetric padding.
  pagePaddingTop: string;
  pagePaddingRight: string;
  pagePaddingBottom: string;
  pagePaddingLeft: string;
  // Same idea, for the shared .pane-shape-surface card utility (see
  // theme/paneShape.ts) — Projects/Skills/Recipes/Responsibilities pane
  // views and the Skills card grid all consume it.
  cardPaddingTop: string;
  cardPaddingRight: string;
  cardPaddingBottom: string;
  cardPaddingLeft: string;
}

// Recipe web colors + card chrome. Not backed by CSS variables — the
// graph nodes are plain React components rendered by ReactFlow, so they
// just read theme.webX directly via useTheme().
export interface WebThemeSettings {
  webBackground: string;
  webBackgroundImage: string; // raw data: URL, or "" for none
  webBackgroundTile: string; // "0" | "1"
  webBackgroundScale: string; // px, numeric string
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
  // Per-surface pane shape profiles — JSON-serialized PaneShapeProfile
  // (see theme/paneShape.ts), applied by PaneShapeScope.tsx. Each
  // surface gets its own independent curve/border-layers/truncation
  // setting rather than one global shape, since Projects/Skills/
  // Recipes/Responsibilities were each asked to be independently
  // stylable. "" means "use PaneShape defaults" everywhere.
  projectPaneShape: string;
  skillPaneShape: string;
  recipePaneShape: string;
  responsibilityPaneShape: string;
  // Dream/Goal/Project Web graph cards' "show on web" field list (see
  // theme/nodeCardFields.ts): "1" lets a card's bottom edge grow
  // downward to fit all its visible fields; "0" (default) keeps the
  // card at its normal computed size and makes that area scrollable
  // instead, so nothing is ever silently cut off either way.
  nodeCardGrowToFit: string; // "0" | "1"
  // Device/time-based theme switching — JSON-serialized array of
  // TimeBasedThemeEntry (see theme/timeBasedTheme.ts): [{"startHour":
  // 20, "presetName": "Night"}, {"startHour": 7, "presetName": "Day"}].
  // "" or "[]" disables it entirely. Each named preset must already
  // exist in the saved theme preset library (Settings > Theme).
  timeBasedThemeSchedule: string;
  // Decal/sticker primitive (see theme/decals.ts) — JSON-serialized
  // array of DecalDef. "" disables it entirely. Read directly via
  // useTheme() + parseDecals(), not a CSS variable, since each decal
  // needs to be filtered by target/surface and rendered as its own
  // positioned element (see theme/DecalLayer.tsx).
  decals: string;
  // Corner placement ("tl"|"tr"|"bl"|"br") for the shared CornerMenu
  // primitive (see components/CornerMenu.tsx) on each surface it's
  // been migrated to. Right-click on the trigger itself also changes
  // this live — these fields just persist that choice like every
  // other theme setting.
  quickPhotoMenuCorner: string;
  paneGridMenuCorner: string;
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
  dreamWebBackgroundTile: string; // "0" | "1"
  dreamWebBackgroundScale: string; // px, numeric string
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
  goalWebBackgroundImage: string; // raw data: URL, or "" for none
  goalWebBackgroundTile: string; // "0" | "1"
  goalWebBackgroundScale: string; // px, numeric string
  goalProjectNodeBackground: string;
  goalProjectNodeOutlineColor: string;
  outputNodeBackground: string;
  outputNodeOutlineColor: string;
  noteNodeBackground: string;
  noteNodeOutlineColor: string;
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
  "checkboxAccentColor",
  "checkboxBg",
  "primaryBg",
  "primaryText",
  "primaryHoverBg",
  "accent",
  "danger",
  "appBackgroundImage",
  "appBackgroundTile",
  "appBackgroundScale",
  "sidebarBgImage",
  "sidebarBgTile",
  "sidebarBgScale",
  "inputBgImage",
  "inputBgTile",
  "inputBgScale",
  "fontFamily",
  "radiusScale",
  "density",
  "navLayout",
  "sidebarMode",
  "surfaceStyle",
  "headingStyle",
  "backgroundStyle",
  "motionStyle",
  "mobileMode",
  "pageMaxWidth",
  "sidebarWidth",
  "pageTitleSize",
  "sidebarItemGap",
  "fieldSpacing",
  "mobilePagePaddingX",
  "mobilePagePaddingY",
  "mobileCardGap",
  "projectViewMode",
  "goalViewMode",
  "recipeViewMode",
  "responsibilityViewMode",
  "recipeColumnCount",
  "skillHomeViewMode",
  "skillAddControlPosition",
  "skillCreateMode",
  "skillCardWidth",
  "paneGridGap",
  "skillCardHeight",
  "skillTreeDefaultDirection",
  "goalClusterDirection",
  "detailColumnCount",
  "detailHeaderPosition",
  "pagePaddingTop",
  "pagePaddingRight",
  "pagePaddingBottom",
  "pagePaddingLeft",
  "cardPaddingTop",
  "cardPaddingRight",
  "cardPaddingBottom",
  "cardPaddingLeft",
  "customCss",
  "recipeThemeOverrides",
  "dreamThemeOverrides",
  "responsibilityThemeOverrides",
  "projectPaneShape",
  "skillPaneShape",
  "recipePaneShape",
  "responsibilityPaneShape",
  "nodeCardGrowToFit",
  "timeBasedThemeSchedule",
  "decals",
  "quickPhotoMenuCorner",
  "paneGridMenuCorner",
  "webBackground",
  "webBackgroundImage",
  "webBackgroundTile",
  "webBackgroundScale",
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
  "dreamWebBackgroundTile",
  "dreamWebBackgroundScale",
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
  "goalWebBackgroundImage",
  "goalWebBackgroundTile",
  "goalWebBackgroundScale",
  "goalProjectNodeBackground",
  "goalProjectNodeOutlineColor",
  "outputNodeBackground",
  "outputNodeOutlineColor",
  "noteNodeBackground",
  "noteNodeOutlineColor",
  // These three were previously omitted here even though setThemeSetting
  // wrote them to the DB unconditionally — fetchThemeSettings() filters
  // incoming rows by this list, so the values were silently dropped on
  // every app restart. Fixed alongside adding the Widget Visibility
  // settings group these three (plus showLaborLegend) belong to.
  "showCaptureButton",
  "showDynamicSearchButton",
  "showWebControls",
  "showLaborLegend",
  "sidebarAutoCloseOnMobileNav",
  "webGridColor",
  "widgetGridStyle",
  "notesSortOrder",
  "goalsHomeSortOrder",
  "projectsHomeSortOrder",
  "recipeHomeSortOrder",
  "responsibilityHomeSortOrder",
  "skillHomeSortOrder",
];

// Maps each general-theme key to the CSS custom property it drives.
// Must stay in sync with theme.css's --color-* / --bg-image-app
// declarations. appBackgroundImage's raw data: URL gets wrapped in
// url(...) by ThemeContext before being written to its property.
// Partial rather than a full Record: the *Tile/*Scale keys aren't a
// simple value passthrough (they resolve to different CSS properties
// depending on whether tiling is on — see ThemeContext's
// applyTileVars), so they're deliberately left out of this generic
// mechanism and handled by their own dedicated effects instead.
export const CSS_VAR_MAP: Partial<Record<keyof GeneralThemeSettings, string>> = {
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
  checkboxAccentColor: "--color-checkbox-accent",
  checkboxBg: "--color-checkbox-bg",
  primaryBg: "--color-primary-bg",
  primaryText: "--color-primary-text",
  primaryHoverBg: "--color-primary-hover-bg",
  accent: "--color-accent",
  danger: "--color-danger",
  appBackgroundImage: "--bg-image-app",
  sidebarBgImage: "--bg-image-sidebar",
  inputBgImage: "--bg-image-input",
};

// General-theme keys whose value is a raw data: URL that needs
// wrapping in url(...) before becoming a CSS custom property value.
export const IMAGE_GENERAL_KEYS: (keyof GeneralThemeSettings)[] = [
  "appBackgroundImage",
  "sidebarBgImage",
  "inputBgImage",
];

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
  checkboxAccentColor: "#2563eb",
  checkboxBg: "#ffffff",
  primaryBg: "#333333",
  primaryText: "#ffffff",
  primaryHoverBg: "#000000",
  accent: "#2563eb",
  danger: "#cc0000",
  appBackgroundImage: "",
  appBackgroundTile: "0",
  appBackgroundScale: "128",
  sidebarBgImage: "",
  sidebarBgTile: "0",
  sidebarBgScale: "128",
  inputBgImage: "",
  inputBgTile: "0",
  inputBgScale: "128",
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
  checkboxAccentColor: "#60a5fa",
  checkboxBg: "#22252c",
  primaryBg: "#4b5563",
  primaryText: "#ffffff",
  primaryHoverBg: "#64748b",
  accent: "#60a5fa",
  danger: "#f87171",
  appBackgroundImage: "",
  appBackgroundTile: "0",
  appBackgroundScale: "128",
  sidebarBgImage: "",
  sidebarBgTile: "0",
  sidebarBgScale: "128",
  inputBgImage: "",
  inputBgTile: "0",
  inputBgScale: "128",
};

export const WEB_DEFAULTS: WebThemeSettings = {
  webBackground: "#1e293b",
  webBackgroundImage: "",
  webBackgroundTile: "0",
  webBackgroundScale: "128",
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
  sidebarMode: "vertical",
  surfaceStyle: DEFAULT_SURFACE_STYLE,
  headingStyle: DEFAULT_HEADING_STYLE,
  backgroundStyle: DEFAULT_BACKGROUND_STYLE,
  motionStyle: DEFAULT_MOTION_STYLE,
  mobileMode: "auto",
  pageMaxWidth: "640",
  sidebarWidth: "220",
  pageTitleSize: "1.6",
  sidebarItemGap: "2",
  fieldSpacing: "16",
  // Mirrors the fallback values baked into theme.css / theme/mobile.css's
  // var(--mobile-*, default) — keep both in sync.
  mobilePagePaddingX: "20",
  mobilePagePaddingY: "20",
  mobileCardGap: "10",
  showCaptureButton: "1",
  showDynamicSearchButton: "1",
  showWebControls: "1",
  showLaborLegend: "1",
  sidebarAutoCloseOnMobileNav: "1",
  webGridColor: "#64748b",
  widgetGridStyle: "auto",
  notesSortOrder: "manual",
  goalsHomeSortOrder: "manual",
  projectsHomeSortOrder: "manual",
  recipeHomeSortOrder: "manual",
  responsibilityHomeSortOrder: "manual",
  skillHomeSortOrder: "manual",
  projectViewMode: "list",
  goalViewMode: "list",
  recipeViewMode: "list",
  responsibilityViewMode: "list",
  recipeColumnCount: "1",
  skillHomeViewMode: "grid",
  skillAddControlPosition: "top-left",
  skillCreateMode: "form",
  skillCardWidth: "",
  paneGridGap: "",
  skillCardHeight: "",
  skillTreeDefaultDirection: "horizontal",
  goalClusterDirection: "horizontal",
  detailColumnCount: "1",
  detailHeaderPosition: "above",
  pagePaddingTop: "",
  pagePaddingRight: "",
  pagePaddingBottom: "",
  pagePaddingLeft: "",
  cardPaddingTop: "",
  cardPaddingRight: "",
  cardPaddingBottom: "",
  cardPaddingLeft: "",
};

export const ADVANCED_DEFAULTS: AdvancedThemeSettings = {
  customCss: "",
  recipeThemeOverrides: "",
  dreamThemeOverrides: "",
  responsibilityThemeOverrides: "",
  projectPaneShape: "",
  skillPaneShape: "",
  recipePaneShape: "",
  responsibilityPaneShape: "",
  nodeCardGrowToFit: "0",
  timeBasedThemeSchedule: "",
  decals: "",
  quickPhotoMenuCorner: "tr",
  paneGridMenuCorner: "tr",
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
  dreamWebBackgroundTile: "0",
  dreamWebBackgroundScale: "128",
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
  goalWebBackgroundImage: "",
  goalWebBackgroundTile: "0",
  goalWebBackgroundScale: "128",
  goalProjectNodeBackground: "#155e75",
  goalProjectNodeOutlineColor: "#67e8f9",
  outputNodeBackground: "#78350f",
  outputNodeOutlineColor: "#d97706",
  noteNodeBackground: "#0c4a6e",
  noteNodeOutlineColor: "#38bdf8",
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
