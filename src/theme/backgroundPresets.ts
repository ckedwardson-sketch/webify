// Generative background atmospheres for the main content pane. These
// are pure CSS gradients built from color-mix() against the current
// accent/border colors (not baked-in hex), so a pattern automatically
// re-tints itself whenever the user changes those colors — no need to
// recompute anything when other theme settings change. Layered behind
// (not replacing) a user-uploaded background image; see App.css.
export interface BackgroundPattern {
  image: string;
  size: string;
}

export const BACKGROUND_PRESETS: Record<string, BackgroundPattern> = {
  solid: { image: "none", size: "auto" },
  gradient: {
    image:
      "radial-gradient(circle at 15% 10%, color-mix(in srgb, var(--color-accent) 18%, transparent), transparent 55%), " +
      "radial-gradient(circle at 85% 90%, color-mix(in srgb, var(--color-accent) 12%, transparent), transparent 60%)",
    size: "auto",
  },
  grid: {
    image:
      "linear-gradient(color-mix(in srgb, var(--color-border-strong) 55%, transparent) 1px, transparent 1px), " +
      "linear-gradient(90deg, color-mix(in srgb, var(--color-border-strong) 55%, transparent) 1px, transparent 1px)",
    size: "28px 28px",
  },
  dotted: {
    image: "radial-gradient(color-mix(in srgb, var(--color-border-strong) 70%, transparent) 1.5px, transparent 1.5px)",
    size: "22px 22px",
  },
  noise: {
    image:
      "repeating-linear-gradient(45deg, color-mix(in srgb, var(--color-border) 60%, transparent) 0, " +
      "color-mix(in srgb, var(--color-border) 60%, transparent) 1px, transparent 1px, transparent 6px)",
    size: "auto",
  },
};

export const DEFAULT_BACKGROUND_STYLE = "solid";

export function backgroundPatternFor(key: string): BackgroundPattern {
  return BACKGROUND_PRESETS[key] ?? BACKGROUND_PRESETS[DEFAULT_BACKGROUND_STYLE];
}
