import { getDb } from "./database";

// The set of vertically-arrangeable "areas" a Project/Goal/Dream Detail
// page can show. "widgets" is the whole widget grid — one slot, still
// internally reordered by its own existing drag system (see
// ProjectDetailPage.tsx) — not one slot per widget; splitting that apart
// is a bigger redesign than this pass covers. "freetext" is a generic
// field kind: unlimited per owner, unlike every other type here which is
// a singleton. "memory" and "estimated_start" are the two portable field
// types (see PORTABLE_FIELD_TYPES) that aren't tied to one category —
// they can be added to any of project/goal/dream.
export type FieldType =
  | "goal_select"
  | "goals_text"
  | "reasoning_text"
  | "needs_doing_text"
  | "estimated_start"
  | "expected_range"
  | "widgets"
  | "freetext"
  | "dream_expected_date"
  | "dream_priority"
  | "dream_reasoning_text"
  | "dream_notes_text"
  | "dream_linked"
  | "dream_memory"
  | "memory";

export type PairMode = "compact" | "expand";

// Every field type is drag-reorderable and (per the rearrange overhaul)
// removable — deleting one only ever hides its field_layout row; the
// underlying data (a project's goals text, a dream's linked-dream
// relationships, a widget's own rows...) lives in its own table/column
// and isn't touched, so re-adding a removed field brings it right back.
export const REMOVABLE_FIELD_TYPES: FieldType[] = [
  "goal_select",
  "goals_text",
  "reasoning_text",
  "needs_doing_text",
  "estimated_start",
  "expected_range",
  "widgets",
  "freetext",
  "dream_expected_date",
  "dream_priority",
  "dream_reasoning_text",
  "dream_notes_text",
  "dream_linked",
  "dream_memory",
  "memory",
];

// TS enforces this covers every FieldType (a missing key is a compile
// error) — the one canonical place a field type's display name lives,
// used by the Add-field menu, the field header, and copy/paste.
export const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  goal_select: "Goal",
  goals_text: "Goals",
  reasoning_text: "Reasoning",
  needs_doing_text: "What needs doing",
  estimated_start: "Estimated start date",
  expected_range: "When it should be done",
  widgets: "Widgets",
  freetext: "Text field",
  dream_expected_date: "Expected date",
  dream_priority: "Priority",
  dream_reasoning_text: "Reasoning",
  dream_notes_text: "Other words",
  dream_linked: "Linked dreams",
  dream_memory: "Memory",
  memory: "Memory",
};

export type FieldTypeGroup = "text" | "dates" | "widgets" | "other";

// Drives both the Add-field menu's categorized sections and which
// fields the Copy tool treats as copiable (plain text content only).
export function fieldTypeGroup(type: FieldType): FieldTypeGroup {
  if (["goals_text", "reasoning_text", "needs_doing_text", "dream_reasoning_text", "dream_notes_text", "freetext"].includes(type)) {
    return "text";
  }
  if (["estimated_start", "expected_range", "dream_expected_date"].includes(type)) return "dates";
  if (type === "widgets") return "widgets";
  return "other";
}

