import { taskBlocks } from "./checklistLogic";
import {
  ArchiveDateFormat,
  ChecklistSettings,
  ChecklistState,
  TRUNCATE_OFF,
} from "./checklistTypes";

// How a checklist looks anywhere that isn't the editor: archive dates,
// truncated task text, and the rows handed to the lock screen.

const SAMPLE = new Date(2026, 2, 6, 20, 4); // Fri 6 March 2026, 8:04 PM

function time(d: Date): string {
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function hour(d: Date): string {
  return d.toLocaleTimeString([], { hour: "numeric" });
}

function numericDate(d: Date): string {
  return d.toLocaleDateString([], { month: "numeric", day: "numeric", year: "2-digit" });
}

function shortDate(d: Date): string {
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

function shortDateYear(d: Date): string {
  return d.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
}

function isoDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Takes the raw ms so the caller doesn't have to care that an archived
// item stores a timestamp rather than a formatted string — the format
// can be changed later and every old entry re-renders in the new one.
export function formatArchiveDate(checkedAt: number, format: ArchiveDateFormat): string {
  if (!Number.isFinite(checkedAt) || checkedAt <= 0) return "";
  const d = new Date(checkedAt);
  switch (format) {
    case "numeric":
      return numericDate(d);
    case "numeric-hour":
      return `${numericDate(d)} ${hour(d)}`;
    case "numeric-time":
      return `${numericDate(d)} ${time(d)}`;
    case "short":
      return shortDate(d);
    case "short-hour":
      return `${shortDate(d)} · ${hour(d)}`;
    case "short-time":
      return `${shortDate(d)} · ${time(d)}`;
    case "short-year":
      return shortDateYear(d);
    case "short-year-time":
      return `${shortDateYear(d)} · ${time(d)}`;
    case "weekday-time":
      return `${d.toLocaleDateString([], { weekday: "short" })} ${time(d)}`;
    case "iso":
      return isoDate(d);
    default:
      return shortDate(d);
  }
}

export interface ArchiveDateFormatOption {
  value: ArchiveDateFormat;
  // What the dropdown shows: a fixed sample date rendered in that
  // format, so picking one is a matter of reading it rather than
  // guessing what "short-year-time" means.
  sample: string;
}

export const ARCHIVE_DATE_FORMATS: ArchiveDateFormatOption[] = (
  [
    "numeric",
    "numeric-hour",
    "numeric-time",
    "short",
    "short-hour",
    "short-time",
    "short-year",
    "short-year-time",
    "weekday-time",
    "iso",
  ] as ArchiveDateFormat[]
).map((value) => ({ value, sample: formatArchiveDate(SAMPLE.getTime(), value) }));

// ---- Truncation -------------------------------------------------------

type TruncationSettings = Pick<ChecklistSettings, "truncateChars" | "truncateOnBreak">;

// Only ever applied *outside* the editor. Typing is never cut short;
// this is about what fits on a lock screen or a thumbnail.
export function truncateTaskText(text: string, settings: TruncationSettings): string {
  let out = text;
  if (settings.truncateOnBreak) {
    const breakAt = out.indexOf("\n");
    if (breakAt !== -1) out = `${out.slice(0, breakAt).replace(/\s+$/, "")}…`;
  } else {
    out = out.replace(/\s*\n\s*/g, " ");
  }
  const limit = settings.truncateChars;
  if (limit < TRUNCATE_OFF && out.length > limit) {
    // Prefer cutting at a word boundary, but not if that throws away
    // most of what we were allowed to show.
    const hard = out.slice(0, limit);
    const space = hard.lastIndexOf(" ");
    out = `${(space > limit * 0.6 ? hard.slice(0, space) : hard).replace(/\s+$/, "")}…`;
  }
  return out;
}

// ---- Lock screen ------------------------------------------------------

export interface ChecklistLockRow {
  name: string;
  // The list's name, when there's more than one list to tell apart.
  detail: string;
}

// The unticked tasks of the list you're currently on. Ticked ones are
// deliberately left off — the lock screen is a glance at what's left,
// not a record of what's done.
export function checklistLockRows(
  state: ChecklistState,
  settings: ChecklistSettings
): ChecklistLockRow[] {
  const list = state.lists.find((l) => l.id === state.activeListId) ?? state.lists[0];
  if (!list) return [];
  const detail = settings.multiList && state.lists.length > 1 ? list.name : "";
  return taskBlocks(list.lines)
    .filter((block) => !block.checked && block.text.trim() !== "")
    .map((block) => ({ name: truncateTaskText(block.text, settings), detail }));
}
