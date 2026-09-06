// Copy-paste-ready CSS animation snippets for AI-authored themes (see
// aiDesignerInstructions.ts). AI designers reliably reach for customCss
// to add motion, but hand-writing @keyframes correctly (timing,
// fill-mode, staggering without JS) is a common source of broken or
// half-finished output. These are complete, tested templates with
// {duration}/{easing}/{delay} placeholders — turning "give the theme
// motion" into fill-in-the-blanks instead of freehand keyframe
// authoring. Deliberately NOT a runtime animation library: plain CSS
// keyframes need no JS, so the fix is better-documented raw materials —
// fill in a template and paste it into customCss. There's no mechanism
// to inject new class names into the app's DOM from a theme, so every
// template targets a real existing CSS selector (see each template's
// `appliesTo` note) rather than a class the AI would need the app to add.
export interface AnimationPresetDef {
  key: string;
  label: string;
  description: string;
  // What kind of selector this is meant to be pasted onto — guidance
  // only, since there's no mechanism to inject new class names into
  // the app's DOM from a theme. AI designers should substitute a real
  // selector from theme-variable-reference.json's documented CSS
  // classes (e.g. ".skill-card", ".pane-grid-pane", ".page") in place
  // of the {selector} placeholder.
  appliesTo: string;
  // Raw CSS text with {selector}/{duration}/{easing}/{delay}
  // placeholders. Fill in and paste directly into
  // ThemeSettings.customCss.
  template: string;
}

export interface AnimationFillOptions {
  selector?: string;
  duration?: string; // e.g. "0.4s"
  easing?: string; // e.g. "ease-out"
  delay?: string; // e.g. "0s"
}

const DEFAULT_FILL: Required<AnimationFillOptions> = {
  selector: ".page",
  duration: "0.4s",
  easing: "ease-out",
  delay: "0s",
};

export function fillAnimationTemplate(template: string, opts: AnimationFillOptions = {}): string {
  const fill = { ...DEFAULT_FILL, ...opts };
  return template
    .split("{selector}").join(fill.selector)
    .split("{duration}").join(fill.duration)
    .split("{easing}").join(fill.easing)
    .split("{delay}").join(fill.delay);
}

export const ANIMATION_PRESETS: AnimationPresetDef[] = [
  {
    key: "fade-in",
    label: "Fade in",
    description: "Simple opacity fade for anything appearing on screen — the safest, least distracting entrance.",
    appliesTo: "Any surface that mounts fresh per page/navigation, e.g. \".page\" or a card class.",
    template: `@keyframes fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}
{selector} {
  animation: fade-in {duration} {easing} {delay} both;
}`,
  },
  {
    key: "slide-up",
    label: "Slide up + fade",
    description: "Content rises a short distance while fading in — a bit more energy than a plain fade, still calm.",
    appliesTo: "Page containers or individual cards.",
    template: `@keyframes slide-up {
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
}
{selector} {
  animation: slide-up {duration} {easing} {delay} both;
}`,
  },
  {
    key: "pop",
    label: "Pop in",
    description: "Slight overshoot scale-in — good for a single emphasized element (a modal, a new card, a button).",
    appliesTo: "A single small-to-medium element, not a full page (overshoot reads as noisy at large sizes).",
    template: `@keyframes pop-in {
  0% { opacity: 0; transform: scale(0.92); }
  70% { opacity: 1; transform: scale(1.03); }
  100% { opacity: 1; transform: scale(1); }
}
{selector} {
  animation: pop-in {duration} {easing} {delay} both;
}`,
  },
  {
    key: "stagger-children",
    label: "Staggered children",
    description: "Applies slide-up to up to 12 direct children of a list/grid container, each delayed slightly after the last — the classic \"cards cascade in\" effect. Pure CSS (nth-child), no JS indices needed.",
    appliesTo: "A list/grid container's direct children, e.g. \".pane-grid > *\" or \".skills-grid > *\" — pass the CONTAINER as {selector}, not the children.",
    template: `@keyframes stagger-slide-up {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}
{selector} > * {
  animation: stagger-slide-up {duration} {easing} both;
}
{selector} > *:nth-child(1) { animation-delay: calc({delay} + 0 * 60ms); }
{selector} > *:nth-child(2) { animation-delay: calc({delay} + 1 * 60ms); }
{selector} > *:nth-child(3) { animation-delay: calc({delay} + 2 * 60ms); }
{selector} > *:nth-child(4) { animation-delay: calc({delay} + 3 * 60ms); }
{selector} > *:nth-child(5) { animation-delay: calc({delay} + 4 * 60ms); }
{selector} > *:nth-child(6) { animation-delay: calc({delay} + 5 * 60ms); }
{selector} > *:nth-child(7) { animation-delay: calc({delay} + 6 * 60ms); }
{selector} > *:nth-child(8) { animation-delay: calc({delay} + 7 * 60ms); }
{selector} > *:nth-child(9) { animation-delay: calc({delay} + 8 * 60ms); }
{selector} > *:nth-child(10) { animation-delay: calc({delay} + 9 * 60ms); }
{selector} > *:nth-child(11) { animation-delay: calc({delay} + 10 * 60ms); }
{selector} > *:nth-child(12) { animation-delay: calc({delay} + 11 * 60ms); }`,
  },
  {
    key: "hover-lift",
    label: "Hover lift",
    description: "Not an entrance animation — a continuous hover transition. Included because AI designers often want this alongside entrance animations and get the transition shorthand wrong.",
    appliesTo: "Any interactive card/button selector — this overrides the theme's motionStyle preset for just that selector.",
    template: `{selector} {
  transition: transform {duration} {easing}, box-shadow {duration} {easing};
}
{selector}:hover {
  transform: translateY(-3px);
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.15);
}`,
  },
];

export function findAnimationPreset(key: string): AnimationPresetDef | undefined {
  return ANIMATION_PRESETS.find((p) => p.key === key);
}