export interface FieldLayoutRow {
  id: number;
  fieldType: FieldType;
  refId: number | null;
  sortOrder: number;
  // User override for the field's displayed header — set via
  // double-click in rearrange mode (see components/FieldHeader.tsx).
  // Null means "use FIELD_TYPE_LABELS' default" (or, for freetext, its
  // own stored label — freetext's label was already independently
  // editable before this existed, see FreetextFieldEditor).
  customLabel: string | null;
  // User-resized box height in px — currently only meaningful for
  // memory/dream_memory's scrollable history list (see MemoryField.tsx).
  // Null means "use the default height".
  heightPx: number | null;
  // Set on the *secondary* field of a pair (the one added "to the right"
  // of another) — points at the primary's id. Null for an unpaired,
  // normal full-width field, and always null on a primary (pairing is
  // one level deep: a field that's already a pair's primary or
  // secondary can't itself gain another pair — see fieldRows.ts).
  pairedWithId: number | null;
  // Only meaningful when pairedWithId is set (lives on the secondary
  // row, same as pairedWithId, so both travel together).
  pairMode: PairMode | null;
  // Per-page content/header style overrides — see updateFieldStyle below.
  // Null in any of these means "use the default look"; they're the same
  // reset-to-default state a field starts in.
  contentFontSize: number | null;
  contentColor: string | null;
  contentBackgroundColor: string | null;
  contentRadius: number | null;
  contentBorderColor: string | null;
  contentBorderWidth: number | null;
  headerFontSize: number | null;
  headerColor: string | null;
  headerBold: boolean;
  headerUnderline: boolean;
  // Whether this field appears on this owner's Dream/Goal/Project Web
  // graph card, and whether its header/label comes along with it. See
  // isWebDisplayable/webFieldKind below for which field types this is
  // even meaningful for.
  showOnWeb: boolean;
  webHeader: boolean;
}

const PROJECT_DEFAULT_FIELDS: FieldType[] = [
  "goal_select",
  "goals_text",
  "reasoning_text",
  "needs_doing_text",
  "estimated_start",
  "expected_range",
  "widgets",
];

const GOAL_DEFAULT_FIELDS: FieldType[] = [
  "goals_text",
  "reasoning_text",
  "needs_doing_text",
  "estimated_start",
  "expected_range",
  "widgets",
];

const DREAM_DEFAULT_FIELDS: FieldType[] = [
  "dream_expected_date",
  "dream_priority",
  "dream_reasoning_text",
  "dream_notes_text",
  "dream_linked",
  "dream_memory",
];

// The portable extras each category *can* add beyond its defaults, on
// top of whatever it already starts with — this is what makes "the
// memory which is in dream" addable to a Project, and "the start date in
// projects" addable to a Dream. Not goal_select (a "which goal is this
// under" picker only makes sense on a project) or dream_linked/
// dream_priority (dream-specific relationships/web behavior) — the user
// asked for these two specifically, not a blanket merge of every field
// type into every category.
const PROJECT_PORTABLE_EXTRAS: FieldType[] = ["memory"];
const GOAL_PORTABLE_EXTRAS: FieldType[] = ["memory"];
const DREAM_PORTABLE_EXTRAS: FieldType[] = ["estimated_start", "memory"];

export type FieldCategory = "project" | "goal" | "dream";

function defaultFieldsFor(category: FieldCategory): FieldType[] {
  if (category === "project") return PROJECT_DEFAULT_FIELDS;
  if (category === "goal") return GOAL_DEFAULT_FIELDS;
  return DREAM_DEFAULT_FIELDS;
}

function portableExtrasFor(category: FieldCategory): FieldType[] {
  if (category === "project") return PROJECT_PORTABLE_EXTRAS;
  if (category === "goal") return GOAL_PORTABLE_EXTRAS;
  return DREAM_PORTABLE_EXTRAS;
}

// Every field type this category could ever show, present or not —
// what's actually offered in the Add-field menu is this minus whatever
// the owner already has (see availableFieldsToAdd below).
export function allFieldTypesFor(category: FieldCategory): FieldType[] {
  return [...defaultFieldsFor(category), ...portableExtrasFor(category)];
}

export interface AddableFieldOption {
  type: FieldType;
  label: string;
  group: FieldTypeGroup;
}

// What the Add-field menu (rearrange/AddFieldMenu.tsx) offers for this
// owner right now — every field type valid for its category that isn't
// already present. `freetext` is always offered (unlimited instances).
export function availableFieldsToAdd(category: FieldCategory, present: FieldLayoutRow[]): AddableFieldOption[] {
  const presentTypes = new Set(present.map((f) => f.fieldType));
  const types = allFieldTypesFor(category).filter((t) => !presentTypes.has(t));
  if (!types.includes("freetext")) types.push("freetext");
  return types.map((type) => ({ type, label: FIELD_TYPE_LABELS[type], group: fieldTypeGroup(type) }));
}

