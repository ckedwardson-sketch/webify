import { getDb } from "./database";
import { NotePage } from "../types/notes";

const PAGE_COLUMNS = `
  id, parent_id as parentId, category, title, icon, content,
  sort_order as sortOrder, created_at as createdAt, updated_at as updatedAt
`;

export async function fetchAllPages(): Promise<NotePage[]> {
  const db = await getDb();
  return db.select<NotePage[]>(`SELECT ${PAGE_COLUMNS} FROM notes_pages ORDER BY sort_order`);
}

export async function fetchPage(id: number): Promise<NotePage | null> {
  const db = await getDb();
  const rows = await db.select<NotePage[]>(`SELECT ${PAGE_COLUMNS} FROM notes_pages WHERE id = $1`, [id]);
  return rows[0] ?? null;
}

// Distinct categories in use, oldest-created first — backs the "pick an
// existing category or add a new one" control on the new-page form,
// same convention as GoalsHomePage's dream picker.
export async function fetchAllCategories(): Promise<string[]> {
  const db = await getDb();
  const rows = await db.select<{ category: string }[]>(
    "SELECT category FROM notes_pages GROUP BY category ORDER BY MIN(created_at)"
  );
  return rows.map((r) => r.category);
}

// New pages start with an empty paragraph doc so the editor never opens
// to a totally blank, unclickable state.
export async function addPage(parentId: number | null, category: string, title = "Untitled"): Promise<number> {
  const db = await getDb();
  const existing = await db.select<{ maxOrder: number | null }[]>(
    "SELECT MAX(sort_order) as maxOrder FROM notes_pages WHERE parent_id IS $1",
    [parentId]
  );
  const nextOrder = (existing[0].maxOrder ?? -1) + 1;
  const result = await db.execute(
    `INSERT INTO notes_pages (parent_id, category, title, sort_order, content, created_at, updated_at)
     VALUES ($1, $2, $3, $4, '<p></p>', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    [parentId, category, title, nextOrder]
  );
  return result.lastInsertId as number;
}

export async function updatePageTitle(id: number, title: string): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE notes_pages SET title = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2", [title, id]);
}

export async function updatePageContent(id: number, content: string): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE notes_pages SET content = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2", [
    content,
    id,
  ]);
}

export async function updatePageIcon(id: number, icon: string): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE notes_pages SET icon = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2", [icon, id]);
}

export async function updatePageCategory(id: number, category: string): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE notes_pages SET category = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2", [
    category,
    id,
  ]);
}

// "IS $1" — moving a sub-page back to the top level (parentId: null) is
// a real, reachable value here.
export async function updatePageParent(id: number, parentId: number | null): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE notes_pages SET parent_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2", [
    parentId,
    id,
  ]);
}

export async function reorderPages(orderedIds: number[]): Promise<void> {
  const db = await getDb();
  for (let i = 0; i < orderedIds.length; i++) {
    await db.execute("UPDATE notes_pages SET sort_order = $1 WHERE id = $2", [i, orderedIds[i]]);
  }
}

// Cascades to sub-pages and every block on all of them via the FKs'
// ON DELETE CASCADE (see database.ts's create_notes_tables migration).
export async function deletePage(id: number): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM notes_pages WHERE id = $1", [id]);
}

export interface NoteLinkTarget {
  id: number;
  title: string;
  category: string;
}

// For the editor's "link to a note" picker — every page across every
// category, mirroring fetchAllRecipesFlat in db/recipes.ts.
export async function fetchAllNotePagesFlat(): Promise<NoteLinkTarget[]> {
  const db = await getDb();
  return db.select<NoteLinkTarget[]>(
    "SELECT id, title, category FROM notes_pages ORDER BY category, sort_order"
  );
}
