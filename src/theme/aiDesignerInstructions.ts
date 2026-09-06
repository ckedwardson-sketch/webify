import { ANIMATION_PRESETS, fillAnimationTemplate } from "./animationPresets";

// Builds the Markdown brief that ships inside every Export to AI
// package (see ExportToAiModal.tsx). This is the piece that turns "here
// are some files" into an actual usable hand-off to an AI designer: it
// states the user's own design brief verbatim, pushes toward bold /
// cohesive results instead of one-color-tweak nudges, spells out the
// exact JSON shape expected back, and documents the custom-slider
// convention (the mechanism, in theme/customSliders.ts, that lets a
// designer expose its own adjustable knobs — e.g. a grain-overlay
// opacity — as real sliders in the app after import).
export function buildAiDesignerInstructions(opts: {
  userIdea: string;
  pageLabels: string[];
  generatedAt: string;
}): string {
  const { userIdea, pageLabels, generatedAt } = opts;

  const pageList = pageLabels.length > 0
    ? pageLabels.map((l) => `- ${l}`).join("\n")
    : "(no pages were captured for this package — screenshots.pdf may be absent or empty)";

  return `# Webify — AI Theme Designer Brief

Generated: ${generatedAt}

## What you're looking at

This package was exported from Webify, a desktop app, using its "Export to AI" feature. It bundles everything you need to design a new visual theme for the app and hand it back as a single JSON file the app can import.

Package contents:
- **AI_DESIGNER_INSTRUCTIONS.md** — this file.
- **theme-current-state.json** — the app's theme settings *as currently customized* (may be mostly/entirely empty on a fresh install — that's expected, not missing data).
- **theme-variable-reference.json** — every theme variable Webify supports, always fully populated (defaults included), with a plain-English description of what each one visually controls and, for preset-based fields, the full list of valid values. Use this as your reference of what's controllable — not theme-current-state.json, which may be sparse.
- **icon-registry.json** — every icon key the \`icons\` override map (see below) can target, with its label and current default glyph (an emoji). This is the only place these keys are listed — don't guess icon key names.
- **theme-current-state.json**'s \`pageBackgrounds\` — a per-section background image/color layer, independent of everything else (see below).
- **design-vocabulary.json** — one combined reference of every fixed key/enum the theme system accepts: icon keys, node-shape keys, pane-shape curve/truncation/surface enums, and decal target/anchor/surface enums. Start here before guessing at any of these — icon-registry.json and theme-variable-reference.json cover the same ground in more detail per-topic, but this is the one-stop list.
- **screenshots.pdf** — one page per screen the user selected, showing what the app currently looks like:
${pageList}

## The user's design brief

> ${userIdea.trim() || "(the user did not type a specific idea — use your own judgment for a distinctive, cohesive theme)"}

## Direction: go bold, go wide

Favor a **bold, distinctive, cohesive reskin** over a light color tweak. A good result typically changes several dimensions together, not just \`accent\`/\`bg\`/\`text\`:
- **Color** — the full general-color set (backgrounds, text, borders, sidebar, primary button, accent, danger), not just one or two fields.
- **Typography** — \`fontFamily\` and \`headingStyle\` together, so headings and body text read as one coherent voice.
- **Shape & surface** — \`radiusScale\`, \`surfaceStyle\`, and \`webCardShape\`/\`dreamNodeShape\` (card silhouettes) — these change the app's whole tactile feel, not just its palette.
- **Background** — \`backgroundStyle\` (a generative pattern) and/or \`appBackgroundImage\`/\`customCss\` for something more atmospheric.
- **Motion** — \`motionStyle\` changes how "alive" hover/interaction feels; a bold theme rarely leaves this on the sleepy default.

Only stay subtle if the user's brief above explicitly asks for something minimal, restrained, or "just tweak X."

### Beyond the 5 background patterns

\`backgroundStyle\` only covers 5 fixed patterns (solid/gradient/grid/dotted/noise), and \`gradient\` is a single accent-tinted radial glow — not a real multi-color gradient. For something like an aurora, sunset, or any specific multi-stop gradient, **leave \`backgroundStyle\` out of \`themeSettings\` entirely** and set the raw CSS variable it would otherwise control, via \`customCss\`:

\`\`\`css
:root { --bg-pattern: linear-gradient(160deg, #0b1d3a 0%, #1b4332 45%, #52b788 75%, #d8f3dc 100%); --bg-pattern-size: auto; }
\`\`\`

This works because \`backgroundStyle\` is applied as an inline style on \`<html>\` — if you set \`backgroundStyle\` in \`themeSettings\` at all (even to \`"solid"\`), that inline style wins over anything \`customCss\` sets for the same variable, silently overriding your gradient. Omitting the key is what leaves the CSS variable free for \`customCss\` to control.

## What to return

Return **one JSON file** (or a fenced \`\`\`json code block if replying inline) matching this shape:

\`\`\`json
{
  "icons": {},
  "textElements": {},
  "buttonStyles": {},
  "themeSettings": {
    "mode": "dark",
    "bg": "#0b0d12",
    "accent": "#ff5c8a",
    "fontFamily": "geometric",
    "headingStyle": "editorial",
    "radiusScale": "rounded",
    "surfaceStyle": "glass",
    "backgroundStyle": "gradient",
    "motionStyle": "lively",
    "customCss": "/* optional extra rules, see below */"
  },
  "customSliders": []
}
\`\`\`

Rules:
- \`themeSettings\` is a **partial** object — include only the keys you're intentionally setting; anything omitted falls back to Webify's default for that key. Every valid key, its type, and (for preset fields) its exact allowed values are listed in **theme-variable-reference.json**. Do not invent key names or preset values not listed there — an unrecognized key is silently ignored, and an unrecognized preset value falls back to that field's default.
- All color values are CSS hex strings (\`"#rrggbb"\`).
- \`textElements\` and \`buttonStyles\` are almost always left as empty objects \`{}\` unless you deliberately want to restyle a specific editor-toolbar letter or button beyond what the theme fields cover — leave them out entirely rather than guessing at their shape.
- \`icons\` is a flat \`{ "<key>": "<emoji>" }\` map — every valid key is listed in **icon-registry.json** with its current default glyph, so you can look up exactly which icon a key controls before overriding it. This is worth using deliberately (not left empty) whenever \`sidebarMode\` is set to \`"icon-small"\` or \`"icon-large"\`: those modes render one icon per nav item from the keys \`nav-home\`, \`nav-dreams\`, \`nav-goals\`, \`nav-projects\`, \`nav-skills\`, \`nav-recipes\`, \`nav-responsibilities\`, \`nav-inventory\`, \`nav-notes\`, \`nav-settings\` — e.g. \`"icons": { "nav-home": "🏠", "nav-dreams": "✨" }\` to match a theme's overall vibe instead of leaving the generic defaults.
- \`customCss\` is raw CSS text injected as a real \`<style>\` tag at the end of \`<body>\` — use it for anything the structured fields don't cover (decorative overlays, unusual gradients, animations).

## Adding your own adjustable sliders (optional, but encouraged for "feel" parameters)

If your theme includes a value that's naturally a continuous dial rather than a fixed setting — grain/overlay opacity, a blur radius, a saturation amount, an animation speed, a spacing multiplier — don't hardcode a single number in \`customCss\`. Instead, declare it as a **custom slider**, and Webify will automatically render a real \`<input type="range">\` control for it in Settings, right below the Export to AI button, so the app's user can tune it themselves after import without touching any code.

Add entries to the top-level \`customSliders\` array:

\`\`\`json
{
  "themeSettings": {
    "customCss": "body::after { content: ''; position: fixed; inset: 0; pointer-events: none; z-index: 9998; mix-blend-mode: overlay; opacity: var(--grain-opacity, 0.12); background-image: repeating-linear-gradient(0deg, rgba(255,255,255,0.05) 0px, transparent 1px, transparent 2px), repeating-linear-gradient(90deg, rgba(255,255,255,0.05) 0px, transparent 1px, transparent 2px); }"
  },
  "customSliders": [
    {
      "id": "grain-opacity",
      "label": "Grain overlay strength",
      "cssVar": "--grain-opacity",
      "min": 0,
      "max": 0.4,
      "step": 0.01,
      "default": 0.12,
      "unit": "",
      "description": "How visible the film-grain overlay is across the whole app."
    }
  ]
}
\`\`\`

Field meanings, all required except \`description\`:
- \`id\` — a short, unique, stable string (kebab-case, e.g. \`"grain-opacity"\`). Reused if you re-export the same theme with a tweak.
- \`label\` — shown next to the slider in the app.
- \`cssVar\` — the CSS custom property this slider writes to (must start with \`--\`). **This is the whole mechanism**: Webify literally sets \`document.documentElement.style.setProperty(cssVar, value + unit)\` whenever the slider moves — nothing else happens automatically, so the variable only has a visible effect if something in your \`customCss\` (or a structured field, if it happens to reuse the same CSS variable name — most don't) actually reads it via \`var(--grain-opacity, ...)\`.
- \`min\` / \`max\` / \`step\` — numeric range for the \`<input type="range">\`.
- \`default\` — the value applied the moment this theme is imported, before the user has touched the slider.
- \`unit\` — string appended after the number when writing the CSS value: \`""\` for unitless (opacity, scale factors), \`"px"\`, \`"deg"\`, \`"%"\`, etc.
- \`description\` — optional one-line tooltip text.

You can define as many sliders as make sense — one per genuinely continuous "feel" knob your theme introduces. Every slider you declare must have a matching \`var(--your-css-var, <fallback>)\` reference somewhere in \`customCss\` (or, for cases like a numeric radius/spacing override, in a structured field's CSS variable — but that's uncommon; \`customCss\` is the normal path) or it will have no visible effect.

## Adding motion (copy-paste animation templates)

Hand-writing \`@keyframes\` from scratch is a common place to introduce a broken or half-finished rule. Instead, start from one of these tested templates and paste the filled-in result straight into \`customCss\` — swap \`{selector}\` for a real CSS selector from **theme-variable-reference.json** or the screenshots (a card class, \`.page\`, etc.), and \`{duration}\`/\`{easing}\`/\`{delay}\` for real CSS values (e.g. \`0.4s\`, \`ease-out\`, \`0.1s\`).

${ANIMATION_PRESETS.map((p) => `**${p.label}** — ${p.description} Applies to: ${p.appliesTo}\n\n\`\`\`css\n${fillAnimationTemplate(p.template)}\n\`\`\``).join("\n\n")}

