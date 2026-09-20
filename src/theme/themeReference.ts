// Builds the "ready-made, fully annotated" theme reference document
// bundled into an Export to AI package (see ExportToAiModal.tsx). This
// solves a specific gap in the plain "Export Theme" button: that export
// only contains whatever the app's user has *overridden* — on a fresh
// install with zero customization, it's `{}` for themeSettings, which
// gives an AI designer nothing to work from. This file instead always
// lists every field the theme system supports, its current (possibly
// default) value, what it does, and — for preset-based fields — every
// valid option, regardless of whether the user has touched it.
import { ThemeSettings } from "./themeDefaults";
import { FONT_PRESETS } from "./fontPresets";
import { RADIUS_PRESETS, DENSITY_PRESETS } from "./scalePresets";
import { SURFACE_PRESETS } from "./surfacePresets";
import { HEADING_PRESETS } from "./headingPresets";
import { BACKGROUND_PRESETS } from "./backgroundPresets";
import { MOTION_PRESETS } from "./motionPresets";
import { NODE_SHAPE_OPTIONS } from "./nodeShapes";

export interface ThemeReferenceField {
  key: string;
  cssVar?: string;
  currentValue: string;
  type: "color-hex" | "data-url-image" | "preset-key" | "raw-css" | "json-string" | "numeric-string";
  description: string;
  validOptions?: string[];
}

export interface ThemeReferenceCategory {
  category: string;
  fields: ThemeReferenceField[];
}

const presetKeys = (record: Record<string, unknown>) => Object.keys(record);

