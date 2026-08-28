// Node/card shape language — the theme system's control over corner
// radius only ever changed how rounded a rectangle was. This changes
// whether it's a rectangle at all. Each shape (besides "rectangle") is
// a pre-authored clip-path — no live SVG-blob generation, per the
// design notes; "blob" is one deliberately organic, slightly asymmetric
// polygon rather than a perfect geometric shape.
//
// The clip-path is applied only to a decorative background layer, never
// to the actual text/icon content — clipping the content directly was
// tried first and silently deleted whatever fell outside the polygon
// (a recipe name, a status icon, an entire button), which is a
// correctness bug, not an acceptable stylistic cost. contentInset is
// how much extra padding (percent of the node's own width/height) the
// content layer needs on top of its normal padding so it visually sits
// inside the shape's silhouette instead of overhanging past a cut
// corner into empty space. "diamond" is deliberately a softened
// diamond (corners cut, not a sharp 4-point rhombus) — a true point-to-
// point diamond leaves almost no straight-line room for a text block at
// all; this keeps a recognizably diamond silhouette while still leaving
// a workable content area.
export type NodeShapeKey = "rectangle" | "hexagon" | "blob" | "diamond";

export const NODE_SHAPE_OPTIONS: { value: NodeShapeKey; label: string }[] = [
  { value: "rectangle", label: "Rectangle (default)" },
  { value: "hexagon", label: "Hexagon" },
  { value: "blob", label: "Blob" },
  { value: "diamond", label: "Diamond" },
];

export const DEFAULT_NODE_SHAPE: NodeShapeKey = "rectangle";

export interface ShapePoint {
  x: number; // percent, 0-100
  y: number; // percent, 0-100
}

// The single source of truth for each shape's silhouette — both the
// CSS clip-path (see clipPathFor, derived from this) and the boundary-
// intersection math in nodeBoundary.ts (for connection-handle
// placement — see DreamGraphNodes.tsx) read the same vertex list, so a
// connection point drawn against a shape always matches what's actually
// rendered. Rectangle is included even though it's never clipped (see
// clipPathFor's rectangle special-case below) — boundary math still
// needs its 4 corners to place handles correctly on a plain box.
export const SHAPE_POLYGONS: Record<NodeShapeKey, ShapePoint[]> = {
  rectangle: [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 100, y: 100 },
    { x: 0, y: 100 },
  ],
  diamond: [
    { x: 35, y: 0 },
    { x: 65, y: 0 },
    { x: 100, y: 35 },
    { x: 100, y: 65 },
    { x: 65, y: 100 },
    { x: 35, y: 100 },
    { x: 0, y: 65 },
    { x: 0, y: 35 },
  ],
  hexagon: [
    { x: 25, y: 0 },
    { x: 75, y: 0 },
    { x: 100, y: 50 },
    { x: 75, y: 100 },
    { x: 25, y: 100 },
    { x: 0, y: 50 },
  ],
  blob: [
    { x: 38, y: 3 },
    { x: 64, y: 0 },
    { x: 85, y: 15 },
    { x: 100, y: 42 },
    { x: 92, y: 68 },
    { x: 72, y: 92 },
    { x: 45, y: 100 },
    { x: 18, y: 88 },
    { x: 2, y: 62 },
    { x: 5, y: 32 },
    { x: 18, y: 10 },
  ],
};

function polygonCss(points: ShapePoint[]): string {
  return `polygon(${points.map((p) => `${p.x}% ${p.y}%`).join(", ")})`;
}

// "none" for rectangle — clip-path is simply omitted rather than set to
// a full-box polygon, so corner-radius (border-radius) keeps working
// exactly as it does today for anyone who never touches this setting.
const CLIP_PATHS: Record<NodeShapeKey, string | undefined> = {
  rectangle: undefined,
  diamond: polygonCss(SHAPE_POLYGONS.diamond),
  hexagon: polygonCss(SHAPE_POLYGONS.hexagon),
  blob: polygonCss(SHAPE_POLYGONS.blob),
};

export function clipPathFor(shape: string): string | undefined {
  return CLIP_PATHS[shape as NodeShapeKey];
}

export interface ContentInset {
  x: number; // percent, each side
  y: number; // percent, each side
}

// Verified, not guessed: a point-in-polygon check confirms the content
// box's 4 corners land inside each shape's actual clip-path at these
// values (with a small margin), and a rendered-text check against
// realistic dream names ("Learn piano", "Trip to Japan") confirms
// nothing ellipsis-truncates that wouldn't already truncate on a plain
// rectangle. Two earlier attempts at these numbers were hand-derived
// from partial geometry and were wrong. If these ever need revisiting,
// re-derive with the same point-in-polygon approach — don't eyeball
// percentages again.
const CONTENT_INSETS: Record<NodeShapeKey, ContentInset> = {
  rectangle: { x: 0, y: 0 },
  hexagon: { x: 16, y: 22 },
  diamond: { x: 15, y: 24 },
  blob: { x: 16, y: 24 },
};

export function contentInsetFor(shape: string): ContentInset {
  return CONTENT_INSETS[shape as NodeShapeKey] ?? CONTENT_INSETS.rectangle;
}
