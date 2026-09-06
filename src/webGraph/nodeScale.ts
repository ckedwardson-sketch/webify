// Shared "how big should this category's cards be" engine for the web/
// graph pages (Recipe Web first; Skills/Responsibilities/Dream Web to
// follow the same shape).
//
// The goal is legibility, not "reward the sparse category with a giant
// card" — a category with few items has no reason to render bigger than
// normal, it just renders at the comfortable default. Only a category
// that's unusually *packed* relative to referenceCount shrinks, and only
// within minScale/maxScale so it never goes illegible. fontScale always
// tracks the box scale directly (times fontBoost) — a card that shrinks
// or grows must have its text shrink/grow with it, never independently,
// or you get a big box with tiny text floating in blank space.
export type NodeScaleMode = "auto-per-category" | "auto-global" | "manual";
export type ColumnMode = "auto" | "fixed";

export interface NodeScaleSettings {
  mode: NodeScaleMode;

  // Auto modes: the item count at/below which a category renders at its
  // normal (1.0x) size — only categories with MORE items than this
  // shrink. This is the "reference frame" — raise it so more categories
  // count as "normal" before anything starts shrinking, lower it to make
  // shrinking kick in earlier.
  referenceCount: number;
  // Exponent applied to (referenceCount / count) for counts above
  // referenceCount — 0 disables count-based shrinking entirely (every
  // category renders at 1.0x), higher values shrink more aggressively.
  sensitivity: number;
  minScale: number;
  // Defaults to 1.0 (no growth for sparse categories). Raise this only
  // if you deliberately want under-full categories to render bigger.
  maxScale: number;

  // auto-global only: which percentile of the web's category counts
  // stands in for "the" count when every category must share one size.
  // 50 (median) resists a single packed or single sparse category
  // dragging the whole web's scale with it; raise it to lean toward
  // accommodating the busier categories, lower it to lean toward the
  // sparser ones.
  globalPercentile: number;

  baseWidth: number;
  aspectRatio: number; // height / width at scale 1.0
  // Extra multiplier on top of the box's own scale — the "font size"
  // tweak. 1.0 means text scales exactly with the box. Raise it to make
  // text consistently bigger than the box scale alone would give it
  // (useful if categories are shrinking a lot and you want text to lag
  // behind the shrink); lower it to leave more of a shrunk box blank.
  fontBoost: number;

  columnMode: ColumnMode;
  fixedColumns: number;

  manualWidth: number;
  manualHeight: number;
  manualFontScale: number;
}

export const DEFAULT_NODE_SCALE_SETTINGS: NodeScaleSettings = {
  mode: "auto-per-category",
  referenceCount: 6,
  sensitivity: 0.45,
  minScale: 0.7,
  maxScale: 1.0,
  globalPercentile: 50,
  baseWidth: 210,
  aspectRatio: 144 / 210,
  fontBoost: 1.0,
  columnMode: "auto",
  fixedColumns: 2,
  manualWidth: 210,
  manualHeight: 144,
  manualFontScale: 1,
};

export interface ComputedNodeScale {
  width: number;
  height: number;
  fontScale: number;
  columns: number;
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

function percentile(sortedAsc: number[], p: number): number {
  if (!sortedAsc.length) return 0;
  const idx = (clamp(p, 0, 100) / 100) * (sortedAsc.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sortedAsc[lo];
  return sortedAsc[lo] + (sortedAsc[hi] - sortedAsc[lo]) * (idx - lo);
}

function autoColumns(count: number): number {
  return Math.max(1, Math.ceil(Math.sqrt(count || 1)));
}

// counts: categoryId (or any stable key) -> visible item count in that
// category. Returns one ComputedNodeScale per key in `counts`.
export function computeNodeScales(
  counts: Record<string, number>,
  settings: NodeScaleSettings
): Record<string, ComputedNodeScale> {
  const keys = Object.keys(counts);
  const result: Record<string, ComputedNodeScale> = {};

  const columnsFor = (count: number) =>
    settings.columnMode === "fixed" ? Math.max(1, settings.fixedColumns) : autoColumns(count);

  if (settings.mode === "manual") {
    for (const key of keys) {
      result[key] = {
        width: settings.manualWidth,
        height: settings.manualHeight,
        fontScale: settings.manualFontScale,
        columns: columnsFor(counts[key]),
      };
    }
    return result;
  }

  // Only counts ABOVE referenceCount pull the ratio below 1 — anything
  // at or under it maps to exactly 1.0, so a sparse category never gets
  // a bonus, it just renders normally.
  const scaleForCount = (count: number) => {
    if (count <= settings.referenceCount) return clamp(1, settings.minScale, settings.maxScale);
    const ratio = settings.referenceCount / count;
    const raw = Math.pow(ratio, settings.sensitivity);
    return clamp(raw, settings.minScale, settings.maxScale);
  };

  let globalScale: number | null = null;
  if (settings.mode === "auto-global") {
    const sorted = keys.map((k) => counts[k]).sort((a, b) => a - b);
    const representative = sorted.length ? percentile(sorted, settings.globalPercentile) : settings.referenceCount;
    globalScale = scaleForCount(representative);
  }

  for (const key of keys) {
    const count = counts[key];
    const scale = settings.mode === "auto-global" ? (globalScale as number) : scaleForCount(count);
    const width = settings.baseWidth * scale;
    const height = width * settings.aspectRatio;
    const fontScale = scale * settings.fontBoost;
    result[key] = { width, height, fontScale, columns: columnsFor(count) };
  }
  return result;
}
