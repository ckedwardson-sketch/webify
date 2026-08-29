import { FieldLayoutRow, PairMode } from "../db/fieldLayout";

// A "row" is what actually renders as one vertical slot: either a single
// full-width field, or a primary + the one field paired to its right
// (max 2 per row — see db/fieldLayout.ts's FieldLayoutRow.pairedWithId).
// Grouping happens here, once, instead of in every page — a field's
// position in the vertical order always comes from the *primary's*
// sort_order; a secondary's own sort_order is meaningless (it's never
// looked up by position, only by pairedWithId), which is also why
// reordering only ever drags primaries (see useFieldLayout.ts).
export interface FieldRowGroup {
  primary: FieldLayoutRow;
  secondary: FieldLayoutRow | null;
  pairMode: PairMode | null;
}

export function buildFieldRows(fields: FieldLayoutRow[]): FieldRowGroup[] {
  const secondaryIds = new Set(fields.filter((f) => f.pairedWithId !== null).map((f) => f.id));
  const rows: FieldRowGroup[] = [];
  for (const f of fields) {
    if (secondaryIds.has(f.id)) continue; // rendered as part of its primary's row, below
    const secondary = fields.find((x) => x.pairedWithId === f.id) ?? null;
    rows.push({ primary: f, secondary, pairMode: secondary?.pairMode ?? null });
  }
  return rows;
}

export function gapOrderBefore(fields: FieldLayoutRow[], index: number): number {
  const current = fields[index].sortOrder;
  if (index === 0) return current - 1;
  return (fields[index - 1].sortOrder + current) / 2;
}

export function gapOrderAfterLast(fields: FieldLayoutRow[]): number {
  return fields.length === 0 ? 0 : fields[fields.length - 1].sortOrder + 1;
}