There's no mechanism to inject new class names into the app's DOM from a theme — every template above targets a real, already-existing selector rather than a class you'd need the app to add. If none of these fit, plain CSS \`@keyframes\` still work anywhere in \`customCss\`; these are just a reliable starting point.

## Decals / stickers

For a scrapbook, Y2K, "collage" or badge-heavy look, use the \`decals\` field — a JSON array of small emoji or images anchored to a pane card, a web/graph canvas, or a page background, each with its own rotation/scale. This is a real theme field (see theme-variable-reference.json), set inside \`themeSettings\`:

\`\`\`json
{
  "themeSettings": {
    "decals": "[{\\"id\\": \\"star\\", \\"source\\": \\"⭐\\", \\"target\\": \\"pane\\", \\"surface\\": \\"skill\\", \\"anchor\\": \\"corner-tr\\", \\"rotation\\": -8, \\"scale\\": 1}, {\\"id\\": \\"tape\\", \\"source\\": \\"data:image/png;base64,...\\", \\"target\\": \\"page-bg\\", \\"surface\\": \\"section:goals-home\\", \\"anchor\\": \\"free\\", \\"x\\": 12, \\"y\\": 8, \\"rotation\\": -15, \\"scale\\": 1.4}]"
  }
}
\`\`\`

Note that \`decals\` itself is a **string** — a JSON-encoded array, same convention as the other advanced JSON fields (\`timeBasedThemeSchedule\`, the \`*PaneShape\` fields), not a nested array literal.

Each entry:
- \`source\` — an emoji character, or a \`"data:image/..."\` URL.
- \`target\` — \`"pane"\` (a card in a Projects/Skills/Recipes/Responsibilities grid), \`"canvas"\` (a web/graph canvas, pans and zooms with it), or \`"page-bg"\` (a page's background layer, behind its content).
- \`surface\` — optional. For \`"pane"\`: one of \`"project" | "skill" | "recipe" | "responsibility"\`. For \`"canvas"\`/\`"page-bg"\`: a section key such as \`"section:dreams-web"\`, \`"section:goal-web"\`, \`"section:recipes-graph"\`, \`"section:projects-home"\`, \`"section:goals-home"\`, \`"section:recipes-home"\`, \`"section:responsibilities-home"\`, \`"section:skills-home"\`, \`"section:notes"\` — the full list is in design-vocabulary.json. Omit \`surface\` to apply the decal to every instance of that target.
- \`anchor\` — \`"corner-tl" | "corner-tr" | "corner-bl" | "corner-br" | "center-overlap" | "edge" | "free"\`. \`"edge"\` is a bottom-center banner/ribbon position. \`"free"\` uses \`x\`/\`y\` (percent 0-100 for \`"pane"\`/\`"page-bg"\`, raw canvas-space units for \`"canvas"\`).
- \`rotation\` — degrees. \`scale\` — multiplier, \`1\` = natural size.

You can define as many decals as you want, mixing targets and surfaces freely — e.g. a corner star on every Skill card plus a scattering of free-positioned washi-tape images across the Goals home page background.

## Per-section page backgrounds (optional — a different "painting" behind each section)

Independent of every field above, you can give each top-level section its own background image or color — the Dreams web canvas, the Goals home page, the Recipes graph, etc. each carry their own layer, painted behind that section's content. Set it via the top-level \`pageBackgrounds\` field (a sibling of \`themeSettings\`, not inside it):

\`\`\`json
{
  "pageBackgrounds": {
    "section:goals-home": { "page-bg": { "imageData": "data:image/png;base64,...", "tile": "0" } },
    "section:dreams-web": { "page-bg": { "color": "#0b1d3a" } }
  }
}
\`\`\`

Each key is one of the portable section scope keys (\`"section:dreams-web"\`, \`"section:goal-web"\`, \`"section:recipes-graph"\`, \`"section:projects-home"\`, \`"section:goals-home"\`, \`"section:recipes-home"\`, \`"section:responsibilities-home"\`, \`"section:skills-home"\`, \`"section:notes"\`) — the same list as the decals \`surface\` field above. Inside each, \`"page-bg"\` is the surface name (the only one currently used); its value is \`{color?, imageData?, tile? ("0"|"1"), scale? (px, numeric string, only used when tile is "1")}\`. Omit \`pageBackgrounds\` entirely, or any section you don't want to touch, to leave that background as-is.

## How the user will apply this

They'll open Webify → Settings → **Import Theme**, and select the JSON file you return. Import is a full replace of icons/textElements/buttonStyles/theme settings/custom sliders/section page backgrounds — anything not in your file resets to default, so a complete, self-contained \`themeSettings\` object (per the "go bold, go wide" guidance above) makes for a better result than a handful of isolated field tweaks. Note \`pageBackgrounds\`, if you include it, only replaces the \`"section:*"\` entries — an individual project/goal/dream/recipe's own hand-picked background image (if the user set one) is untouched.
`;
}
