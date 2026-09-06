// Shared "pane shape" profile — curve, up-to-4-layer border stack, and
// text truncation — reused by every pane/icon-grid surface (Projects,
// Skills, Recipes, Responsibilities) instead of each page inventing its
// own shape fields. One profile is one JSON-string field on
// AdvancedThemeSettings (same storage pattern as recipeThemeOverrides
// etc. — see sectionTheme.ts), parsed here and turned into CSS custom
// properties + a data attribute by PaneShapeScope.tsx, consumed by each
// page's own CSS via the .pane-shape-surface / .pane-shape-label utility
// classes in theme.css. One parser/applier, many call sites.
export type PaneCurve = "sharp" | "soft" | "round" | "pill";
export type PaneTruncation = "clip" | "ellipsis" | "wrap" | "wrap-2" | "wrap-3";

export interface PaneBorderLayer {
  enabled: boolean;
  color: string; // any valid CSS color, including var(--color-x)
  width: number; // px
  offset: number; // px gap from the previous layer (0 = flush against the pane edge)
}

export interface PaneShapeProfile {
  curve: PaneCurve;
  borderLayers: PaneBorderLayer[]; // up to 4 slots; extras beyond 4 are ignored
  truncation: PaneTruncation;
}

const CURVE_RADIUS: Record<PaneCurve, string> = {
  sharp: "0px",
  soft: "8px",
  round: "16px",
  pill: "999px",
};

export const DEFAULT_PANE_SHAPE: PaneShapeProfile = {
  curve: "soft",
  borderLayers: [],
  truncation: "ellipsis",
};

const MAX_BORDER_LAYERS = 4;

function sanitizeBorderLayer(value: unknown): PaneBorderLayer | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  if (typeof v.color !== "string" || typeof v.width !== "number" || typeof v.offset !== "number") return null;
  return { enabled: v.enabled !== false, color: v.color, width: v.width, offset: v.offset };
}

// Never throws — an AI-authored or hand-edited value that's malformed
// just falls back to defaults for whatever part didn't parse, the same
// tolerance customSliders.isValidCustomSliderDef applies per-field.
export function parsePaneShapeProfile(json: string | undefined): PaneShapeProfile {
  if (!json) return DEFAULT_PANE_SHAPE;
  try {
    const parsed = JSON.parse(json) as Partial<PaneShapeProfile>;
    const curve: PaneCurve = parsed.curve && parsed.curve in CURVE_RADIUS ? parsed.curve : DEFAULT_PANE_SHAPE.curve;
    const truncation: PaneTruncation =
      parsed.truncation && ["clip", "ellipsis", "wrap", "wrap-2", "wrap-3"].includes(parsed.truncation)
        ? parsed.truncation
        : DEFAULT_PANE_SHAPE.truncation;
    const borderLayers = Array.isArray(parsed.borderLayers)
      ? (parsed.borderLayers.map(sanitizeBorderLayer).filter((l): l is PaneBorderLayer => l !== null).slice(0, MAX_BORDER_LAYERS))
      : DEFAULT_PANE_SHAPE.borderLayers;
    return { curve, truncation, borderLayers };
  } catch {
    return DEFAULT_PANE_SHAPE;
  }
}

// Builds the box-shadow stack for the enabled border layers — each
// layer is one non-blurred ring at `offset` from the pane edge, so
// stacking 1-4 of them reads as concentric borders without adding any
// extra DOM nodes.
function borderLayersToBoxShadow(layers: PaneBorderLayer[]): string | undefined {
  const enabled = layers.filter((l) => l.enabled);
  if (enabled.length === 0) return undefined;
  let cumulativeOffset = 0;
  const shadows: string[] = [];
  for (const layer of enabled) {
    cumulativeOffset += layer.offset;
    shadows.push(`0 0 0 ${cumulativeOffset}px ${layer.color}`);
    cumulativeOffset += layer.width;
    shadows.push(`0 0 0 ${cumulativeOffset}px ${layer.color}`);
  }
  return shadows.join(", ");
}

// CSS custom properties + data attribute value for a profile — spread
// onto a wrapping element's inline style / attribute (see
// PaneShapeScope.tsx). display:"contents" on that wrapper (same trick
// as SectionThemeScope) keeps it invisible to layout.
export function paneShapeStyleVars(profile: PaneShapeProfile): Record<string, string> {
  const vars: Record<string, string> = {
    "--pane-radius": CURVE_RADIUS[profile.curve],
  };
  const boxShadow = borderLayersToBoxShadow(profile.borderLayers);
  if (boxShadow) vars["--pane-border-shadow"] = boxShadow;
  return vars;
}