// Lazily backfills the original hardcoded field order the first time an
// owner is read, so pre-existing projects/goals/dreams see exactly what
// they always saw instead of an empty page.
// SQLite has no real boolean type — header_bold/header_underline come
// back as 0/1/null, coerced to real booleans by mapFieldLayoutRow below
// so every consumer can just check `if (f.headerBold)`.
type RawFieldLayoutRow = Omit<FieldLayoutRow, "headerBold" | "headerUnderline" | "showOnWeb" | "webHeader"> & {
  headerBold: number | null;
  headerUnderline: number | null;
  showOnWeb: number | null;
  webHeader: number | null;
};

function mapFieldLayoutRow(r: RawFieldLayoutRow): FieldLayoutRow {
  return {
    ...r,
    headerBold: !!r.headerBold,
    headerUnderline: !!r.headerUnderline,
    showOnWeb: !!r.showOnWeb,
    webHeader: !!r.webHeader,
  };
}

const FIELD_LAYOUT_SELECT = `SELECT id, field_type as fieldType, ref_id as refId, sort_order as sortOrder,
            custom_label as customLabel, height_px as heightPx,
            paired_with_id as pairedWithId, pair_mode as pairMode,
            content_font_size as contentFontSize, content_color as contentColor,
            content_background_color as contentBackgroundColor,
            content_radius as contentRadius, content_border_color as contentBorderColor,
            content_border_width as contentBorderWidth,
            header_font_size as headerFontSize, header_color as headerColor,
            header_bold as headerBold, header_underline as headerUnderline,
            show_on_web as showOnWeb, web_header as webHeader
     FROM field_layout WHERE category = $1 AND owner_id = $2 ORDER BY sort_order`;

export async function fetchFieldLayout(category: FieldCategory, ownerId: number): Promise<FieldLayoutRow[]> {
  const db = await getDb();
  const rawRows = await db.select<RawFieldLayoutRow[]>(FIELD_LAYOUT_SELECT, [category, ownerId]);
  if (rawRows.length > 0) return rawRows.map(mapFieldLayoutRow);

  // "INSERT OR IGNORE" (backed by idx_field_layout_singleton, a partial
  // unique index on category+owner_id+field_type — see database.ts's
  // dedupe_and_constrain_field_layout migration) rather than a plain
  // INSERT: two callers can race here (React StrictMode double-invokes
  // effects in dev, and nothing stopped a fast re-render from calling
  // this twice before the first backfill finished) — without the
  // constraint both would see zero rows and both would insert the full
  // default set, duplicating every field. With it, whichever call loses
  // the race just has its redundant inserts silently no-op.
  const defaults = defaultFieldsFor(category);
  for (let i = 0; i < defaults.length; i++) {
    await db.execute(
      "INSERT OR IGNORE INTO field_layout (category, owner_id, field_type, ref_id, sort_order) VALUES ($1, $2, $3, NULL, $4)",
      [category, ownerId, defaults[i], i]
    );
  }
  const rawRows2 = await db.select<RawFieldLayoutRow[]>(FIELD_LAYOUT_SELECT, [category, ownerId]);
  return rawRows2.map(mapFieldLayoutRow);
}

export async function reorderFields(orderedIds: number[]): Promise<void> {
  const db = await getDb();
  for (let i = 0; i < orderedIds.length; i++) {
    await db.execute("UPDATE field_layout SET sort_order = $1 WHERE id = $2", [i, orderedIds[i]]);
  }
}

