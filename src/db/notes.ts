import { getDb } from "./database";
import { NotePage, NoteBlock, NoteBlockType } from "../types/notes";

const PAGE_COLUMNS = `
  id, parent_id as parentId, category, title, icon,
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

// New pages start with one empty paragraph block so the editor never
// opens to a totally blank, unclickable state.
export async function addPage(parentId: number | null, category: string, title = "Untitled"): Promise<number> {
  const db = await getDb();
  const existing = await db.select<{ maxOrder: number | null }[]>(
    "SELECT MAX(sort_order) as maxOrder FROM notes_pages WHERE parent_id IS $1",
    [parentId]
  );
  const nextOrder = (existing[0].maxOrder ?? -1) + 1;
  const result = await db.execute(
    `INSERT INTO notes_pages (parent_id, category, title, sort_order, created_at, updated_at)
     VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    [parentId, category, title, nextOrder]
  );
  const id = result.lastInsertId as number;
  await db.execute("INSERT INTO notes_blocks (page_id, block_type, content, sort_order) VALUES ($1, 'paragraph', '', 0)", [id]);
  return id;
}

export async function updatePageTitle(id: number, title: string): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE notes_pages SET title = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2", [title, id]);
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

// ---- Blocks -----------------------------------------------------------

const BLOCK_COLUMNS = `
  id, page_id as pageId, block_type as blockType, content, checked, sort_order as sortOrder
`;

type RawBlockRow = Omit<NoteBlock, "checked"> & { checked: number };

function mapBlock(row: RawBlockRow): NoteBlock {
  return { ...row, checked: !!row.checked };
}

export async function fetchBlocksForPage(pageId: number): Promise<NoteBlock[]> {
  const db = await getDb();
  const rows = await db.select<RawBlockRow[]>(
    `SELECT ${BLOCK_COLUMNS} FROM notes_blocks WHERE page_id = $1 ORDER BY sort_order`,
    [pageId]
  );
  return rows.map(mapBlock);
}

export async function addBlock(
  pageId: number,
  blockType: NoteBlockType,
  content: string,
  sortOrder: number
): Promise<number> {
  const db = await getDb();
  const result = await db.execute(
    "INSERT INTO notes_blocks (page_id, block_type, content, sort_order) VALUES ($1, $2, $3, $4)",
    [pageId, blockType, content, sortOrder]
  );
  return result.lastInsertId as number;
}

export async function updateBlockContent(id: number, content: string): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE notes_blocks SET content = $1 WHERE id = $2", [content, id]);
}

export async function updateBlockType(id: number, blockType: NoteBlockType): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE notes_blocks SET block_type = $1 WHERE id = $2", [blockType, id]);
}

export async function updateBlockChecked(id: number, checked: boolean): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE notes_blocks SET checked = $1 WHERE id = $2", [checked ? 1 : 0, id]);
}

export async function deleteBlock(id: number): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM notes_blocks WHERE id = $1", [id]);
}

export async function reorderBlocks(orderedIds: number[]): Promise<void> {
  const db = await getDb();
  for (let i = 0; i < orderedIds.length; i++) {
    await db.execute("UPDATE notes_blocks SET sort_order = $1 WHERE id = $2", [i, orderedIds[i]]);
  }
}
