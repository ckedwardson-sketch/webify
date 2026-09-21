import { getDb } from "../db/database";
import { PROGRESS_COLUMNS, mapProgressRow, RawProgressRow } from "../db/progress";
import { fetchResponsibilities, fetchAllCompletions } from "../db/responsibilities";
import {
  endOfWeekISO,
  getNextOccurrenceMoment,
  isCompletedForCurrentPeriod,
  isPendingNow,
  startOfWeekISO,
  todayISO,
} from "../responsibilities/scheduling";
import { Responsibility, ResponsibilityCompletion } from "../types/responsibility";
import { fetchLockScreenSettings, LockScreenSettings } from "./lockScreenSettings";

// Builds what the phone draws onto the lock screen wallpaper.
//
// The wallpaper has to keep being right while the app is closed —
// tasks cross their 50%/80% marks, days roll over, responsibilities
// reach their lead-time window — so this doesn't produce one snapshot,
// it produces a short *timeline* of frames covering the next 48 hours.
// The native side (LockScreenController.kt) draws whichever frame is
// current and sets an alarm for the next one. All of the "what's
// pending / what's overdue" logic stays here in TypeScript, using the
// same functions the app itself uses, so there is no second copy of
// the scheduling rules in Kotlin.

const DAY = 86_400_000;
const HOUR = 3_600_000;
const HORIZON_MS = 48 * HOUR;
// Frames are stamped a second *after* the moment they describe, so
// strict comparisons (> 50%, > 80%, floor/ceil of day counts) are
// unambiguous at the boundary.
const EPS_MS = 1000;

export type LockStatus = "green" | "yellow" | "red";

export interface TimedTask {
  id: number;
  name: string;
  addedMs: number;
  goalDays: number;
}

export interface LockTaskRow {
  name: string;
  detail: string;
  status: LockStatus;
}

export interface LockRespRow {
  name: string;
  detail: string;
  done: boolean;
}

// status/banner are "" (never null) when there's no task banner —
// org.json on Android turns a JSON null into the string "null".
export interface LockFrame {
  at: number;
  status: LockStatus | "";
  banner: string;
  tasks: LockTaskRow[];
  responsibilities: LockRespRow[];
}

export interface LockPayload {
  version: 1;
  generatedAt: number;
  settings: LockScreenSettings;
  frames: LockFrame[];
}

export interface SnapshotInput {
  tasks: TimedTask[];
  responsibilities: Responsibility[];
  completions: ResponsibilityCompletion[];
  settings: LockScreenSettings;
  nowMs: number;
}

// ---- Tasks -----------------------------------------------------------

function parseUtc(sqliteTimestamp: string): number {
  return new Date(sqliteTimestamp.replace(" ", "T") + "Z").getTime();
}

function percentElapsed(t: TimedTask, at: number): number {
  return ((at - t.addedMs) / (t.goalDays * DAY)) * 100;
}

// green: under 50% of the time used. yellow: over 50%. red: over 80%
// (including anything already past its due date).
function statusFor(percent: number): LockStatus {
  if (percent > 80) return "red";
  if (percent > 50) return "yellow";
  return "green";
}

// Whole days, on purpose: "1d in · 2d left". Under a day left it says
// "<1d left"; past the due date it counts days overdue.
function taskDetail(t: TimedTask, at: number): string {
  const elapsedDays = (at - t.addedMs) / DAY;
  if (elapsedDays > t.goalDays) {
    const overdue = Math.floor(elapsedDays - t.goalDays);
    return overdue < 1 ? "overdue" : `overdue ${overdue}d`;
  }
  const remaining = t.goalDays - elapsedDays;
  const left = remaining < 1 ? "<1d" : `${Math.ceil(remaining)}d`;
  return `${Math.max(0, Math.floor(elapsedDays))}d in · ${left} left`;
}

function bannerText(rows: LockTaskRow[]): string {
  const n = rows.length;
  const base = `${n} task${n === 1 ? "" : "s"}`;
  const red = rows.filter((r) => r.status === "red").length;
  if (red > 0) return `${base} · ${red} past 80%`;
  const yellow = rows.filter((r) => r.status === "yellow").length;
  if (yellow > 0) return `${base} · ${yellow} past 50%`;
  return `${base} · on track`;
}