// A singleton built-in field coming back after being removed (or being
// added for the first time via a portable extra, e.g. Dream's Estimated
// start date). No-ops if it's already present. Returns the row's id —
// either the one just inserted, or the pre-existing one if this call
// lost a race (see fetchFieldLayout's comment on the same index).
export async function addBuiltinField(
  category: FieldCategory,
  ownerId: number,
  fieldType: FieldType,
  sortOrder: number
): Promise<number> {
  const db = await getDb();
  await db.execute(
    "INSERT OR IGNORE INTO field_layout (category, owner_id, field_type, ref_id, sort_order) VALUES ($1, $2, $3, NULL, $4)",
    [category, ownerId, fieldType, sortOrder]
  );
  const rows = await db.select<{ id: number }[]>(
    "SELECT id FROM field_layout WHERE category = $1 AND owner_id = $2 AND field_type = $3",
    [category, ownerId, fieldType]
  );
  return rows[0].id;
}

export async function addFreetextField(category: FieldCategory, ownerId: number, sortOrder: number): Promise<number> {
  const db = await getDb();
  const result = await db.execute("INSERT INTO freetext_fields (label, content) VALUES ('Notes', '')");
  const refId = result.lastInsertId as number;
  const flResult = await db.execute(
    "INSERT INTO field_layout (category, owner_id, field_type, ref_id, sort_order) VALUES ($1, $2, 'freetext', $3, $4)",
    [category, ownerId, refId, sortOrder]
  );
  return flResult.lastInsertId as number;
}

// Removes the field-layout row; for a freetext field this also deletes
// its content row (nothing else references freetext_fields). Also frees
// any field paired to its right — a pair's secondary references the
// primary by id (see FieldLayoutRow.pairedWithId), so deleting either
// half always leaves the other, if any, as a normal full-width field
// rather than pointing at nothing.
export async function removeField(id: number, fieldType: FieldType, refId: number | null): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE field_layout SET paired_with_id = NULL, pair_mode = NULL WHERE paired_with_id = $1", [id]);
  await db.execute("DELETE FROM field_layout WHERE id = $1", [id]);
  if (fieldType === "freetext" && refId !== null) {
    await db.execute("DELETE FROM freetext_fields WHERE id = $1", [refId]);
  }
}

// Pairs `fieldId` (freshly added) to the right of `primaryId` — see the
// "add a field onto the right side of a field" flow in
// rearrange/RearrangeableField.tsx's FieldPairBar.
export async function setFieldPair(fieldId: number, primaryId: number, mode: PairMode): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE field_layout SET paired_with_id = $1, pair_mode = $2 WHERE id = $3", [primaryId, mode, fieldId]);
}

export async function updateFieldPairMode(secondaryId: number, mode: PairMode): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE field_layout SET pair_mode = $1 WHERE id = $2", [mode, secondaryId]);
}

// Splits a pair back into two normal full-width fields — the secondary
// keeps its own sort_order (already set when it was added), so it lands
// at the end of the list rather than vanishing.
export async function unpairField(secondaryId: number): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE field_layout SET paired_with_id = NULL, pair_mode = NULL WHERE id = $1", [secondaryId]);
}

export async function updateFieldLayoutLabel(id: number, label: string | null): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE field_layout SET custom_label = $1 WHERE id = $2", [label, id]);
}

export async function updateFieldLayoutHeight(id: number, heightPx: number | null): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE field_layout SET height_px = $1 WHERE id = $2", [heightPx, id]);
}

// A patch over a field's content/header style columns — see
// FieldStyleControls (components/FieldStylePopover.tsx). Each key is
// independently optional: leave a key out to not touch that column, or
// pass `null` to reset it back to the default look. Booleans reset the
// same way (`null`, not `false`) so "reset" and "explicitly turned off"
// stay distinguishable in storage even though they render identically.
export interface FieldStylePatch {
  contentFontSize?: number | null;
  contentColor?: string | null;
  contentBackgroundColor?: string | null;
  contentRadius?: number | null;
  contentBorderColor?: string | null;
  contentBorderWidth?: number | null;
  headerFontSize?: number | null;
  headerColor?: string | null;
  headerBold?: boolean | null;
  headerUnderline?: boolean | null;
  showOnWeb?: boolean | null;
  webHeader?: boolean | null;
}

