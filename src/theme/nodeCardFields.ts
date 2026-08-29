// Resolves a field_layout row list (plus whatever freetext content it
// references) into the small ordered list of text/date blurbs a Dream/
// Goal/Project Web graph card actually renders — the read side of
// FieldStylePopover's new "On the web" toggles (see db/fieldLayout.ts's
// webFieldKind/isWebDisplayable). Only fields with showOnWeb set survive
// into the result; everything else (including any field type this
// system has no renderer for) is silently skipped.
import { FieldLayoutRow, FIELD_TYPE_LABELS, FreetextField, webFieldKind } from "../db/fieldLayout";

export interface NodeCardTextItem {
  id: number;
  header: string | null;
  text: string;
}

export interface DateRange {
  start?: string | null;
  end?: string | null;
}

// Generous rather than tight — a fixed-size card still visually clips
// via CSS line-clamp (see NodeCardFields.css), while a grow-to-fit card
// (see DreamGraphNodes.tsx's growToFit) renders this in full, so the cap
// here only exists to keep a single field from making either mode
// render a genuinely unbounded wall of text.
function truncate(s: string, max = 300): string {
  const trimmed = s.trim();
  return trimmed.length > max ? `${trimmed.slice(0, max).trimEnd()}…` : trimmed;
}

function formatDate(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function formatRange(range: DateRange): string {
  if (range.end && range.end !== range.start) {
    return range.start ? `${formatDate(range.start)} – ${formatDate(range.end)}` : formatDate(range.end);
  }
  return formatDate(range.start);
}

// `textFor`/`dateFor` let each owner type (Dream/Goal/Project) plug in
// its own column mapping (e.g. dream_reasoning_text -> dream.reasoning)
// without this module needing to know about every entity shape.
export function buildNodeCardTextItems(
  fields: FieldLayoutRow[],
  freetextById: Map<number, FreetextField>,
  textFor: (fieldType: FieldLayoutRow["fieldType"]) => string | null | undefined,
  dateFor: (fieldType: FieldLayoutRow["fieldType"]) => DateRange | null | undefined
): NodeCardTextItem[] {
  const items: NodeCardTextItem[] = [];
  for (const f of fields) {
    if (!f.showOnWeb) continue;
    const kind = webFieldKind(f.fieldType);
    if (kind === "text") {
      const ft = f.fieldType === "freetext" && f.refId != null ? freetextById.get(f.refId) : undefined;
      const raw = f.fieldType === "freetext" ? ft?.content : textFor(f.fieldType);
      if (!raw || !raw.trim()) continue;
      const label = f.customLabel ?? (f.fieldType === "freetext" ? ft?.label ?? "" : FIELD_TYPE_LABELS[f.fieldType]);
      items.push({ id: f.id, header: f.webHeader ? label : null, text: truncate(raw) });
    } else if (kind === "date") {
      const range = dateFor(f.fieldType);
      if (!range || (!range.start && !range.end)) continue;
      const label = f.customLabel ?? FIELD_TYPE_LABELS[f.fieldType];
      items.push({ id: f.id, header: f.webHeader ? label : null, text: formatRange(range) });
    }
  }
  return items;
}

// Whether this owner's "widgets" field_layout row (if any) has been
// switched on for the web — gates the whole widget-bay render, separate
// from the text/date items above since widgets need their own data
// (ProjectWidget rows, fetched by the caller) rather than a text value.
export function widgetsVisibleOnWeb(fields: FieldLayoutRow[]): boolean {
  return fields.some((f) => f.fieldType === "widgets" && f.showOnWeb);
}
