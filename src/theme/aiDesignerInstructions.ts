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
- \`icons\`, \`textElements\`, and \`buttonStyles\` are almost always left as empty objects \`{}\` unless you deliberately want to restyle a specific icon, editor-toolbar letter, or button beyond what the theme fields cover — leave them out entirely rather than guessing at their shape.
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

## How the user will apply this

They'll open Webify → Settings → **Import Theme**, and select the JSON file you return. Import is a full replace of icons/textElements/buttonStyles/theme settings/custom sliders — anything not in your file resets to default, so a complete, self-contained \`themeSettings\` object (per the "go bold, go wide" guidance above) makes for a better result than a handful of isolated field tweaks.
`;
}
