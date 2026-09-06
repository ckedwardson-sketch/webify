// src/db/noteWebLinks.ts
//
// Attaches an existing Notes page (notes_pages) to a Goal Web or Dream
// Web canvas as a *reference* — the note itself is never copied or
// duplicated. Editing the note from any web edits the one underlying
// row; removing the attachment (removeNoteWebLink) only deletes the
// note_web_links row, never notes_pages itself.
import { getDb } from "./database";

export interface NoteWebLink {
  id: number;
  noteId: number;
  webType: "goal" | "dream";
  ownerId: number;
  posX: number;
  posY: number;
  title: string;
}

const COLUMNS = `
  nwl.id, nwl.note_id as noteId, nwl.web_type as webType, nwl.owner_id as ownerId,
  nwl.pos_x as posX, nwl.pos_y as posY, np.title as title
`;

export async function fetchNoteWebLinks(webType: "goal" | "dream", ownerId: number): Promise<NoteWebLink[]> {
  const db = await getDb();
  return db.select<NoteWebLink[]>(
    `SELECT ${COLUMNS} FROM note_web_links nwl
     JOIN notes_pages np ON np.id = nwl.note_id
     WHERE nwl.web_type = $1 AND nwl.owner_id = $2`,
    [webType, ownerId]
  );
}

// Batch variant for Dream Web, which renders every dream at once and
// needs each one's attached notes in a single query rather than one
// round trip per dream — same convention as fetchGoalWebLinksForGoals.
export async function fetchNoteWebLinksForOwners(webType: "goal" | "dream", ownerIds: number[]): Promise<NoteWebLink[]> {
  if (ownerIds.length === 0) return [];
  const db = await getDb();
  const placeholders = ownerIds.map((_, i) => `$${i + 2}`).join(", ");
  return db.select<NoteWebLink[]>(
    `SELECT ${COLUMNS} FROM note_web_links nwl
     JOIN notes_pages np ON np.id = nwl.note_id
     WHERE nwl.web_type = $1 AND nwl.owner_id IN (${placeholders})`,
    [webType, ...ownerIds]
  );
}

export async function addNoteWebLink(
  webType: "goal" | "dream",
  ownerId: number,
  noteId: number,
  x: number,
  y: number
): Promise<number> {
  const db = await getDb();
  const result = await db.execute(
    "INSERT INTO note_web_links (note_id, web_type, owner_id, pos_x, pos_y) VALUES ($1, $2, $3, $4, $5)",
    [noteId, webType, ownerId, x, y]
  );
  return result.lastInsertId as number;
}

// Deletes only the attachment row — the underlying notes_pages row is
// never touched here.
export async function removeNoteWebLink(id: number): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM note_web_links WHERE id = $1", [id]);
}

export async function updateNoteWebLinkPosition(id: number, x: number, y: number): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE note_web_links SET pos_x = $1, pos_y = $2 WHERE id = $3", [x, y, id]);
}

export interface NotePickerOption {
  id: number;
  title: string;
}

// Every note page, for the "attach an existing note" dropdown — reuses
// notes.ts's fetchAllNotePagesFlat query shape (id/title) rather than a
// second near-identical query.
export async function fetchNotePagesForPicker(): Promise<NotePickerOption[]> {
  const db = await getDb();
  return db.select<NotePickerOption[]>("SELECT id, title FROM notes_pages ORDER BY category, sort_order");
}
