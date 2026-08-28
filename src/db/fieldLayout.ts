import { getDb } from "./database";

// The set of vertically-arrangeable "areas" a Project/Goal Detail page
// can show. "widgets" is the whole widget grid — one slot, still
// internally reordered by its own existing drag system (see
// ProjectDetailPage.tsx) — not one slot per widget; splitting that apart
// is a bigger redesign than this pass covers. "freetext" is the one new
// generic field kind: unlimited per owner, unlike every other type here
// which is a singleton tied to a fixed DB column.
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
  | "dream_memory";

// Which field types a Delete-then-re-Add round trip is actually
// supported for — the rest (Goals/Reasoning/What needs doing/the Goal
// picker/Priority/Linked dreams/Memory) are permanent for now: they map
// 1:1 to an always-relevant DB column or a relationship panel, and
// re-add plumbing for every one of them isn't worth it yet. They're
// still fully drag-reorderable, just not removable.
export const REMOVABLE_FIELD_TYPES: FieldType[] = [
  "estimated_start",
  "expected_range",
  "dream_expected_date",
  "freetext",
];

export interface FieldLayoutRow {
  id: number;
  fieldType: FieldType;
  refId: number | null;
  sortOrder: number;
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

export type FieldCategory = "project" | "goal" | "dream";

function defaultFieldsFor(category: FieldCategory): FieldType[] {
  if (category === "project") return PROJECT_DEFAULT_FIELDS;
  if (category === "goal") return GOAL_DEFAULT_FIELDS;
  return DREAM_DEFAULT_FIELDS;
}

// Lazily backfills the original hardcoded field order the first time an
// owner is read, so pre-existing projects/goals see exactly what they
// always saw instead of an empty page.
export async function fetchFieldLayout(category: FieldCategory, ownerId: number): Promise<FieldLayoutRow[]> {
  const db = await getDb();
  const rows = await db.select<FieldLayoutRow[]>(
    `SELECT id, field_type as fieldType, ref_id as refId, sort_order as sortOrder
     FROM field_layout WHERE category = $1 AND owner_id = $2 ORDER BY sort_order`,
    [category, ownerId]
  );
  if (rows.length > 0) return rows;

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
  return db.select<FieldLayoutRow[]>(
    `SELECT id, field_type as fieldType, ref_id as refId, sort_order as sortOrder
     FROM field_layout WHERE category = $1 AND owner_id = $2 ORDER BY sort_order`,
    [category, ownerId]
  );
}

export async function reorderFields(orderedIds: number[]): Promise<void> {
  const db = await getDb();
  for (let i = 0; i < orderedIds.length; i++) {
    await db.execute("UPDATE field_layout SET sort_order = $1 WHERE id = $2", [i, orderedIds[i]]);
  }
}

// A singleton built-in field (currently only estimated_start/
// expected_range are ever re-added this way — see REMOVABLE_FIELD_TYPES)
// coming back after being removed. No-ops if it's already present.
export async function addBuiltinField(
  category: FieldCategory,
  ownerId: number,
  fieldType: FieldType,
  sortOrder: number
): Promise<void> {
  const db = await getDb();
  // The unique index (see fetchFieldLayout's comment) is what actually
  // guarantees no duplicate — this is a straight insert-or-noop rather
  // than a check-then-insert, which had the same race window.
  await db.execute(
    "INSERT OR IGNORE INTO field_layout (category, owner_id, field_type, ref_id, sort_order) VALUES ($1, $2, $3, NULL, $4)",
    [category, ownerId, fieldType, sortOrder]
  );
}

export async function addFreetextField(category: FieldCategory, ownerId: number, sortOrder: number): Promise<void> {
  const db = await getDb();
  const result = await db.execute("INSERT INTO freetext_fields (label, content) VALUES ('Notes', '')");
  const refId = result.lastInsertId as number;
  await db.execute(
    "INSERT INTO field_layout (category, owner_id, field_type, ref_id, sort_order) VALUES ($1, $2, 'freetext', $3, $4)",
    [category, ownerId, refId, sortOrder]
  );
}

// Removes the field-layout row; for a freetext field this also deletes
// its content row (nothing else references freetext_fields).
export async function removeField(id: number, fieldType: FieldType, refId: number | null): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM field_layout WHERE id = $1", [id]);
  if (fieldType === "freetext" && refId !== null) {
    await db.execute("DELETE FROM freetext_fields WHERE id = $1", [refId]);
  }
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
// One uniform mechanism for undoing any field-layout mutation (reorder,
// delete, add, duplicate/paste): snapshot the owner's whole field list
// (plus whatever freetext content it references) right before the
// mutation, then — on undo — wipe whatever's there now and re-insert the
// snapshot verbatim, explicit ids and all. Simpler and less error-prone
// than a bespoke inverse per action type. See rearrange/fieldUndo.ts.

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
      "INSERT INTO field_layout (id, category, owner_id, field_type, ref_id, sort_order) VALUES ($1, $2, $3, $4, $5, $6)",
      [f.id, category, ownerId, f.fieldType, f.refId, f.sortOrder]
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
): Promise<void> {
  const db = await getDb();
  const result = await db.execute("INSERT INTO freetext_fields (label, content) VALUES ($1, $2)", [label, content]);
  const refId = result.lastInsertId as number;
  await db.execute(
    "INSERT INTO field_layout (category, owner_id, field_type, ref_id, sort_order) VALUES ($1, $2, 'freetext', $3, $4)",
    [category, ownerId, refId, sortOrder]
  );
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