// ---- Responsibilities ------------------------------------------------

function currentPeriodCompletion(
  r: Responsibility,
  completions: ResponsibilityCompletion[],
  date: Date
): ResponsibilityCompletion | null {
  const mine = completions.filter((c) => c.responsibilityId === r.id);
  let inPeriod: ResponsibilityCompletion[];
  if (r.category === "daily") {
    const today = todayISO(date);
    inPeriod = mine.filter((c) => c.occurrenceDate === today);
  } else if (r.category === "weekly") {
    const start = startOfWeekISO(date);
    const end = endOfWeekISO(date);
    inPeriod = mine.filter((c) => c.occurrenceDate >= start && c.occurrenceDate <= end);
  } else {
    const year = String(date.getFullYear());
    inPeriod = mine.filter((c) => c.occurrenceDate.startsWith(year));
  }
  if (inPeriod.length === 0) return null;
  return inPeriod.reduce((a, b) => (a.completedAt >= b.completedAt ? a : b));
}

// "8:14 AM" if it was today, "Tue 8:14 AM" within the last week,
// otherwise "Mar 3".
function formatCompletion(completedMs: number, at: number): string {
  if (!Number.isFinite(completedMs)) return "done";
  const done = new Date(completedMs);
  const ref = new Date(at);
  const time = done.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  if (todayISO(done) === todayISO(ref)) return time;
  if ((at - completedMs) / DAY < 6) {
    return `${done.toLocaleDateString([], { weekday: "short" })} ${time}`;
  }
  return done.toLocaleDateString([], { month: "short", day: "numeric" });
}

// ---- Frames ----------------------------------------------------------

function buildFrame(input: SnapshotInput, at: number): LockFrame {
  const date = new Date(at);
  const { settings } = input;

  const taskRows: LockTaskRow[] = settings.showTasks
    ? input.tasks
        .map((t) => ({ t, pct: percentElapsed(t, at) }))
        // Most urgent (highest % of time used) first.
        .sort((a, b) => b.pct - a.pct)
        .map(({ t, pct }) => ({ name: t.name, detail: taskDetail(t, at), status: statusFor(pct) }))
    : [];

  const respRows: LockRespRow[] = settings.showResponsibilities
    ? input.responsibilities
        // Same rule as "Current Tasks" on the Responsibilities page.
        .filter((r) => isPendingNow(r, input.completions, date) || isCompletedForCurrentPeriod(r, input.completions, date))
        .map((r) => {
          const done = isCompletedForCurrentPeriod(r, input.completions, date);
          const completion = done ? currentPeriodCompletion(r, input.completions, date) : null;
          return {
            name: r.name,
            done,
            detail: done ? (completion ? formatCompletion(parseUtc(completion.completedAt), at) : "done") : "",
          };
        })
    : [];

  const overall: LockStatus | "" =
    taskRows.length === 0
      ? ""
      : taskRows.some((r) => r.status === "red")
        ? "red"
        : taskRows.some((r) => r.status === "yellow")
          ? "yellow"
          : "green";

  return {
    at,
    status: overall,
    banner: taskRows.length > 0 ? bannerText(taskRows) : "",
    tasks: taskRows,
    responsibilities: respRows,
  };
}

