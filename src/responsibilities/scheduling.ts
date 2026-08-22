import {
  Responsibility,
  ResponsibilityCompletion,
  WeeklySchedule,
  YearlySchedule,
} from "../types/responsibility";

export function todayISO(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// Monday-based week. Returns the ISO date string for this week's Monday.
export function startOfWeekISO(date = new Date()): string {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun..6=Sat
  const diff = day === 0 ? -6 : 1 - day; // shift to Monday
  d.setDate(d.getDate() + diff);
  return todayISO(d);
}

export function endOfWeekISO(date = new Date()): string {
  const start = new Date(startOfWeekISO(date));
  start.setDate(start.getDate() + 6);
  return todayISO(start);
}

// ISO-ish week number, used only to alternate biweekly "on/off" weeks —
// doesn't need to be calendar-precise, just consistent week to week.
function weekNumber(date: Date): number {
  const oneJan = new Date(date.getFullYear(), 0, 1);
  const days = Math.floor((date.getTime() - oneJan.getTime()) / 86400000);
  return Math.ceil((days + oneJan.getDay() + 1) / 7);
}

export function isBiweeklyOnWeek(date = new Date()): boolean {
  return weekNumber(date) % 2 === 0;
}

export function isDueWeeklyToday(schedule: WeeklySchedule, date = new Date()): boolean {
  if (schedule.frequency === "biweekly" && !isBiweeklyOnWeek(date)) return false;
  return schedule.allowedDays.includes(date.getDay());
}

// Yearly ranges can wrap the new year (e.g. Dec 20 - Jan 5).
export function isWithinYearlyRange(schedule: YearlySchedule, date = new Date()): boolean {
  const m = date.getMonth() + 1;
  const d = date.getDate();
  const cur = m * 100 + d;
  const start = schedule.startMonth * 100 + schedule.startDay;
  const end = schedule.endMonth * 100 + schedule.endDay;
  if (start <= end) return cur >= start && cur <= end;
  return cur >= start || cur <= end; // wraps year boundary
}

function completionsFor(
  responsibilityId: number,
  completions: ResponsibilityCompletion[]
): ResponsibilityCompletion[] {
  return completions.filter((c) => c.responsibilityId === responsibilityId);
}

// Has this responsibility already been satisfied for its CURRENT period
// (today for daily, this week for weekly, this year's window for yearly)?
export function isCompletedForCurrentPeriod(
  r: Responsibility,
  completions: ResponsibilityCompletion[],
  date = new Date()
): boolean {
  const mine = completionsFor(r.id, completions);
  if (mine.length === 0) return false;

  if (r.category === "daily") {
    return mine.some((c) => c.occurrenceDate === todayISO(date));
  }
  if (r.category === "weekly") {
    const start = startOfWeekISO(date);
    const end = endOfWeekISO(date);
    return mine.some((c) => c.occurrenceDate >= start && c.occurrenceDate <= end);
  }
  // yearly — anything completed within this calendar year counts as
  // satisfying this year's window (simpler than reconstructing the
  // exact wrapped-range boundaries as ISO strings).
  const year = String(date.getFullYear());
  return mine.some((c) => c.occurrenceDate.startsWith(year));
}

// Should this show up as an outstanding/pending task right now?
export function isPendingNow(
  r: Responsibility,
  completions: ResponsibilityCompletion[],
  date = new Date()
): boolean {
  if (isCompletedForCurrentPeriod(r, completions, date)) return false;

  if (r.category === "daily") return true; // every day is a fresh occurrence
  if (r.category === "weekly") return true; // pending all week until done
  return isWithinYearlyRange(r.schedule as YearlySchedule, date);
}

export function dailyCompletionPercent(
  daily: Responsibility[],
  completions: ResponsibilityCompletion[],
  date = new Date()
): number {
  if (daily.length === 0) return 100;
  const done = daily.filter((r) => isCompletedForCurrentPeriod(r, completions, date)).length;
  return Math.round((done / daily.length) * 100);
}

export function minutesFromTimeString(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

export const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
