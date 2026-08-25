// Node/card shape language — the theme system's control over corner
// radius only ever changed how rounded a rectangle was. This changes
// whether it's a rectangle at all. Each shape (besides "rectangle") is
// a pre-authored clip-path — no live SVG-blob generation, per the
// design notes; "blob" is one deliberately organic, slightly asymmetric
// polygon rather than a perfect geometric shape.
export type NodeShapeKey = "rectangle" | "hexagon" | "blob" | "diamond";

export const NODE_SHAPE_OPTIONS: { value: NodeShapeKey; label: string }[] = [
  { value: "rectangle", label: "Rectangle (default)" },
  { value: "hexagon", label: "Hexagon" },
  { value: "blob", label: "Blob" },
  { value: "diamond", label: "Diamond" },
];

export const DEFAULT_NODE_SHAPE: NodeShapeKey = "rectangle";

// "none" for rectangle — clip-path is simply omitted rather than set to
// a full-box polygon, so corner-radius (border-radius) keeps working
// exactly as it does today for anyone who never touches this setting.
const CLIP_PATHS: Record<NodeShapeKey, string | undefined> = {
  rectangle: undefined,
  diamond: "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)",
  hexagon: "polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)",
  blob: "polygon(38% 3%, 64% 0%, 85% 15%, 100% 42%, 92% 68%, 72% 92%, 45% 100%, 18% 88%, 2% 62%, 5% 32%, 18% 10%)",
};

export function clipPathFor(shape: string): string | undefined {
  return CLIP_PATHS[shape as NodeShapeKey];
}