// Every moment in the next 48h at which what's on screen can change.
function collectMoments(input: SnapshotInput, endMs: number): number[] {
  const moments = new Set<number>();
  const add = (t: number) => {
    if (t > input.nowMs && t <= endMs) moments.add(Math.round(t));
  };

  // Local midnights: daily/weekly/yearly periods roll over.
  const midnight = new Date(input.nowMs);
  midnight.setHours(24, 0, 0, 0);
  while (midnight.getTime() <= endMs) {
    add(midnight.getTime() + EPS_MS);
    midnight.setDate(midnight.getDate() + 1);
    midnight.setHours(0, 0, 0, 0);
  }

  for (const t of input.tasks) {
    const goalMs = t.goalDays * DAY;
    const dueMs = t.addedMs + goalMs;
    // The whole-day counters tick every 24h from when the task was
    // added, and (for a goal that isn't a whole number of days) every
    // 24h counting back from the due date.
    const k0 = Math.max(0, Math.floor((input.nowMs - t.addedMs) / DAY));
    for (let k = k0; t.addedMs + k * DAY <= endMs; k++) add(t.addedMs + k * DAY + EPS_MS);
    for (let j = 0; j <= Math.ceil(t.goalDays) + 1; j++) add(dueMs - j * DAY + EPS_MS);
    // The "days overdue" counter, ticking on from the due date.
    const o0 = Math.max(0, Math.floor((input.nowMs - dueMs) / DAY));
    for (let j = o0; dueMs + j * DAY <= endMs; j++) add(dueMs + j * DAY + EPS_MS);
    // Colour thresholds.
    add(t.addedMs + 0.5 * goalMs + EPS_MS);
    add(t.addedMs + 0.8 * goalMs + EPS_MS);
    add(dueMs + EPS_MS);
  }

  // A responsibility with a pending lead time only starts showing that
  // many hours before its due moment.
  for (const r of input.responsibilities) {
    const lead = r.pendingLeadTimeHours ?? 0;
    if (lead <= 0) continue;
    for (let offset = 0; offset <= 2; offset++) {
      const moment = getNextOccurrenceMoment(r, new Date(input.nowMs + offset * DAY));
      if (moment) add(moment.getTime() - lead * HOUR + EPS_MS);
    }
  }

  return [...moments].sort((a, b) => a - b);
}

function frameContentKey(frame: LockFrame): string {
  return JSON.stringify({ s: frame.status, b: frame.banner, t: frame.tasks, r: frame.responsibilities });
}

export function buildLockScreenPayload(input: SnapshotInput): LockPayload {
  const frames: LockFrame[] = [buildFrame(input, input.nowMs)];
  let lastKey = frameContentKey(frames[0]);

  for (const at of collectMoments(input, input.nowMs + HORIZON_MS)) {
    const frame = buildFrame(input, at);
    const key = frameContentKey(frame);
    if (key === lastKey) continue; // nothing visible changed at this moment
    frames.push(frame);
    lastKey = key;
  }

  return { version: 1, generatedAt: input.nowMs, settings: input.settings, frames };
}

// ---- Loading from the database --------------------------------------

// Read-only on purpose. fetchBoardTasks() in db/tasksBoard.ts also runs
// an UPDATE (the missed-count bump), which would count as a database
// write and trigger another refresh — an endless loop.
async function fetchTimedBoardTasks(): Promise<TimedTask[]> {
  const db = await getDb();
  const rows = await db.select<RawProgressRow[]>(
    `SELECT ${PROGRESS_COLUMNS} FROM progress_nodes
     WHERE task_board_status = 'board' AND is_complete = 0
     ORDER BY task_added_at IS NULL, task_added_at, id`
  );
  const tasks: TimedTask[] = [];
  for (const node of rows.map(mapProgressRow)) {
    if (!node.taskAddedAt || !node.taskGoalDays || node.taskGoalDays <= 0) continue;
    const addedMs = parseUtc(node.taskAddedAt);
    if (!Number.isFinite(addedMs)) continue;
    tasks.push({
      id: node.id,
      name: node.shortDescription || "(untitled task)",
      addedMs,
      goalDays: node.taskGoalDays,
    });
  }
  return tasks;
}

export async function loadLockScreenPayload(nowMs = Date.now()): Promise<LockPayload> {
  const settings = await fetchLockScreenSettings();
  if (!settings.enabled) {
    // Nothing to draw — one empty frame is enough for the phone to
    // notice it has been switched off and stop its alarms.
    return buildLockScreenPayload({ tasks: [], responsibilities: [], completions: [], settings, nowMs });
  }
  const [tasks, responsibilities, completions] = await Promise.all([
    settings.showTasks ? fetchTimedBoardTasks() : Promise.resolve([] as TimedTask[]),
    settings.showResponsibilities ? fetchResponsibilities() : Promise.resolve([] as Responsibility[]),
    settings.showResponsibilities ? fetchAllCompletions() : Promise.resolve([] as ResponsibilityCompletion[]),
  ]);
  return buildLockScreenPayload({ tasks, responsibilities, completions, settings, nowMs });
}
