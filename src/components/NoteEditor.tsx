import { useEffect, useRef, useState } from "react";
import { NoteBlock, NoteBlockType } from "../types/notes";
import {
  fetchBlocksForPage,
  addBlock,
  updateBlockContent,
  updateBlockType,
  updateBlockChecked,
  deleteBlock,
  reorderBlocks,
} from "../db/notes";
import "./NoteEditor.css";

const BLOCK_TYPE_META: Record<NoteBlockType, { label: string; icon: string }> = {
  paragraph: { label: "Text", icon: "¶" },
  heading1: { label: "Heading 1", icon: "H1" },
  heading2: { label: "Heading 2", icon: "H2" },
  heading3: { label: "Heading 3", icon: "H3" },
  bulleted: { label: "Bulleted list", icon: "•" },
  numbered: { label: "Numbered list", icon: "1." },
  todo: { label: "To-do", icon: "☑" },
  quote: { label: "Quote", icon: "❝" },
  callout: { label: "Callout", icon: "💡" },
  divider: { label: "Divider", icon: "—" },
};

const BLOCK_TYPE_ORDER: NoteBlockType[] = [
  "paragraph",
  "heading1",
  "heading2",
  "heading3",
  "bulleted",
  "numbered",
  "todo",
  "quote",
  "callout",
  "divider",
];

// Pressing Enter on one of these continues the same block type instead
// of dropping back to plain text — matches how Notion keeps you "in" a
// list/quote/callout until you deliberately leave it.
const CONTINUATION_TYPES: NoteBlockType[] = ["bulleted", "numbered", "todo", "quote", "callout"];
// Pressing Enter on an EMPTY one of these exits back to plain text
// instead of adding yet another empty list item.
const EXIT_ON_EMPTY_TYPES: NoteBlockType[] = ["bulleted", "numbered", "todo"];