export function buildThemeReferenceDoc(theme: ThemeSettings): {
  _about: string;
  generatedAt: string;
  categories: ThemeReferenceCategory[];
} {
  const categories: ThemeReferenceCategory[] = [
    {
      category: "General colors (drive real CSS custom properties app-wide)",
      fields: [
        { key: "mode", currentValue: theme.mode, type: "preset-key", description: "Light or dark base palette. Everything else layers on top of this.", validOptions: ["light", "dark"] },
        { key: "bg", cssVar: "--color-bg", currentValue: theme.bg, type: "color-hex", description: "Main page background color." },
        { key: "bgSecondary", cssVar: "--color-bg-secondary", currentValue: theme.bgSecondary, type: "color-hex", description: "Secondary background, used for subtly recessed areas." },
        { key: "bgElevated", cssVar: "--color-bg-elevated", currentValue: theme.bgElevated, type: "color-hex", description: "Background for raised surfaces: cards, panels, modals." },
        { key: "text", cssVar: "--color-text", currentValue: theme.text, type: "color-hex", description: "Primary body text color." },
        { key: "textSecondary", cssVar: "--color-text-secondary", currentValue: theme.textSecondary, type: "color-hex", description: "Muted/secondary text — captions, hints, timestamps." },
        { key: "border", cssVar: "--color-border", currentValue: theme.border, type: "color-hex", description: "Default hairline border color." },
        { key: "borderStrong", cssVar: "--color-border-strong", currentValue: theme.borderStrong, type: "color-hex", description: "Higher-contrast border, used for emphasis or on top of patterned backgrounds." },
        { key: "sidebarBg", cssVar: "--color-sidebar-bg", currentValue: theme.sidebarBg, type: "color-hex", description: "Sidebar/navigation background color." },
        { key: "sidebarText", cssVar: "--color-sidebar-text", currentValue: theme.sidebarText, type: "color-hex", description: "Sidebar nav item text color (inactive)." },
        { key: "sidebarTextActive", cssVar: "--color-sidebar-text-active", currentValue: theme.sidebarTextActive, type: "color-hex", description: "Sidebar nav item text color when that page is active." },
        { key: "sidebarHoverBg", cssVar: "--color-sidebar-hover-bg", currentValue: theme.sidebarHoverBg, type: "color-hex", description: "Sidebar nav item background on hover." },
        { key: "sidebarActiveBg", cssVar: "--color-sidebar-active-bg", currentValue: theme.sidebarActiveBg, type: "color-hex", description: "Sidebar nav item background when that page is active." },
        { key: "inputBg", cssVar: "--color-input-bg", currentValue: theme.inputBg, type: "color-hex", description: "Background of text inputs, textareas, selects." },
        { key: "inputText", cssVar: "--color-input-text", currentValue: theme.inputText, type: "color-hex", description: "Text color inside inputs." },
        { key: "checkboxAccentColor", cssVar: "--color-checkbox-accent", currentValue: theme.checkboxAccentColor, type: "color-hex", description: "Native checkbox/radio checked-state fill color (CSS accent-color). This and checkboxBg are the only two properties a plain <input type=\"checkbox\"> can be themed with cross-browser." },
        { key: "checkboxBg", cssVar: "--color-checkbox-bg", currentValue: theme.checkboxBg, type: "color-hex", description: "Native checkbox/radio unchecked-state background color." },
        { key: "primaryBg", cssVar: "--color-primary-bg", currentValue: theme.primaryBg, type: "color-hex", description: "Primary/default button background." },
        { key: "primaryText", cssVar: "--color-primary-text", currentValue: theme.primaryText, type: "color-hex", description: "Primary button text color." },
        { key: "primaryHoverBg", cssVar: "--color-primary-hover-bg", currentValue: theme.primaryHoverBg, type: "color-hex", description: "Primary button background on hover." },
        { key: "accent", cssVar: "--color-accent", currentValue: theme.accent, type: "color-hex", description: "Accent color — links, highlights, focus rings, and it's also blended (via CSS color-mix()) into the 'gradient'/'grid'/'dotted' background patterns below." },
        { key: "danger", cssVar: "--color-danger", currentValue: theme.danger, type: "color-hex", description: "Destructive-action color (delete buttons, error text)." },
        { key: "appBackgroundImage", cssVar: "--bg-image-app", currentValue: theme.appBackgroundImage ? "(data: URL set)" : "(none)", type: "data-url-image", description: "Optional full-page background image, layered behind the background pattern. Empty string means none." },
        { key: "appBackgroundTile", currentValue: theme.appBackgroundTile, type: "preset-key", description: "\"1\" tiles appBackgroundImage as a repeating pattern at appBackgroundScale px; \"0\" (default) covers/centers it like a normal full-bleed background. No effect while appBackgroundImage is empty.", validOptions: ["0", "1"] },
        { key: "appBackgroundScale", currentValue: theme.appBackgroundScale, type: "numeric-string", description: "Tile size in px for appBackgroundImage, only used when appBackgroundTile is \"1\"." },
        { key: "sidebarBgImage", cssVar: "--bg-image-sidebar", currentValue: theme.sidebarBgImage ? "(data: URL set)" : "(none)", type: "data-url-image", description: "Optional background image for the sidebar/nav, independent of the main page background." },
        { key: "sidebarBgTile", currentValue: theme.sidebarBgTile, type: "preset-key", description: "Same tile/cover switch as appBackgroundTile, applied to sidebarBgImage.", validOptions: ["0", "1"] },
        { key: "sidebarBgScale", currentValue: theme.sidebarBgScale, type: "numeric-string", description: "Tile size in px for sidebarBgImage, only used when sidebarBgTile is \"1\"." },
        { key: "inputBgImage", cssVar: "--bg-image-input", currentValue: theme.inputBgImage ? "(data: URL set)" : "(none)", type: "data-url-image", description: "Optional background image for text inputs/textareas/selects." },
        { key: "inputBgTile", currentValue: theme.inputBgTile, type: "preset-key", description: "Same tile/cover switch as appBackgroundTile, applied to inputBgImage.", validOptions: ["0", "1"] },
        { key: "inputBgScale", currentValue: theme.inputBgScale, type: "numeric-string", description: "Tile size in px for inputBgImage, only used when inputBgTile is \"1\"." },
      ],
    },
    {
      category: "Typography, radius & density (named presets, not raw values)",
      fields: [
        { key: "fontFamily", currentValue: theme.fontFamily, type: "preset-key", description: "Body font stack, chosen from an offline-safe curated list (so the theme renders identically on any machine).", validOptions: presetKeys(Object.fromEntries(FONT_PRESETS.map((f) => [f.key, f]))) },
        { key: "radiusScale", currentValue: theme.radiusScale, type: "preset-key", description: "Corner-rounding scale applied to buttons, cards, inputs everywhere.", validOptions: presetKeys(RADIUS_PRESETS) },
        { key: "density", currentValue: theme.density, type: "preset-key", description: "Spacing/padding scale app-wide — how tight or airy the layout feels.", validOptions: presetKeys(DENSITY_PRESETS) },
      ],
    },
    {
      category: "Layout & atmosphere (each fans out to several CSS properties)",
      fields: [
        { key: "navLayout", currentValue: theme.navLayout, type: "preset-key", description: "Sidebar position.", validOptions: ["left", "right", "top"] },
        { key: "sidebarMode", currentValue: theme.sidebarMode, type: "preset-key", description: "Sidebar item layout, independent of navLayout's position. 'icon-small'/'icon-large' render each nav item as a square icon pane with its label underneath (icon comes from icons.nav-<label> in the icon bundle); 'horizontal'/'horizontal-tiled' turn the item list into a row/tiled grid regardless of dock position.", validOptions: ["vertical", "horizontal", "horizontal-tiled", "icon-small", "icon-large"] },
        { key: "surfaceStyle", currentValue: theme.surfaceStyle, type: "preset-key", description: "How raised surfaces render their edge/depth: border width, shadow, backdrop blur, and background opacity (via CSS color-mix()).", validOptions: presetKeys(SURFACE_PRESETS) },
        { key: "headingStyle", currentValue: theme.headingStyle, type: "preset-key", description: "Typographic voice for headings (h1/h2/page titles), independent of the body font.", validOptions: presetKeys(HEADING_PRESETS) },
        { key: "backgroundStyle", currentValue: theme.backgroundStyle, type: "preset-key", description: "Generative background pattern for the main content pane — pure CSS gradients tinted from the accent/border colors, so they re-tint automatically if those change. Only 5 fixed patterns; 'gradient' is a single accent-tinted glow, not a real multi-stop gradient. For a specific multi-color gradient (aurora, sunset, etc.), omit this key entirely and set the raw --bg-pattern CSS variable via customCss instead — see AI_DESIGNER_INSTRUCTIONS.md.", validOptions: presetKeys(BACKGROUND_PRESETS) },
        { key: "motionStyle", currentValue: theme.motionStyle, type: "preset-key", description: "Transition speed/easing and hover lift/scale for every interactive surface app-wide.", validOptions: presetKeys(MOTION_PRESETS) },
      ],
    },
    {
      category: "Structural layout (raw px/rem values, blank = built-in default)",
      fields: [
        { key: "pageMaxWidth", currentValue: theme.pageMaxWidth || "(default 640)", type: "numeric-string", description: "Max width in px of the centered content column on every page." },
        { key: "sidebarWidth", currentValue: theme.sidebarWidth || "(default 220)", type: "numeric-string", description: "Sidebar width in px (vertical sidebar modes only)." },
        { key: "pageTitleSize", currentValue: theme.pageTitleSize || "(default 1.6)", type: "numeric-string", description: "Page <h1> title font size in rem." },
        { key: "sidebarItemGap", currentValue: theme.sidebarItemGap || "(default 2)", type: "numeric-string", description: "Gap in px between sidebar nav items." },
        { key: "fieldSpacing", currentValue: theme.fieldSpacing || "(default 16)", type: "numeric-string", description: "Gap in px between fields on Detail pages (Project/Goal/Dream)." },
        { key: "mobileMode", currentValue: theme.mobileMode, type: "preset-key", description: "Forces mobile/desktop layout regardless of actual window size, or 'auto' to detect it from viewport width.", validOptions: ["auto", "mobile", "desktop"] },
        { key: "mobilePagePaddingX", currentValue: theme.mobilePagePaddingX || "(default 20)", type: "numeric-string", description: "Page horizontal padding in px, mobile layout only." },
        { key: "mobilePagePaddingY", currentValue: theme.mobilePagePaddingY || "(default 20)", type: "numeric-string", description: "Page vertical padding in px, mobile layout only." },
        { key: "mobileCardGap", currentValue: theme.mobileCardGap || "(default 10)", type: "numeric-string", description: "Gap in px between cards/list rows, mobile layout only." },
      ],
    },
    {
      category: "View modes (independent per surface)",
      fields: [
        { key: "projectViewMode", currentValue: theme.projectViewMode, type: "preset-key", description: "Projects list rendering. 'list-image-left' shows a thumbnail before the name (only appears once a project has one). 'pane-small'/'pane-large'/'icon-grid' switch to a square-pane grid with a triple-dot rename/delete menu.", validOptions: ["list", "list-image-left", "pane-small", "pane-large", "icon-grid"] },
        { key: "goalViewMode", currentValue: theme.goalViewMode, type: "preset-key", description: "Same options as projectViewMode, applied to the Goals list.", validOptions: ["list", "list-image-left", "pane-small", "pane-large", "icon-grid"] },
        { key: "recipeViewMode", currentValue: theme.recipeViewMode, type: "preset-key", description: "Same options as projectViewMode, applied to both the Recipes category list and the recipe list inside a category.", validOptions: ["list", "list-image-left", "pane-small", "pane-large", "icon-grid"] },
        { key: "recipeColumnCount", currentValue: theme.recipeColumnCount, type: "preset-key", description: "Splits the Recipes list into 2-3 CSS columns separated by a rule line. Only visible when recipeViewMode is 'list' or 'list-image-left' — the pane/icon-grid modes already wrap.", validOptions: ["1", "2", "3"] },
        { key: "recipeDualPaneMode", currentValue: theme.recipeDualPaneMode, type: "preset-key", description: "Future Slot recipe links (RecipeDetailPage): whether clicking a link's extracted recipe opens a second column on desktop. 'permanent' always shows two columns, 'smart' only opens the second column once a link is clicked, 'none' never splits.", validOptions: ["permanent", "smart", "none"] },
        { key: "recipeLinkClickMode", currentValue: theme.recipeLinkClickMode, type: "preset-key", description: "Future Slot recipe links: what clicking a link's center does with the extracted recipe text. 'copy' only puts it on the clipboard, 'replace' overwrites the second column's saved content, 'instant-place' appends it with a divider.", validOptions: ["copy", "replace", "instant-place"] },
        { key: "responsibilityViewMode", currentValue: theme.responsibilityViewMode, type: "preset-key", description: "Same options as projectViewMode, applied to the Responsibilities list.", validOptions: ["list", "list-image-left", "pane-small", "pane-large", "icon-grid"] },
        { key: "skillHomeViewMode", currentValue: theme.skillHomeViewMode, type: "preset-key", description: "Skills home page rendering: card grid (default) or a plain list like Projects.", validOptions: ["grid", "list"] },
        { key: "skillAddControlPosition", currentValue: theme.skillAddControlPosition, type: "preset-key", description: "Where the '+ Add Skill' control sits on the Skills home page.", validOptions: ["top-left", "top-right", "bottom-left", "bottom-right", "floating"] },
        { key: "skillCreateMode", currentValue: theme.skillCreateMode, type: "preset-key", description: "'form' shows a name text box + button. 'quick-add' skips the text box — clicking the control immediately creates a skill named 'New Skill' and opens its tree, where the tree's title is click-to-rename.", validOptions: ["form", "quick-add"] },
        { key: "skillCardWidth", currentValue: theme.skillCardWidth || "(auto)", type: "numeric-string", description: "Skill card grid column width in px. Empty = auto (today's 200px minmax)." },
        { key: "paneGridGap", currentValue: theme.paneGridGap || "(default)", type: "numeric-string", description: "Gap in px between cards in every PaneGrid-backed grid (Projects/Goals/Recipes/Responsibilities pane/icon-grid view) AND the Skills page's card grid — one shared spacing knob. Empty = each surface's own built-in default." },
        { key: "skillCardHeight", currentValue: theme.skillCardHeight || "(auto)", type: "numeric-string", description: "Skill card height in px. Empty = auto (content height)." },
        { key: "skillTreeDefaultDirection", currentValue: theme.skillTreeDefaultDirection, type: "preset-key", description: "Tree growth direction a newly-created skill starts with. Applied once at creation time — existing skills keep whichever direction they already have (each skill's direction is stored per-skill and editable in that skill's own tree settings panel, not in this theme). Use this to make a 'vertical skill tree' theme feel consistent for every skill going forward.", validOptions: ["horizontal", "vertical"] },
        { key: "goalClusterDirection", currentValue: theme.goalClusterDirection, type: "preset-key", description: "Rotates the Goal Web / Progress Web cluster (projects, tasks, responsibilities around a goal) from left-right (default) to top-down. Shared by the Goal Web page and Dream Web's 'full' per-goal view.", validOptions: ["horizontal", "vertical"] },
        { key: "detailColumnCount", currentValue: theme.detailColumnCount, type: "preset-key", description: "Splits Project/Goal/Dream Detail page fields into 1-3 side-by-side columns. Which field goes in which column is assigned per-field (rearrange mode's Columns tool), not by this setting — this only controls how many columns exist.", validOptions: ["1", "2", "3"] },
        { key: "detailHeaderPosition", currentValue: theme.detailHeaderPosition, type: "preset-key", description: "Where the page title + action buttons sit relative to the field columns on Project/Goal/Dream Detail pages.", validOptions: ["none", "above", "beside", "overlay"] },
      ],
    },
    {
      category: "Uneven padding (px, per side; empty = symmetric default)",
      fields: [
        { key: "pagePaddingTop", currentValue: theme.pagePaddingTop || "(default)", type: "numeric-string", description: "Overrides page top padding independently of the other 3 sides — e.g. leave one side wide for a background image. Empty inherits the symmetric --space-page-y default." },
        { key: "pagePaddingRight", currentValue: theme.pagePaddingRight || "(default)", type: "numeric-string", description: "Overrides page right padding. Empty inherits the symmetric --space-page-x default." },
        { key: "pagePaddingBottom", currentValue: theme.pagePaddingBottom || "(default)", type: "numeric-string", description: "Overrides page bottom padding. Empty inherits the symmetric --space-page-y default." },
        { key: "pagePaddingLeft", currentValue: theme.pagePaddingLeft || "(default)", type: "numeric-string", description: "Overrides page left padding. Empty inherits the symmetric --space-page-x default." },
        { key: "cardPaddingTop", currentValue: theme.cardPaddingTop || "(default)", type: "numeric-string", description: "Overrides top padding on the shared pane-shape-surface card utility (Skills cards, Projects/Recipes/Responsibilities pane views). Empty keeps each surface's own default (e.g. Skill cards' 16px)." },
        { key: "cardPaddingRight", currentValue: theme.cardPaddingRight || "(default)", type: "numeric-string", description: "Same as cardPaddingTop, right side." },
        { key: "cardPaddingBottom", currentValue: theme.cardPaddingBottom || "(default)", type: "numeric-string", description: "Same as cardPaddingTop, bottom side." },
        { key: "cardPaddingLeft", currentValue: theme.cardPaddingLeft || "(default)", type: "numeric-string", description: "Same as cardPaddingTop, left side." },
      ],
    },
    {
      category: "Advanced (raw escape hatches)",
      fields: [
        { key: "customCss", currentValue: theme.customCss ? `(${theme.customCss.length} chars set)` : "(empty)", type: "raw-css", description: "Raw CSS text injected verbatim as a <style> tag at the end of <body>, so it wins any same-specificity conflict. Use this for anything the structured fields above don't cover — e.g. a grain-overlay pseudo-element, or referencing a custom slider's CSS variable (see customSliders below)." },
        { key: "recipeThemeOverrides", currentValue: theme.recipeThemeOverrides ? "(set)" : "(empty)", type: "json-string", description: "JSON-stringified partial copy of the 'General colors' fields above, applied only within the Recipes section. Empty string/'{}' means 'inherit the global theme'." },
        { key: "dreamThemeOverrides", currentValue: theme.dreamThemeOverrides ? "(set)" : "(empty)", type: "json-string", description: "Same as recipeThemeOverrides, scoped to the Dreams section." },
        { key: "responsibilityThemeOverrides", currentValue: theme.responsibilityThemeOverrides ? "(set)" : "(empty)", type: "json-string", description: "Same as recipeThemeOverrides, scoped to the Responsibilities section." },
        { key: "projectPaneShape", currentValue: theme.projectPaneShape ? "(set)" : "(empty)", type: "json-string", description: "PaneShapeProfile JSON for the Projects pane/icon-grid view: { curve: 'sharp'|'soft'|'round'|'pill', truncation: 'clip'|'ellipsis'|'wrap'|'wrap-2'|'wrap-3', borderLayers: [{enabled, color, width, offset}] (up to 4) }. Empty means defaults (soft curve, ellipsis, no border rings)." },
        { key: "skillPaneShape", currentValue: theme.skillPaneShape ? "(set)" : "(empty)", type: "json-string", description: "Same PaneShapeProfile shape as projectPaneShape, applied to Skill nodes/panes." },
        { key: "recipePaneShape", currentValue: theme.recipePaneShape ? "(set)" : "(empty)", type: "json-string", description: "Same PaneShapeProfile shape as projectPaneShape, applied to the Recipes icon grid." },
        { key: "responsibilityPaneShape", currentValue: theme.responsibilityPaneShape ? "(set)" : "(empty)", type: "json-string", description: "Same PaneShapeProfile shape as projectPaneShape, applied to the Responsibilities icon grid." },
        { key: "timeBasedThemeSchedule", currentValue: theme.timeBasedThemeSchedule ? "(set)" : "(empty)", type: "json-string", description: "JSON array of {startHour: 0-23, presetName: string} entries. Each presetName must match a theme already saved in the Settings > Theme preset library (see db/themePresets.ts) — this field only selects between existing saved presets, it doesn't define a new theme inline. The app checks the current hour once a minute and fully applies the matching preset's themeSettings via the same path as a manual preset switch. Empty/'[]' disables automatic switching." },
        { key: "decals", currentValue: theme.decals ? "(set)" : "(empty)", type: "json-string", description: "JSON array of DecalDef — small emoji or images anchored to a pane card, a web/graph canvas, or a page background, each with its own rotation/scale. Each entry: {id: string, source: an emoji character OR a \"data:image/...\" URL, target: \"pane\"|\"canvas\"|\"page-bg\", surface?: string (a pane surface — \"project\"|\"skill\"|\"recipe\"|\"responsibility\" — for target \"pane\", or a section key like \"section:dreams-web\"/\"section:goal-web\"/\"section:recipes-graph\"/\"section:projects-home\" etc. for \"canvas\"/\"page-bg\"; omit to apply to every instance of that target), anchor: \"corner-tl\"|\"corner-tr\"|\"corner-bl\"|\"corner-br\"|\"center-overlap\"|\"edge\"|\"free\", x?/y?: number (percent 0-100 for pane/page-bg, raw canvas-space units for canvas — only used when anchor is \"free\"), rotation: degrees, scale: multiplier where 1 = natural size}. Empty/'[]' disables decals entirely. See design-vocabulary.json for the full anchor/target/surface enums." },
      ],
    },
    {
      category: "Recipe web / graph canvas colors (read directly by React components, not CSS variables)",
      fields: [
        { key: "webBackground", currentValue: theme.webBackground, type: "color-hex", description: "Recipe web canvas background color." },
        { key: "webBackgroundImage", currentValue: theme.webBackgroundImage ? "(data: URL set)" : "(none)", type: "data-url-image", description: "Optional background image for the recipe web canvas." },
        { key: "webBackgroundTile", currentValue: theme.webBackgroundTile, type: "preset-key", description: "\"1\" tiles webBackgroundImage; \"0\" (default) covers the canvas. No effect while webBackgroundImage is empty.", validOptions: ["0", "1"] },
        { key: "webBackgroundScale", currentValue: theme.webBackgroundScale, type: "numeric-string", description: "Tile size in px for webBackgroundImage, only used when webBackgroundTile is \"1\"." },
        { key: "webNodeProvenBackground", currentValue: theme.webNodeProvenBackground, type: "color-hex", description: "Recipe card background when marked 'proven'." },
        { key: "webNodeUnprovenBackground", currentValue: theme.webNodeUnprovenBackground, type: "color-hex", description: "Recipe card background when not marked 'proven'." },
        { key: "webNodeOutlineColor", currentValue: theme.webNodeOutlineColor, type: "color-hex", description: "Outline color for recipe cards on the web canvas." },
        { key: "webCategoryNodeBackground", currentValue: theme.webCategoryNodeBackground, type: "color-hex", description: "Category node background on the recipe web canvas." },
        { key: "webIterationNodeBackground", currentValue: theme.webIterationNodeBackground, type: "color-hex", description: "Recipe-iteration node background on the recipe web canvas." },
        { key: "webCardShadow", currentValue: theme.webCardShadow, type: "preset-key", description: "Recipe card shadow intensity.", validOptions: ["none", "soft", "strong"] },
        { key: "webCardRadius", currentValue: theme.webCardRadius, type: "numeric-string", description: "Recipe card corner radius in pixels (numeric string, e.g. \"10\")." },
        { key: "webCardImageStyle", currentValue: theme.webCardImageStyle, type: "preset-key", description: "How a recipe's photo fills its card.", validOptions: ["boxed", "fill"] },
        { key: "webCardShape", currentValue: theme.webCardShape, type: "preset-key", description: "Overall silhouette of recipe/category/dream/project cards on their web canvases.", validOptions: NODE_SHAPE_OPTIONS.map((o) => o.value) },
      ],
    },
    {
      category: "Progress web colors (read directly by React components)",
      fields: [
        { key: "progressWebBackground", currentValue: theme.progressWebBackground, type: "color-hex", description: "Progress web canvas background color." },
        { key: "progressLaborColor", currentValue: theme.progressLaborColor, type: "color-hex", description: "Node color for the 'Labor' work category." },
        { key: "progressPurchaseColor", currentValue: theme.progressPurchaseColor, type: "color-hex", description: "Node color for the 'Purchase' work category." },
        { key: "progressDesignColor", currentValue: theme.progressDesignColor, type: "color-hex", description: "Node color for the 'Design' work category." },
        { key: "progressConceiveColor", currentValue: theme.progressConceiveColor, type: "color-hex", description: "Node color for the 'Conceive' work category." },
        { key: "progressTaskColor", currentValue: theme.progressTaskColor, type: "color-hex", description: "Node color for generic tasks." },
      ],
    },
    {
      category: "Dream web colors (read directly by React components)",
      fields: [
        { key: "dreamWebBackground", currentValue: theme.dreamWebBackground, type: "color-hex", description: "Dream web canvas background color." },
        { key: "dreamWebBackgroundImage", currentValue: theme.dreamWebBackgroundImage ? "(data: URL set)" : "(none)", type: "data-url-image", description: "Optional background image for the dream web canvas." },
        { key: "dreamWebBackgroundTile", currentValue: theme.dreamWebBackgroundTile, type: "preset-key", description: "\"1\" tiles dreamWebBackgroundImage; \"0\" (default) covers the canvas. No effect while dreamWebBackgroundImage is empty.", validOptions: ["0", "1"] },
        { key: "dreamWebBackgroundScale", currentValue: theme.dreamWebBackgroundScale, type: "numeric-string", description: "Tile size in px for dreamWebBackgroundImage, only used when dreamWebBackgroundTile is \"1\"." },
        { key: "dreamNodeBackground", currentValue: theme.dreamNodeBackground, type: "color-hex", description: "Dream node background color." },
        { key: "dreamNodeOutlineColor", currentValue: theme.dreamNodeOutlineColor, type: "color-hex", description: "Dream node outline color." },
        { key: "dreamLinkColor", currentValue: theme.dreamLinkColor, type: "color-hex", description: "Color of link lines drawn between connected dreams." },
        { key: "dreamPriorityLow", currentValue: theme.dreamPriorityLow, type: "color-hex", description: "Accent color for low-priority dreams." },
        { key: "dreamPriorityMedium", currentValue: theme.dreamPriorityMedium, type: "color-hex", description: "Accent color for medium-priority dreams." },
        { key: "dreamPriorityHigh", currentValue: theme.dreamPriorityHigh, type: "color-hex", description: "Accent color for high-priority dreams." },
        { key: "dreamNodeShape", currentValue: theme.dreamNodeShape, type: "preset-key", description: "Silhouette for dream nodes (also used for project nodes).", validOptions: NODE_SHAPE_OPTIONS.map((o) => o.value) },
        { key: "dreamGoalNodeBackground", currentValue: theme.dreamGoalNodeBackground, type: "color-hex", description: "Background of the small goal node that auto-appears on its parent dream's node." },
        { key: "dreamGoalNodeOutlineColor", currentValue: theme.dreamGoalNodeOutlineColor, type: "color-hex", description: "Outline color of that same small goal node." },
        { key: "nodeCardGrowToFit", currentValue: theme.nodeCardGrowToFit, type: "preset-key", description: "Whether Dream/Goal/Project web cards grow taller to fit every field marked 'show on web' (\"1\"), or stay a fixed size with overflow scrolling (\"0\", default).", validOptions: ["0", "1"] },
      ],
    },
    {
      category: "Goal web colors (read directly by React components, not CSS variables)",
      fields: [
        { key: "goalWebBackground", currentValue: theme.goalWebBackground, type: "color-hex", description: "Goal web canvas background color." },
        { key: "goalWebBackgroundImage", currentValue: theme.goalWebBackgroundImage ? "(data: URL set)" : "(none)", type: "data-url-image", description: "Optional background image for the goal web canvas." },
        { key: "goalWebBackgroundTile", currentValue: theme.goalWebBackgroundTile, type: "preset-key", description: "\"1\" tiles goalWebBackgroundImage; \"0\" (default) covers the canvas. No effect while goalWebBackgroundImage is empty.", validOptions: ["0", "1"] },
        { key: "goalWebBackgroundScale", currentValue: theme.goalWebBackgroundScale, type: "numeric-string", description: "Tile size in px for goalWebBackgroundImage, only used when goalWebBackgroundTile is \"1\"." },
        { key: "goalProjectNodeBackground", currentValue: theme.goalProjectNodeBackground, type: "color-hex", description: "Background of project nodes on the Goal Web canvas (each project linked to this goal)." },
        { key: "goalProjectNodeOutlineColor", currentValue: theme.goalProjectNodeOutlineColor, type: "color-hex", description: "Outline color of those same project nodes." },
        { key: "outputNodeBackground", currentValue: theme.outputNodeBackground, type: "color-hex", description: "Background of Output nodes (things a Task produced) on the Web canvas." },
        { key: "outputNodeOutlineColor", currentValue: theme.outputNodeOutlineColor, type: "color-hex", description: "Outline color of Output nodes." },
        { key: "noteNodeBackground", currentValue: theme.noteNodeBackground, type: "color-hex", description: "Background of Note-shortcut nodes attached to a Goal/Dream Web." },
        { key: "noteNodeOutlineColor", currentValue: theme.noteNodeOutlineColor, type: "color-hex", description: "Outline color of Note-shortcut nodes." },
      ],
    },
  ];

  return {
    _about:
      "This is the complete, always-populated list of every theme variable Webify supports, with its current value (defaults included, even if the app's user has never customized anything) and a description of what it controls. It is meant as a reference for an AI designer building a new theme — it is NOT the file to hand back; return a single theme JSON matching the 'ThemeExport' shape described in AI_DESIGNER_INSTRUCTIONS.md instead.",
    generatedAt: new Date().toISOString(),
    categories,
  };
}
