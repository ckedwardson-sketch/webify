// Heading "voice" presets — a distinct typographic personality for
// every h1/h2 in the app (page titles, section titles, the sidebar
// brand), independent of the body font set by fontPresets.ts. Offline-
// safe stacks only, same rule as fontPresets.ts.
export interface HeadingScale {
  font: string;
  weight: string;
  transform: string; // CSS text-transform
  tracking: string; // CSS letter-spacing
}

export const HEADING_PRESETS: Record<string, HeadingScale> = {
  default: { font: "var(--font-body)", weight: "700", transform: "none", tracking: "normal" },
  editorial: {
    font: 'Georgia, Cambria, "Times New Roman", serif',
    weight: "800",
    transform: "uppercase",
    tracking: "0.04em",
  },
  "mono-technical": {
    font: '"Consolas", "SF Mono", Menlo, monospace',
    weight: "700",
    transform: "none",
    tracking: "-0.02em",
  },
  "soft-rounded": {
    font: '"Segoe UI Rounded", "Trebuchet MS", "Segoe UI", sans-serif',
    weight: "600",
    transform: "none",
    tracking: "0.01em",
  },
};

export const DEFAULT_HEADING_STYLE = "default";

export function headingFor(key: string): HeadingScale {
  return HEADING_PRESETS[key] ?? HEADING_PRESETS[DEFAULT_HEADING_STYLE];
}
