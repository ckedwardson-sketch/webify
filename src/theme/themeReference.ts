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
        { key: "primaryBg", cssVar: "--color-primary-bg", currentValue: theme.primaryBg, type: "color-hex", description: "Primary/default button background." },
        { key: "primaryText", cssVar: "--color-primary-text", currentValue: theme.primaryText, type: "color-hex", description: "Primary button text color." },
        { key: "primaryHoverBg", cssVar: "--color-primary-hover-bg", currentValue: theme.primaryHoverBg, type: "color-hex", description: "Primary button background on hover." },
        { key: "accent", cssVar: "--color-accent", currentValue: theme.accent, type: "color-hex", description: "Accent color — links, highlights, focus rings, and it's also blended (via CSS color-mix()) into the 'gradient'/'grid'/'dotted' background patterns below." },
        { key: "danger", cssVar: "--color-danger", currentValue: theme.danger, type: "color-hex", description: "Destructive-action color (delete buttons, error text)." },
        { key: "appBackgroundImage", cssVar: "--bg-image-app", currentValue: theme.appBackgroundImage ? "(data: URL set)" : "(none)", type: "data-url-image", description: "Optional full-page background image, layered behind the background pattern. Empty string means none." },
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
        { key: "surfaceStyle", currentValue: theme.surfaceStyle, type: "preset-key", description: "How raised surfaces render their edge/depth: border width, shadow, backdrop blur, and background opacity (via CSS color-mix()).", validOptions: presetKeys(SURFACE_PRESETS) },
        { key: "headingStyle", currentValue: theme.headingStyle, type: "preset-key", description: "Typographic voice for headings (h1/h2/page titles), independent of the body font.", validOptions: presetKeys(HEADING_PRESETS) },
        { key: "backgroundStyle", currentValue: theme.backgroundStyle, type: "preset-key", description: "Generative background pattern for the main content pane — pure CSS gradients tinted from the accent/border colors, so they re-tint automatically if those change.", validOptions: presetKeys(BACKGROUND_PRESETS) },
        { key: "motionStyle", currentValue: theme.motionStyle, type: "preset-key", description: "Transition speed/easing and hover lift/scale for every interactive surface app-wide.", validOptions: presetKeys(MOTION_PRESETS) },
      ],
    },
    {
      category: "Advanced (raw escape hatches)",
      fields: [
        { key: "customCss", currentValue: theme.customCss ? `(${theme.customCss.length} chars set)` : "(empty)", type: "raw-css", description: "Raw CSS text injected verbatim as a <style> tag at the end of <body>, so it wins any same-specificity conflict. Use this for anything the structured fields above don't cover — e.g. a grain-overlay pseudo-element, or referencing a custom slider's CSS variable (see customSliders below)." },
        { key: "recipeThemeOverrides", currentValue: theme.recipeThemeOverrides ? "(set)" : "(empty)", type: "json-string", description: "JSON-stringified partial copy of the 'General colors' fields above, applied only within the Recipes section. Empty string/'{}' means 'inherit the global theme'." },
        { key: "dreamThemeOverrides", currentValue: theme.dreamThemeOverrides ? "(set)" : "(empty)", type: "json-string", description: "Same as recipeThemeOverrides, scoped to the Dreams section." },
        { key: "responsibilityThemeOverrides", currentValue: theme.responsibilityThemeOverrides ? "(set)" : "(empty)", type: "json-string", description: "Same as recipeThemeOverrides, scoped to the Responsibilities section." },
      ],
    },
    {
      category: "Recipe web / graph canvas colors (read directly by React components, not CSS variables)",
      fields: [
        { key: "webBackground", currentValue: theme.webBackground, type: "color-hex", description: "Recipe web canvas background color." },
        { key: "webBackgroundImage", currentValue: theme.webBackgroundImage ? "(data: URL set)" : "(none)", type: "data-url-image", description: "Optional background image for the recipe web canvas." },
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
        { key: "dreamNodeBackground", currentValue: theme.dreamNodeBackground, type: "color-hex", description: "Dream node background color." },
        { key: "dreamNodeOutlineColor", currentValue: theme.dreamNodeOutlineColor, type: "color-hex", description: "Dream node outline color." },
        { key: "dreamLinkColor", currentValue: theme.dreamLinkColor, type: "color-hex", description: "Color of link lines drawn between connected dreams." },
        { key: "dreamPriorityLow", currentValue: theme.dreamPriorityLow, type: "color-hex", description: "Accent color for low-priority dreams." },
        { key: "dreamPriorityMedium", currentValue: theme.dreamPriorityMedium, type: "color-hex", description: "Accent color for medium-priority dreams." },
        { key: "dreamPriorityHigh", currentValue: theme.dreamPriorityHigh, type: "color-hex", description: "Accent color for high-priority dreams." },
        { key: "dreamNodeShape", currentValue: theme.dreamNodeShape, type: "preset-key", description: "Silhouette for dream nodes (also used for project nodes).", validOptions: NODE_SHAPE_OPTIONS.map((o) => o.value) },
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
