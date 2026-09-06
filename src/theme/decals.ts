// Decal/sticker primitive — the theme system's first "free-floating
// image on top of something" concept, distinct from a card's own
// background/border (paneShape.ts) or a node's own silhouette
// (nodeShapes.ts). One decal is one small emoji or image, anchored to
// a pane card, a web/graph canvas, or a page background, with its own
// rotation/scale. Multiple decals are stored as one JSON array field
// (AdvancedThemeSettings.decals — same storage pattern as
// timeBasedThemeSchedule/paneShape profiles), parsed tolerantly here.
export type DecalTarget = "pane" | "canvas" | "page-bg";

export type DecalAnchor =
  | "corner-tl"
  | "corner-tr"
  | "corner-bl"
  | "corner-br"
  | "center-overlap"
  | "edge"
  | "free";

export const DECAL_ANCHOR_OPTIONS: { value: DecalAnchor; label: string }[] = [
  { value: "corner-tl", label: "Top-left corner" },
  { value: "corner-tr", label: "Top-right corner" },
  { value: "corner-bl", label: "Bottom-left corner" },
  { value: "corner-br", label: "Bottom-right corner" },
  { value: "center-overlap", label: "Center, overlapping content" },
  { value: "edge", label: "Bottom edge, centered (banner/ribbon)" },
  { value: "free", label: "Free position (uses x/y)" },
];

// "surface" scopes which instances of a target a decal applies to:
// - target "pane": one of PaneShapeSurface's values ("project" | "skill"
//   | "recipe" | "responsibility"), or omitted to decorate every pane
//   surface.
// - target "canvas" / "page-bg": one of pageScope.ts's scopeKeyForView
//   section keys (e.g. "section:dreams-web"), or omitted to apply
//   everywhere that target renders.
export interface DecalDef {
  id: string;
  source: string; // an emoji character, or a "data:image/..." URL
  target: DecalTarget;
  surface?: string;
  anchor: DecalAnchor;
  x?: number; // percent (pane/page-bg) or canvas-space units (canvas) — only used when anchor === "free"
  y?: number;
  rotation: number; // degrees
  scale: number; // multiplier, 1 = natural size
}

function sanitizeDecal(value: unknown, index: number): DecalDef | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  if (typeof v.source !== "string" || !v.source.trim()) return null;
  const target: DecalTarget = v.target === "canvas" || v.target === "page-bg" ? v.target : "pane";
  const anchor: DecalAnchor = DECAL_ANCHOR_OPTIONS.some((o) => o.value === v.anchor)
    ? (v.anchor as DecalAnchor)
    : "corner-tr";
  return {
    id: typeof v.id === "string" && v.id ? v.id : `decal-${index}`,
    source: v.source,
    target,
    surface: typeof v.surface === "string" ? v.surface : undefined,
    anchor,
    x: typeof v.x === "number" ? v.x : undefined,
    y: typeof v.y === "number" ? v.y : undefined,
    rotation: typeof v.rotation === "number" ? v.rotation : 0,
    scale: typeof v.scale === "number" && v.scale > 0 ? v.scale : 1,
  };
}

// Never throws — malformed entries are dropped rather than failing the
// whole list, same tolerance as customSliders.isValidCustomSliderDef
// and paneShape.parsePaneShapeProfile.
export function parseDecals(json: string | undefined): DecalDef[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((v, i) => sanitizeDecal(v, i))
      .filter((d): d is DecalDef => d !== null);
  } catch {
    return [];
  }
}

import type { CSSProperties } from "react";

// Inline style for a decal inside a relatively-positioned, percent-
// scaled container (a pane card, or a page-background layer).
export function decalPercentStyle(decal: DecalDef): CSSProperties {
  const base = {
    position: "absolute" as const,
    transform: `rotate(${decal.rotation}deg) scale(${decal.scale})`,
    pointerEvents: "none" as const,
    lineHeight: 1,
    userSelect: "none" as const,
  };
  switch (decal.anchor) {
    case "corner-tl":
      return { ...base, top: 6, left: 6 };
    case "corner-bl":
      return { ...base, bottom: 6, left: 6 };
    case "corner-br":
      return { ...base, bottom: 6, right: 6 };
    case "center-overlap":
      return { ...base, top: "50%", left: "50%", transform: `translate(-50%, -50%) ${base.transform}` };
    case "edge":
      return { ...base, bottom: 0, left: "50%", transform: `translate(-50%, 50%) ${base.transform}` };
    case "free":
      return {
        ...base,
        top: `${decal.y ?? 50}%`,
        left: `${decal.x ?? 50}%`,
        transform: `translate(-50%, -50%) ${base.transform}`,
      };
    case "corner-tr":
    default:
      return { ...base, top: 6, right: 6 };
  }
}

// Style for a decal placed on a web/graph canvas. x/y are raw canvas-
// space units (the same coordinate space node positions use) — the
// caller is expected to render this inside React Flow's
// <ViewportPortal>, which already applies the canvas's pan/zoom
// transform to everything inside it, so the decal pans and zooms with
// the canvas for free without this needing to know the live viewport.
export function decalCanvasStyle(decal: DecalDef): CSSProperties {
  return {
    position: "absolute",
    left: decal.x ?? 0,
    top: decal.y ?? 0,
    transform: `translate(-50%, -50%) rotate(${decal.rotation}deg) scale(${decal.scale})`,
    pointerEvents: "none",
    lineHeight: 1,
    userSelect: "none",
  };
}
