import {
  Responsibility,
  ResponsibilityCompletion,
  DailySchedule,
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

  if (r.category === "daily") {
    const s = r.schedule as DailySchedule;
    if (!s.activeDays.includes(date.getDay())) return false; // not one of its active weekdays
  }

  const lead = r.pendingLeadTimeHours ?? 0;

  if (lead <= 0) {
    // Original "pending for the whole period" behavior.
    if (r.category === "daily") return true;
    if (r.category === "weekly") return true;
    return isWithinYearlyRange(r.schedule as YearlySchedule, date);
  }

  // Narrowed window: only pending starting `lead` hours before its next
  // due moment — still shown (as overdue) after that moment passes,
  // right up until it's actually completed.
  const nextMoment = getNextOccurrenceMoment(r, date);
  const windowStart = new Date(nextMoment.getTime() - lead * 3600 * 1000);
  return date >= windowStart;
}

function timeStringToDate(dateBase: Date, time: string): Date {
  const [h, m] = time.split(":").map(Number);
  const d = new Date(dateBase);
  d.setHours(h || 0, m || 0, 0, 0);
  return d;
}

// The next real moment (as a Date) this responsibility is "due" — the
// anchor point the pending lead-time counts back from. This is a
// practical approximation, not a perfectly precise scheduler: for
// weekly it uses the first allowed day of the current week, for
// yearly the start of this year's range, each combined with the
// earliest configured alarm time (or midnight if none).
export function getNextOccurrenceMoment(r: Responsibility, ref = new Date()): Date {
  if (r.category === "daily") {
    const s = r.schedule as DailySchedule;
    return timeStringToDate(ref, s.suggestedTime || "00:00");
  }

  if (r.category === "weekly") {
    const s = r.schedule as WeeklySchedule;
    const weekStart = new Date(startOfWeekISO(ref));
    const activeDays = s.allowedDays.length ? s.allowedDays : [1];
    // Monday-based ordering: treat Sunday (0) as day 7 so it sorts last.
    const firstDay = Math.min(...activeDays.map((d) => (d === 0 ? 7 : d)));
    const dueDate = new Date(weekStart);
    dueDate.setDate(dueDate.getDate() + (firstDay - 1));
    const time = s.alarms[0] || "00:00";
    return timeStringToDate(dueDate, time);
  }

  // yearly
  const s = r.schedule as YearlySchedule;
  const year = ref.getFullYear();
  const dueDate = new Date(year, s.startMonth - 1, s.startDay);
  const endDate = new Date(year, s.endMonth - 1, s.endDay);
  const wraps = s.startMonth > s.endMonth || (s.startMonth === s.endMonth && s.startDay > s.endDay);
  if (wraps) endDate.setFullYear(year + 1);
  if (ref > endDate) dueDate.setFullYear(year + 1); // this year's window already passed — anchor to next year

  let time = "00:00";
  if (s.alarm?.mode === "day" && s.alarm.dayTimes[0]) time = s.alarm.dayTimes[0];
  if (s.alarm?.mode === "week" && s.alarm.weekTimes[0]) time = s.alarm.weekTimes[0];
  return timeStringToDate(dueDate, time);
}

export function dailyCompletionPercent(
  daily: Responsibility[],
  completions: ResponsibilityCompletion[],
  date = new Date()
): number {
  const applicable = daily.filter((r) => (r.schedule as DailySchedule).activeDays.includes(date.getDay()));
  if (applicable.length === 0) return 100;
  const done = applicable.filter((r) => isCompletedForCurrentPeriod(r, completions, date)).length;
  return Math.round((done / applicable.length) * 100);
}

export function minutesFromTimeString(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

export const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