// Typing one of these at the very start of an empty paragraph
// auto-converts the block and strips the trigger text — the same
// "type markdown, get formatting" muscle memory Notion trains.
const SHORTCUTS: { pattern: RegExp; type: NoteBlockType }[] = [
  { pattern: /^### $/, type: "heading3" },
  { pattern: /^## $/, type: "heading2" },
  { pattern: /^# $/, type: "heading1" },
  { pattern: /^[-*] $/, type: "bulleted" },
  { pattern: /^1\. $/, type: "numbered" },
  { pattern: /^\[ ?\] $/, type: "todo" },
  { pattern: /^> $/, type: "quote" },
  { pattern: /^---$/, type: "divider" },
];

function placeholderFor(type: NoteBlockType): string {
  switch (type) {
    case "heading1":
      return "Heading 1";
    case "heading2":
      return "Heading 2";
    case "heading3":
      return "Heading 3";
    case "bulleted":
    case "numbered":
      return "List item";
    case "todo":
      return "To-do";
    case "quote":
      return "Quote";
    case "callout":
      return "Callout";
    default:
      return "Write, or start a line with '#', '-', '1.', '[]', '>' or '---'…";
  }
}

// The right-hand block editor for one note page — self-contained, owns
// and persists its own block list, same "fetch on mount, autosave as
// you go" shape as the rest of this app's detail pages.
export function NoteEditor({ pageId }: { pageId: number }) {
  const [blocks, setBlocks] = useState<NoteBlock[] | null>(null);
  const [typeMenuFor, setTypeMenuFor] = useState<number | null>(null);
  const [dragOverId, setDragOverId] = useState<number | null>(null);
  const focusNextId = useRef<number | null>(null);

  useEffect(() => {
    setBlocks(null);
    fetchBlocksForPage(pageId).then(setBlocks);
  }, [pageId]);

  useEffect(() => {
    if (focusNextId.current === null || !blocks) return;
    const el = document.getElementById(`note-block-${focusNextId.current}`) as HTMLTextAreaElement | null;
    if (el) {
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
    }
    focusNextId.current = null;
  }, [blocks]);

  if (blocks === null) {
    return <p className="page-text">Loading…</p>;
  }

  const setLocalContent = (id: number, content: string) => {
    setBlocks((prev) => (prev ? prev.map((b) => (b.id === id ? { ...b, content } : b)) : prev));
  };

  const changeType = async (id: number, type: NoteBlockType) => {
    setBlocks((prev) => (prev ? prev.map((b) => (b.id === id ? { ...b, blockType: type } : b)) : prev));
    setTypeMenuFor(null);
    await updateBlockType(id, type);
  };

  const toggleChecked = async (b: NoteBlock) => {
    const checked = !b.checked;
    setBlocks((prev) => (prev ? prev.map((x) => (x.id === b.id ? { ...x, checked } : x)) : prev));
    await updateBlockChecked(b.id, checked);
  };

  // Fetches fresh from the DB rather than optimistically splicing —
  // simpler to get right than hand-computing fractional sort_orders in
  // JS, and SQLite is local/instant so the round-trip doesn't show.
  const insertBlockAfter = async (afterIndex: number, type: NoteBlockType = "paragraph") => {
    if (!blocks) return;
    const order = afterIndex < 0 ? (blocks[0]?.sortOrder ?? 0) - 1 : blocks[afterIndex].sortOrder + 0.5;
    const id = await addBlock(pageId, type, "", order);
    focusNextId.current = id;
    const fresh = await fetchBlocksForPage(pageId);
    await reorderBlocks(fresh.map((b) => b.id)); // tidy fractional orders back to clean integers
    setBlocks(fresh);
  };

  const removeBlock = async (index: number) => {
    if (!blocks || blocks.length <= 1) return; // never let a page go fully blockless
    const b = blocks[index];
    const prevBlock = blocks[index - 1];
    if (prevBlock) focusNextId.current = prevBlock.id;
    await deleteBlock(b.id);
    setBlocks((prev) => (prev ? prev.filter((x) => x.id !== b.id) : prev));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>, index: number) => {
    const b = blocks![index];
    if (e.key === "Enter" && !e.shiftKey && b.blockType !== "divider") {
      e.preventDefault();
      if (EXIT_ON_EMPTY_TYPES.includes(b.blockType) && b.content.trim() === "") {
        changeType(b.id, "paragraph");
        return;
      }
      insertBlockAfter(index, CONTINUATION_TYPES.includes(b.blockType) ? b.blockType : "paragraph");
      return;
    }
    if (e.key === "Backspace" && b.content === "" && blocks!.length > 1) {
      e.preventDefault();
      removeBlock(index);
    }
  };

  const handleChange = (index: number, raw: string) => {
    const b = blocks![index];
    const shortcut = b.blockType === "paragraph" ? SHORTCUTS.find((s) => s.pattern.test(raw)) : undefined;
    if (shortcut) {
      const stripped = raw.replace(shortcut.pattern, "");
      setLocalContent(b.id, stripped);
      updateBlockContent(b.id, stripped);
      changeType(b.id, shortcut.type);
      return;
    }
    setLocalContent(b.id, raw);
  };

  const handleDragStart = (e: React.DragEvent, id: number) => {
    e.dataTransfer.setData("text/plain", String(id));
  };
  const handleDragOver = (e: React.DragEvent, id: number) => {
    e.preventDefault();
    setDragOverId(id);
  };
  const handleDrop = async (e: React.DragEvent, targetId: number) => {
    e.preventDefault();
    setDragOverId(null);
    const draggedId = Number(e.dataTransfer.getData("text/plain"));
    if (!draggedId || draggedId === targetId || !blocks) return;
    const ids = blocks.map((b) => b.id);
    const from = ids.indexOf(draggedId);
    const to = ids.indexOf(targetId);
    if (from === -1 || to === -1) return;
    ids.splice(from, 1);
    ids.splice(to, 0, draggedId);
    await reorderBlocks(ids);
    const byId = new Map(blocks.map((b) => [b.id, b]));
    setBlocks(ids.map((id) => byId.get(id)!));
  };

  let numberedCounter = 0;

  return (
    <div className="note-blocks">
      {blocks.map((b, i) => {
        numberedCounter = b.blockType === "numbered" ? numberedCounter + 1 : 0;
        return (
          <NoteBlockRow
            key={b.id}
            block={b}
            listIndex={numberedCounter}
            dragOver={dragOverId === b.id}
            typeMenuOpen={typeMenuFor === b.id}
            onToggleTypeMenu={() => setTypeMenuFor((v) => (v === b.id ? null : b.id))}
            onChangeType={(t) => changeType(b.id, t)}
            onChange={(v) => handleChange(i, v)}
            onBlur={() => updateBlockContent(b.id, b.content)}
            onKeyDown={(e) => handleKeyDown(e, i)}
            onToggleChecked={() => toggleChecked(b)}
            onAddBelow={() => insertBlockAfter(i)}
            onDelete={() => removeBlock(i)}
            onDragStart={(e) => handleDragStart(e, b.id)}
            onDragOver={(e) => handleDragOver(e, b.id)}
            onDragLeave={() => setDragOverId((id) => (id === b.id ? null : id))}
            onDrop={(e) => handleDrop(e, b.id)}
          />
        );
      })}
      <button className="note-add-block-end" onClick={() => insertBlockAfter(blocks.length - 1)}>
        + Add a block
      </button>
    </div>
  );
}

function NoteBlockRow({
  block,
  listIndex,
  dragOver,
  typeMenuOpen,
  onToggleTypeMenu,
  onChangeType,
  onChange,
  onBlur,
  onKeyDown,
  onToggleChecked,
  onAddBelow,
  onDelete,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
}: {
  block: NoteBlock;
  listIndex: number;
  dragOver: boolean;
  typeMenuOpen: boolean;
  onToggleTypeMenu: () => void;
  onChangeType: (t: NoteBlockType) => void;
  onChange: (v: string) => void;
  onBlur: () => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onToggleChecked: () => void;
  onAddBelow: () => void;
  onDelete: () => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [block.content]);

  const meta = BLOCK_TYPE_META[block.blockType];

  return (
    <div
      className={`note-block note-block-${block.blockType}${dragOver ? " note-block-drop-target" : ""}`}
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <div className="note-block-gutter">
        <button className="note-block-gutter-btn note-block-add" title="Add block below" onClick={onAddBelow}>
          +
        </button>
        <button className="note-block-gutter-btn note-block-handle" title="Drag to reorder">
          ⠿
        </button>
      </div>

      <div className="note-block-body">
        {block.blockType === "divider" ? (
          <hr className="note-block-divider" />
        ) : (
          <div className="note-block-content-row">
            {block.blockType === "bulleted" && <span className="note-block-bullet">•</span>}
            {block.blockType === "numbered" && <span className="note-block-bullet">{listIndex}.</span>}
            {block.blockType === "todo" && (
              <input
                type="checkbox"
                className="note-block-checkbox"
                checked={block.checked}
                onChange={onToggleChecked}
              />
            )}
            {block.blockType === "callout" && <span className="note-block-callout-icon">💡</span>}
            <textarea
              ref={textareaRef}
              id={`note-block-${block.id}`}
              className={`note-block-input${block.checked && block.blockType === "todo" ? " note-block-checked" : ""}`}
              rows={1}
              value={block.content}
              placeholder={placeholderFor(block.blockType)}
              onChange={(e) => onChange(e.target.value)}
              onBlur={onBlur}
              onKeyDown={onKeyDown}
            />
          </div>
        )}
      </div>

      <div className="note-block-actions">
        <button className="note-block-type-btn" title="Turn into…" onClick={onToggleTypeMenu}>
          {meta.icon}
        </button>
        {typeMenuOpen && (
          <>
            <div className="menu-backdrop" onClick={onToggleTypeMenu} />
            <div className="note-block-type-menu">
              {BLOCK_TYPE_ORDER.map((t) => (
                <button key={t} className="dropdown-item" onClick={() => onChangeType(t)}>
                  <span className="note-block-type-menu-icon">{BLOCK_TYPE_META[t].icon}</span>
                  {BLOCK_TYPE_META[t].label}
                </button>
              ))}
            </div>
          </>
        )}
        <button className="note-block-delete" title="Delete block" onClick={onDelete}>
          ✕
        </button>
      </div>
    </div>
  );
}
