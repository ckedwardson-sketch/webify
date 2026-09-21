import { ArchivedItem, ChecklistLine } from "./checklistTypes";

// Every rule about what a checklist *is* lives here: which lines belong
// to which task, what Enter and Backspace do, what "clear checked"
// removes. ChecklistEditor.tsx only wires DOM events to these functions
// and ChecklistPage.tsx only wires buttons to them, so the behaviour can
// be reasoned about (and later tested) without a browser.
//
// The shape of the thing:
//
//   [x] Feed the chickens        <- "task": starts a block
//       and top up their water   <- "cont": same block, no checkbox
//   [ ] Order more feed          <- "task": new block
//                                <- blank
//                                <- blank  (two in a row ends it)
//   reminder: the co-op closes   <- "free": outside the system entirely
//
// A block is measured checkbox-to-checkbox. Free text is whatever sits
// after the last checkbox once two or more blank lines have separated
// it — it is never ticked, cleared or archived.

export type LineKind = "task" | "cont" | "free";

export interface LineInfo {
  kind: LineKind;
  // For "task": the line's own tick. For "cont": its block's tick, so a
  // detail line strikes through along with its task. Always false for
  // "free".
  checked: boolean;
}

// What an edit produced: the new lines, and (when the edit moved the
// caret somewhere that doesn't exist yet) where it should land once
// React has rendered them.
export interface EditResult {
  lines: ChecklistLine[];
  focus?: { id: string; caret: number };
}

export interface TaskBlock {
  start: number;
  // Exclusive.
  end: number;
  checked: boolean;
  checkedAt: number;
  // The block's lines joined with "\n", trailing blanks trimmed.
  text: string;
}

export interface ClearResult {
  lines: ChecklistLine[];
  removed: number;
}

export interface ArchiveResult {
  lines: ChecklistLine[];
  // Newest-ticked first, ready to be prepended to the existing archive.
  items: ArchivedItem[];
  removed: number;
}

// Two blank lines in a row is what separates free text from the list.
const BLANKS_TO_END_LIST = 2;

let idCounter = 0;

export function newLineId(): string {
  idCounter += 1;
  return `cl-${Date.now().toString(36)}-${idCounter.toString(36)}`;
}

export function blankTaskLine(): ChecklistLine {
  return { id: newLineId(), text: "", checkbox: true, checked: false };
}

// ---- Classification ---------------------------------------------------

function isBlank(line: ChecklistLine): boolean {
  return !line.checkbox && line.text.trim() === "";
}

// Index at which free text begins, or lines.length if there is none.
// Only a gap *after the last checkbox* counts: two blank lines in the
// middle of a list are just part of whichever block they fall in, since
// the user clearly went on to add more tasks below them.
function freeTextStart(lines: ChecklistLine[]): number {
  let lastBox = -1;
  for (let i = 0; i < lines.length; i++) if (lines[i].checkbox) lastBox = i;
  if (lastBox === -1) return 0; // no checkboxes at all — it's all free text

  let runStart = -1;
  for (let i = lastBox + 1; i < lines.length; i++) {
    if (!isBlank(lines[i])) {
      runStart = -1;
      continue;
    }
    if (runStart === -1) runStart = i;
    else if (i - runStart + 1 >= BLANKS_TO_END_LIST) return runStart;
  }
  return lines.length;
}

export function classifyLines(lines: ChecklistLine[]): LineInfo[] {
  const free = freeTextStart(lines);
  const infos: LineInfo[] = [];
  let seenBox = false;
  let blockChecked = false;

  for (let i = 0; i < lines.length; i++) {
    if (i >= free) {
      infos.push({ kind: "free", checked: false });
      continue;
    }
    const line = lines[i];
    if (line.checkbox) {
      seenBox = true;
      blockChecked = line.checked;
      infos.push({ kind: "task", checked: line.checked });
    } else if (!seenBox) {
      // Anything above the first checkbox is outside the system too.
      infos.push({ kind: "free", checked: false });
    } else {
      infos.push({ kind: "cont", checked: blockChecked });
    }
  }
  return infos;
}

