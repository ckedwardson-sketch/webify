// Data shapes for the Checklist section. No React and no database in
// here on purpose — the editor, the storage layer and the lock-screen
// snapshot all import these, and none of them should drag the others in.

export interface ChecklistLine {
  id: string;
  text: string;
  // True on the line that STARTS a task. A task is the block running
  // from its checkbox line down to (but not including) the next
  // checkbox line, so a line without one is a continuation of the task
  // above it — that's what backspacing the checkbox away gives you.
  checkbox: boolean;
  // Only meaningful on a checkbox line.
  checked: boolean;
  // ms since epoch, stamped when `checked` last went true. The archive's
  // ordering and its date column are the only readers.
  checkedAt?: number;
}

export interface ArchivedItem {
  id: string;
  // The whole block as one string, its lines joined with "\n".
  text: string;
  checkedAt: number;
}

export interface ChecklistList {
  id: string;
  name: string;
  lines: ChecklistLine[];
  // Newest first. Only ever shown in archive mode.
  archive: ArchivedItem[];
}

export interface ChecklistState {
  lists: ChecklistList[];
  activeListId: string;
}

// See checklistFormat.ts for what each one actually looks like.
export type ArchiveDateFormat =
  | "numeric"
  | "numeric-hour"
  | "numeric-time"
  | "short"
  | "short-hour"
  | "short-time"
  | "short-year"
  | "short-year-time"
  | "weekday-time"
  | "iso";

// Anything above this many characters is treated as "no limit" by
// truncateTaskText — it's the top of the slider on the settings page.
export const TRUNCATE_OFF = 200;

export interface ChecklistSettings {
  // ---- Text -----------------------------------------------------------
  // Editor font size in px. This is the app side only; the lock screen
  // has its own size (lockscreen/lockScreenSettings.ts).
  textSize: number;
  // Characters a task is cut to *when shown somewhere other than the
  // editor* — the lock screen, the grid-view thumbnails. TRUNCATE_OFF
  // means don't cut.
  truncateChars: number;
  // Cut a task at its first line break instead, so a task written as
  // "Call the vet" + a few lines of detail shows only the first line.
  truncateOnBreak: boolean;

  // ---- Page function --------------------------------------------------
  // false: the top-bar button clears checked tasks outright.
  // true:  it moves them to an archive below the list instead.
  archiveMode: boolean;

  // ---- Archive mode (only reachable while archiveMode is on) ----------
  showDate: boolean;
  dateFormat: ArchiveDateFormat;

  // ---- Multiple lists -------------------------------------------------
  multiList: boolean;
}
