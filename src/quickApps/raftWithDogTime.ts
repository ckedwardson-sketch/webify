// Week-cycle math for the "Raft With Dog, on big log" quick app. The
// cycle runs Tuesday 12:01am through the following Monday 11:59pm —
// deliberately offset from the calendar week (which scheduling.ts's
// startOfWeekISO/endOfWeekISO use) so week_start here always means
// "the Tuesday that opened this cycle."
import { todayISO } from "../responsibilities/scheduling";

const DAY_MS = 24 * 60 * 60 * 1000;

// The Tuesday (as an ISO date string) that opened the cycle containing
// `date`. Monday still belongs to the PRIOR cycle (its deadline day).
export function cycleWeekStartISO(date = new Date()): string {
  const day = date.getDay(); // 0=Sun..6=Sat
  const diffFromTuesday = (day + 5) % 7; // Tue=2 -> 0, Mon=1 -> 6
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - diffFromTuesday);
  return todayISO(d);
}

// The deadline moment (Monday 23:59:59.999) for the cycle that
// week_start (a Tuesday ISO date) opened.
export function cycleDeadline(weekStartISO: string): Date {
  const start = new Date(weekStartISO + "T00:00:00");
  start.setDate(start.getDate() + 6);
  start.setHours(23, 59, 59, 999);
  return start;
}

export function isWeekend(date = new Date()): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

export function isSaturday(date = new Date()): boolean {
  return date.getDay() === 6;
}

const EIGHTHS_GLYPH: Record<number, string> = {
  0: "",
  1: "⅛",
  2: "¼",
  3: "⅜",
  4: "½",
  5: "⅝",
  6: "¾",
  7: "⅞",
};

// Countdown to the deadline, expressed in days rounded to the nearest
// eighth (3-hour increments) — "1 day, 6 hours" reads as "1 ¼ days".
export function formatCountdown(msRemaining: number): string {
  if (msRemaining <= 0) return "Time's up";
  const totalHours = msRemaining / (60 * 60 * 1000);
  const roundedHours = Math.max(3, Math.round(totalHours / 3) * 3);
  const days = Math.floor(roundedHours / 24);
  const remHours = roundedHours - days * 24;
  const eighths = Math.round(remHours / 3) % 8;
  const glyph = EIGHTHS_GLYPH[eighths];

  if (days === 0) {
    return `${glyph || "⅛"} day left`;
  }
  const dayWord = days === 1 && !glyph ? "day" : "days";
  return glyph ? `${days} ${glyph} ${dayWord} left` : `${days} ${dayWord} left`;
}

export function msUntilDeadline(weekStartISO: string, now = new Date()): number {
  return cycleDeadline(weekStartISO).getTime() - now.getTime();
}

// Distinct cycle count between two ISO week_start dates (inclusive of
// both ends) — used for "% of weeks completed" stats.
export function cycleCountBetween(fromWeekStartISO: string, toWeekStartISO: string): number {
  const from = new Date(fromWeekStartISO + "T00:00:00").getTime();
  const to = new Date(toWeekStartISO + "T00:00:00").getTime();
  if (to < from) return 0;
  return Math.round((to - from) / (7 * DAY_MS)) + 1;
}