function joinBlock(lines: ChecklistLine[], start: number, end: number): string {
  return lines
    .slice(start, end)
    .map((l) => l.text)
    .join("\n")
    .replace(/\s+$/, "");
}

export function taskBlocks(lines: ChecklistLine[]): TaskBlock[] {
  const infos = classifyLines(lines);
  const blocks: TaskBlock[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (infos[i].kind !== "task") continue;
    let end = i + 1;
    while (end < lines.length && infos[end].kind === "cont") end += 1;
    blocks.push({
      start: i,
      end,
      checked: lines[i].checked,
      checkedAt: lines[i].checkedAt ?? 0,
      text: joinBlock(lines, i, end),
    });
  }
  return blocks;
}

export function countChecked(lines: ChecklistLine[]): number {
  return taskBlocks(lines).filter((b) => b.checked).length;
}

// ---- Clearing and archiving ------------------------------------------

// The list should never be left with nothing to type into, and never
// without a checkbox to start the next task from.
function ensureUsable(lines: ChecklistLine[]): ChecklistLine[] {
  if (lines.length === 0) return [blankTaskLine()];
  if (lines.some((l) => l.checkbox)) return lines;
  // Only free text left. Put a fresh task above it — the two blank
  // lines that made it free text are still there, so it stays free.
  return [blankTaskLine(), ...lines];
}

function removeBlocks(lines: ChecklistLine[], blocks: TaskBlock[]): ChecklistLine[] {
  const drop = new Set<number>();
  for (const block of blocks) for (let i = block.start; i < block.end; i++) drop.add(i);
  return lines.filter((_, i) => !drop.has(i));
}

export function clearChecked(lines: ChecklistLine[]): ClearResult {
  const checked = taskBlocks(lines).filter((b) => b.checked);
  if (checked.length === 0) return { lines, removed: 0 };
  return { lines: ensureUsable(removeBlocks(lines, checked)), removed: checked.length };
}

export function archiveChecked(lines: ChecklistLine[], nowMs: number): ArchiveResult {
  const checked = taskBlocks(lines).filter((b) => b.checked);
  if (checked.length === 0) return { lines, items: [], removed: 0 };
  const items: ArchivedItem[] = checked
    // A ticked but empty task is still cleared from the list; there's
    // just nothing worth keeping a record of.
    .filter((b) => b.text.trim() !== "")
    .map((b) => ({ id: newLineId(), text: b.text, checkedAt: b.checkedAt || nowMs }))
    .sort((a, b) => b.checkedAt - a.checkedAt);
  return { lines: ensureUsable(removeBlocks(lines, checked)), items, removed: checked.length };
}

// ---- Editing ----------------------------------------------------------

export function setChecked(
  lines: ChecklistLine[],
  id: string,
  checked: boolean,
  nowMs: number
): ChecklistLine[] {
  return lines.map((line) =>
    line.id === id ? { ...line, checked, checkedAt: checked ? nowMs : undefined } : line
  );
}

export function typeInLine(
  lines: ChecklistLine[],
  index: number,
  text: string,
  nowMs: number
): EditResult | null {
  const line = lines[index];
  if (!line) return null;
  const out = lines.slice();
  // Going back and editing something you'd already ticked counts as
  // finishing with it again, so the archive's newest-first order
  // follows the edit rather than the original tick.
  out[index] = { ...line, text, checkedAt: line.checked ? nowMs : line.checkedAt };
  return { lines: out };
}

// Enter. Inside the list it starts a new task; Shift+Enter (`soft`)
// continues the current one instead; inside free text it's just a
// newline.
export function splitLine(
  lines: ChecklistLine[],
  index: number,
  caret: number,
  soft: boolean
): EditResult | null {
  const line = lines[index];
  if (!line) return null;
  const free = classifyLines(lines)[index].kind === "free";
  const next: ChecklistLine = {
    id: newLineId(),
    text: line.text.slice(caret),
    checkbox: !free && !soft,
    checked: false,
  };
  const out = lines.slice();
  out[index] = { ...line, text: line.text.slice(0, caret) };
  out.splice(index + 1, 0, next);
  return { lines: out, focus: { id: next.id, caret: 0 } };
}

