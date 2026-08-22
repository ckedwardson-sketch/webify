// Curated, offline-safe font stacks. Themes reference these by key (not
// a raw font string) so a generated theme renders the same everywhere —
// every stack here only names fonts that ship with stock Windows/macOS,
// with generic fallbacks, so nothing silently falls back to "whatever
// happened to be installed."
export interface FontPreset {
  key: string;
  label: string;
  stack: string;
}

export const FONT_PRESETS: FontPreset[] = [
  {
    key: "system",
    label: "System Default",
    stack: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  {
    key: "geometric",
    label: "Geometric Sans",
    stack: '"Century Gothic", "Trebuchet MS", "Segoe UI", sans-serif',
  },
  {
    key: "rounded",
    label: "Rounded / Warm",
    stack: '"Segoe UI Rounded", "Trebuchet MS", "Segoe UI", sans-serif',
  },
  {
    key: "serif",
    label: "Classic Serif",
    stack: 'Georgia, Cambria, "Times New Roman", serif',
  },
  {
    key: "mono",
    label: "Monospace",
    stack: '"Consolas", "SF Mono", Menlo, monospace',
  },
];

export const DEFAULT_FONT_KEY = "system";

export function fontStackFor(key: string): string {
  return FONT_PRESETS.find((f) => f.key === key)?.stack ?? FONT_PRESETS[0].stack;
}
