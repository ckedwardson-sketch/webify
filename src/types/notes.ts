// A deliberately smaller slice of Notion's block model — enough for
// real note-taking (headings, lists, to-dos, quotes, callouts, a
// divider) without the databases/embeds/columns layer of the real
// thing. See db/notes.ts and pages/NotesPage.tsx.
export type NoteBlockType =
  | "paragraph"
  | "heading1"
  | "heading2"
  | "heading3"
  | "bulleted"
  | "numbered"
  | "todo"
  | "quote"
  | "divider"
  | "callout";

export interface NotePage {
  id: number;
  parentId: number | null;
  category: string;
  title: string;
  icon: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  // Single Tiptap HTML document for the page — replaces the old
  // row-per-block model below. See db/notesMigration.ts for the
  // one-time backfill and editor/NoteContentEditor.tsx for the editor.
  content: string;
}

// Legacy — only used by the notes_blocks migration reader in
// db/database.ts. Nothing in the live app writes/reads through these
// anymore; content lives in NotePage.content instead.
export interface NoteBlock {
  id: number;
  pageId: number;
  blockType: NoteBlockType;
  content: string;
  checked: boolean;
  sortOrder: number;
}