const STYLE_COLUMN_MAP: Record<keyof FieldStylePatch, string> = {
  contentFontSize: "content_font_size",
  contentColor: "content_color",
  contentBackgroundColor: "content_background_color",
  contentRadius: "content_radius",
  contentBorderColor: "content_border_color",
  contentBorderWidth: "content_border_width",
  headerFontSize: "header_font_size",
  headerColor: "header_color",
  headerBold: "header_bold",
  headerUnderline: "header_underline",
  showOnWeb: "show_on_web",
  webHeader: "web_header",
};
const STYLE_BOOLEAN_COLUMNS = new Set<keyof FieldStylePatch>([
  "headerBold",
  "headerUnderline",
  "showOnWeb",
  "webHeader",
]);

// Which field types can actually be rendered on a Dream/Goal/Project Web
// graph card, and how — gates whether FieldStylePopover even offers the
// "On the web" toggles for a given field, so a field this system has no
// renderer for (e.g. the project's goal_select dropdown, a dream's
// linked-dreams list) never shows a checkbox that would silently do
// nothing. "text" fields show as a label+clipped blurb; "date" fields
// show as a static formatted date/range (never editable from the web —
// there's no input for it there); "widgets" is the whole widget bay,
// rendered as up to a few emoji buttons that open the widget.
export type WebFieldKind = "text" | "date" | "widgets";

export function webFieldKind(type: FieldType): WebFieldKind | null {
  switch (type) {
    case "goals_text":
    case "reasoning_text":
    case "needs_doing_text":
    case "dream_reasoning_text":
    case "dream_notes_text":
    case "freetext":
      return "text";
    case "estimated_start":
    case "expected_range":
    case "dream_expected_date":
      return "date";
    case "widgets":
      return "widgets";
    default:
      return null;
  }
}

export function isWebDisplayable(type: FieldType): boolean {
  return webFieldKind(type) !== null;
}

export async function updateFieldStyle(id: number, patch: FieldStylePatch): Promise<void> {
  const db = await getDb();
  const sets: string[] = [];
  const params: unknown[] = [];
  let i = 1;
  for (const [key, value] of Object.entries(patch) as [keyof FieldStylePatch, FieldStylePatch[keyof FieldStylePatch]][]) {
    if (value === undefined) continue;
    sets.push(`${STYLE_COLUMN_MAP[key]} = $${i}`);
    params.push(value === null ? null : STYLE_BOOLEAN_COLUMNS.has(key) ? (value ? 1 : 0) : value);
    i++;
  }
  if (sets.length === 0) return;
  params.push(id);
  await db.execute(`UPDATE field_layout SET ${sets.join(", ")} WHERE id = $${i}`, params);
}

export interface FreetextField {
  id: number;
  label: string;
  content: string;
}

export async function fetchFreetextFields(ids: number[]): Promise<Map<number, FreetextField>> {
  if (ids.length === 0) return new Map();
  const db = await getDb();
  const placeholders = ids.map((_, i) => `$${i + 1}`).join(", ");
  const rows = await db.select<FreetextField[]>(
    `SELECT id, label, content FROM freetext_fields WHERE id IN (${placeholders})`,
    ids
  );
  return new Map(rows.map((r) => [r.id, r]));
}

// ---- Undo ---------------------------------------------------------------
// One uniform mechanism for undoing (and redoing — see
// rearrange/RearrangeModeContext.tsx's popUndo/popRedo) any field-layout
// mutation: snapshot the owner's whole field list (plus whatever
// freetext content it references) right before the mutation, then — on
// undo — wipe whatever's there now and re-insert the snapshot verbatim,
// explicit ids and all. Simpler and less error-prone than a bespoke
// inverse per action type, and sidesteps any insert-ordering concern for
// paired_with_id (see its own comment) since it's a plain column, not a
// real FK. See rearrange/fieldUndo.ts.

