import { getDb } from "./database";
import { FieldCategory } from "./fieldLayout";

// Generalized version of dream_history (db/dreams.ts) — same shape, but
// keyed by category+owner_id like field_layout itself, so any category
// can back a portable "memory" field (see fieldLayout.ts's FieldType)
// instead of just Dream. Dream's own built-in Memory field keeps reading
// dream_history unchanged; this is what a Memory field added to a
// Project or Goal reads from.
export interface EntityHistoryEntry {
  id: number;
  category: FieldCategory;
  ownerId: number;
  field: string;
  oldValue: string | null;
  newValue: string | null;
  reason: string | null;
  changedAt: string;
}

export async function fetchEntityHistory(category: FieldCategory, ownerId: number): Promise<EntityHistoryEntry[]> {
  const db = await getDb();
  return db.select<EntityHistoryEntry[]>(
    `SELECT id, category, owner_id as ownerId, field, old_value as oldValue, new_value as newValue,
            reason, changed_at as changedAt
     FROM entity_history WHERE category = $1 AND owner_id = $2 ORDER BY changed_at DESC, id DESC`,
    [category, ownerId]
  );
}

// Fire-and-forget logging for a field edit — called alongside a
// Project/Goal's existing update functions so their portable Memory
// field (if added) has real content, matching how most of Dream's own
// fields already log silently (no reason prompt) via updateDreamField.
// No-ops if old/new are equal, same convention as updateDreamField.
export async function recordEntityHistory(
  category: FieldCategory,
  ownerId: number,
  field: string,
  oldValue: string | null,
  newValue: string | null,
  reason: string | null = null
): Promise<void> {
  if (oldValue === newValue) return;
  const db = await getDb();
  await db.execute(
    "INSERT INTO entity_history (category, owner_id, field, old_value, new_value, reason) VALUES ($1, $2, $3, $4, $5, $6)",
    [category, ownerId, field, oldValue, newValue, reason]
  );
}

export async function deleteEntityHistoryFor(category: FieldCategory, ownerId: number): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM entity_history WHERE category = $1 AND owner_id = $2", [category, ownerId]);
}
