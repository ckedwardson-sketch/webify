import { getDb } from "./database";
import { Category } from "../types/models";

export async function fetchCategories(): Promise<Category[]> {
  const db = await getDb();
  return db.select<Category[]>(
    "SELECT id, name, sort_order as sortOrder FROM categories ORDER BY sort_order"
  );
}

export async function addCategory(name: string): Promise<void> {
  const db = await getDb();
  const existing = await db.select<{ maxOrder: number | null }[]>(
    "SELECT MAX(sort_order) as maxOrder FROM categories"
  );
  const nextOrder = (existing[0].maxOrder ?? -1) + 1;
  await db.execute("INSERT INTO categories (name, sort_order) VALUES ($1, $2)", [
    name,
    nextOrder,
  ]);
}

export async function renameCategory(id: number, name: string): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE categories SET name = $1 WHERE id = $2", [name, id]);
}

export async function deleteCategory(id: number): Promise<void> {
  const db = await getDb();
  // Foreign keys are on (see database.ts), so this also removes every
  // recipe that belonged to this category.
  await db.execute("DELETE FROM categories WHERE id = $1", [id]);
}

// Called after a drag-reorder finishes. Takes the full list of category
// ids in their new order and writes matching sort_order values.
export async function reorderCategories(orderedIds: number[]): Promise<void> {
  const db = await getDb();
  for (let i = 0; i < orderedIds.length; i++) {
    await db.execute("UPDATE categories SET sort_order = $1 WHERE id = $2", [
      i,
      orderedIds[i],
    ]);
  }
}
