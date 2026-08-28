// Designer-defined slider controls. Unlike every other theme knob
// (which is a fixed, hand-authored field on ThemeSettings), a custom
// slider is a knob an AI designer invents when they hand back a theme —
// e.g. "grain overlay opacity" — declared entirely in data, not code.
// ThemeContext renders it as a live CSS custom property; SettingsHomePage
// renders it as an actual <input type="range">. See
// theme/themeReference.ts / ExportToAiModal.tsx for the designer-facing
// explanation of this contract.
export interface CustomSliderDef {
  // Stable identifier — used as the DB primary key, so it must stay the
  // same across edits to a given slider (changing it creates a new row
  // rather than updating the existing one).
  id: string;
  // Shown to the app's user next to the slider.
  label: string;
  // The CSS custom property this slider controls, e.g. "--grain-opacity".
  // Must start with "--". Reference it from customCss (see
  // ThemeSettings.customCss) with var(--grain-opacity, <fallback>).
  cssVar: string;
  min: number;
  max: number;
  step: number;
  // Value applied when a theme is first imported/applied, before the
  // app's user has touched the slider themselves.
  default: number;
  // Appended after the number when writing the CSS value, e.g. "%",
  // "px", "deg", "" (unitless, for things like opacity 0-1).
  unit: string;
  // Optional one-line explanation shown as a tooltip/help text.
  description?: string;
}

export interface CustomSliderState extends CustomSliderDef {
  value: number;
}

export function clampSliderValue(def: Pick<CustomSliderDef, "min" | "max">, value: number): number {
  if (Number.isNaN(value)) return def.min;
  return Math.min(def.max, Math.max(def.min, value));
}

// Loosely validates a slider def parsed from imported/AI-authored JSON
// so one malformed entry can't crash the whole import or silently
// write garbage into a CSS custom property.
export function isValidCustomSliderDef(value: unknown): value is CustomSliderDef {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === "string" &&
    v.id.length > 0 &&
    typeof v.label === "string" &&
    typeof v.cssVar === "string" &&
    v.cssVar.startsWith("--") &&
    typeof v.min === "number" &&
    typeof v.max === "number" &&
    v.max > v.min &&
    typeof v.step === "number" &&
    v.step > 0 &&
    typeof v.default === "number" &&
    typeof v.unit === "string"
  );
}