export interface FieldLayoutSnapshot {
  fields: FieldLayoutRow[];
  freetext: FreetextField[];
}

export async function snapshotFieldLayout(category: FieldCategory, ownerId: number): Promise<FieldLayoutSnapshot> {
  const fields = await fetchFieldLayout(category, ownerId);
  const freetextIds = fields.filter((f) => f.fieldType === "freetext" && f.refId !== null).map((f) => f.refId!);
  const freetextMap = await fetchFreetextFields(freetextIds);
  return { fields, freetext: Array.from(freetextMap.values()) };
}

export async function restoreFieldLayoutSnapshot(
  category: FieldCategory,
  ownerId: number,
  snapshot: FieldLayoutSnapshot
): Promise<void> {
  const db = await getDb();
  const current = await fetchFieldLayout(category, ownerId);
  const currentFreetextIds = current
    .filter((f) => f.fieldType === "freetext" && f.refId !== null)
    .map((f) => f.refId!);
  await db.execute("DELETE FROM field_layout WHERE category = $1 AND owner_id = $2", [category, ownerId]);
  for (const id of currentFreetextIds) {
    await db.execute("DELETE FROM freetext_fields WHERE id = $1", [id]);
  }
  for (const ft of snapshot.freetext) {
    await db.execute("INSERT INTO freetext_fields (id, label, content) VALUES ($1, $2, $3)", [
      ft.id,
      ft.label,
      ft.content,
    ]);
  }
  for (const f of snapshot.fields) {
    await db.execute(
      `INSERT INTO field_layout (
         id, category, owner_id, field_type, ref_id, sort_order, custom_label, height_px, paired_with_id, pair_mode,
         content_font_size, content_color, content_background_color, content_radius, content_border_color, content_border_width,
         header_font_size, header_color, header_bold, header_underline, show_on_web, web_header
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)`,
      [
        f.id,
        category,
        ownerId,
        f.fieldType,
        f.refId,
        f.sortOrder,
        f.customLabel,
        f.heightPx,
        f.pairedWithId,
        f.pairMode,
        f.contentFontSize,
        f.contentColor,
        f.contentBackgroundColor,
        f.contentRadius,
        f.contentBorderColor,
        f.contentBorderWidth,
        f.headerFontSize,
        f.headerColor,
        f.headerBold ? 1 : 0,
        f.headerUnderline ? 1 : 0,
        f.showOnWeb ? 1 : 0,
        f.webHeader ? 1 : 0,
      ]
    );
  }
}

// Same idea as addFreetextField but pre-filled — backs paste (see
// rearrange/RearrangeModeContext.tsx's clipboard) and copying a
// built-in text field's current content into a standalone freetext box.
export async function addFreetextFieldWithContent(
  category: FieldCategory,
  ownerId: number,
  sortOrder: number,
  label: string,
  content: string
): Promise<number> {
  const db = await getDb();
  const result = await db.execute("INSERT INTO freetext_fields (label, content) VALUES ($1, $2)", [label, content]);
  const refId = result.lastInsertId as number;
  const flResult = await db.execute(
    "INSERT INTO field_layout (category, owner_id, field_type, ref_id, sort_order) VALUES ($1, $2, 'freetext', $3, $4)",
    [category, ownerId, refId, sortOrder]
  );
  return flResult.lastInsertId as number;
}

export async function updateFreetextField(
  id: number,
  fields: { label?: string; content?: string }
): Promise<void> {
  const db = await getDb();
  const sets: string[] = [];
  const params: unknown[] = [];
  let i = 1;
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined) continue;
    sets.push(`${key} = $${i}`);
    params.push(value);
    i++;
  }
  if (sets.length === 0) return;
  params.push(id);
  await db.execute(`UPDATE freetext_fields SET ${sets.join(", ")} WHERE id = $${i}`, params);
}