// Backspace with the caret at the very start of a line. The first press
// takes the checkbox off — which is how you add a second line of detail
// to the task above, since the line then belongs to that block. Press it
// again and the line merges into the one above, as in any text field.
export function backspaceAtStart(lines: ChecklistLine[], index: number): EditResult | null {
  const line = lines[index];
  if (!line) return null;
  if (line.checkbox) {
    const out = lines.slice();
    out[index] = { ...line, checkbox: false, checked: false, checkedAt: undefined };
    return { lines: out, focus: { id: line.id, caret: 0 } };
  }
  if (index === 0) return null;
  const prev = lines[index - 1];
  const caret = prev.text.length;
  const out = lines.slice();
  out[index - 1] = { ...prev, text: prev.text + line.text };
  out.splice(index, 1);
  return { lines: out, focus: { id: prev.id, caret } };
}

// Delete with the caret at the very end of a line — the mirror image:
// first press pulls the following task into this block, second merges.
export function deleteAtEnd(lines: ChecklistLine[], index: number): EditResult | null {
  const line = lines[index];
  const next = lines[index + 1];
  if (!line || !next) return null;
  const out = lines.slice();
  if (next.checkbox) {
    out[index + 1] = { ...next, checkbox: false, checked: false, checkedAt: undefined };
    return { lines: out, focus: { id: line.id, caret: line.text.length } };
  }
  const caret = line.text.length;
  out[index] = { ...line, text: line.text + next.text };
  out.splice(index + 1, 1);
  return { lines: out, focus: { id: line.id, caret } };
}

// A pasted "- [x] thing" or "* thing" is almost always meant as a task,
// so recognise both rather than making the user retype the list they
// just copied out of somewhere else.
const PASTED_TASK = /^\s*(?:[-*+]\s*)?\[([ xX])\]\s?/;
const PASTED_BULLET = /^\s*[-*+]\s+/;

export function pasteIntoLine(
  lines: ChecklistLine[],
  index: number,
  start: number,
  end: number,
  text: string,
  nowMs: number
): EditResult | null {
  const line = lines[index];
  if (!line) return null;
  const free = classifyLines(lines)[index].kind === "free";
  const head = line.text.slice(0, start);
  const tail = line.text.slice(end);
  const pieces = text.replace(/\r\n?/g, "\n").split("\n");
  const [first, ...rest] = pieces;

  const out = lines.slice();
  if (rest.length === 0) {
    out[index] = { ...line, text: head + first + tail };
    return { lines: out, focus: { id: line.id, caret: head.length + first.length } };
  }

  out[index] = { ...line, text: head + first };
  const made: ChecklistLine[] = rest.map((piece, n) => {
    const isLast = n === rest.length - 1;
    let body = piece;
    // Each pasted line becomes its own task, matching what Enter does —
    // except in free text, and except for blank lines, which would
    // otherwise turn into a run of empty tasks.
    let checkbox = !free;
    let checked = false;
    const marked = PASTED_TASK.exec(piece);
    if (marked) {
      body = piece.slice(marked[0].length);
      checkbox = true;
      checked = marked[1].toLowerCase() === "x";
    } else if (piece.trim() === "") {
      checkbox = false;
    } else if (!free) {
      body = piece.replace(PASTED_BULLET, "");
    }
    return {
      id: newLineId(),
      text: isLast ? body + tail : body,
      checkbox,
      checked,
      checkedAt: checked ? nowMs : undefined,
    };
  });
  out.splice(index + 1, 0, ...made);

  const last = made[made.length - 1];
  return { lines: out, focus: { id: last.id, caret: Math.max(0, last.text.length - tail.length) } };
}
