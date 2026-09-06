// Schedule math for the Sleep Study quick app — a 42-day personal
// experiment (8h -> 7.5h -> 7h, two weeks each) with a daily test
// battery plus a few tests only every other day. No DB access here —
// this is pure date/schedule logic so the pane, the full study screen,
// and CSV export can all agree on "what's due today" from the same
// start date.
import { todayISO } from "../responsibilities/scheduling";

export const STUDY_LENGTH_DAYS = 42;

export interface StudyPhase {
  key: string;
  label: string;
  hours: number;
  startDay: number;
  endDay: number;
}

export const PHASES: StudyPhase[] = [
  { key: "8h", label: "8 hours", hours: 8, startDay: 1, endDay: 14 },
  { key: "7.5h", label: "7.5 hours", hours: 7.5, startDay: 15, endDay: 28 },
  { key: "7h", label: "7 hours", hours: 7, startDay: 29, endDay: 42 },
];

export type TestCategory = "daily" | "eod";

export interface TestDef {
  key: string;
  label: string;
  measures: string;
  category: TestCategory;
}

export const TEST_DEFS: TestDef[] = [
  { key: "pvt", label: "Psychomotor Vigilance Task", measures: "Reaction time, lapses, sustained attention", category: "daily" },
  { key: "simple_rt", label: "Simple Reaction Time", measures: "Basic response speed", category: "daily" },
  { key: "digit_symbol", label: "Digit-Symbol Substitution", measures: "Processing speed", category: "daily" },
  { key: "kss", label: "Karolinska Sleepiness Scale", measures: "Subjective sleepiness (1-9)", category: "daily" },
  // Mood/energy ratings deliberately aren't a separate test here — the
  // sleep log already has Mood and Energy sliders (see SleepStudyPage's
  // log form), so a standalone test would just duplicate them.
  { key: "two_back", label: "2-Back Task", measures: "Working memory", category: "eod" },
  { key: "stroop", label: "Stroop Test", measures: "Attention / inhibition", category: "eod" },
  { key: "short_term_memory", label: "Short-Term Memory", measures: "Immediate recall", category: "eod" },
];

export function testDef(key: string): TestDef | undefined {
  return TEST_DEFS.find((t) => t.key === key);
}

// 1-indexed day number within the study; <=0 means "not started yet",
// > STUDY_LENGTH_DAYS means "finished".
export function studyDayNumber(startDate: string | null, today = new Date()): number | null {
  if (!startDate) return null;
  const start = new Date(startDate + "T00:00:00").getTime();
  const cur = new Date(todayISO(today) + "T00:00:00").getTime();
  return Math.round((cur - start) / (24 * 60 * 60 * 1000)) + 1;
}

export function currentPhase(dayNumber: number): StudyPhase | null {
  return PHASES.find((p) => dayNumber >= p.startDay && dayNumber <= p.endDay) ?? null;
}

// Odd study-days run the every-other-day battery, starting on day 1 —
// an arbitrary but fixed choice so it's consistent week to week.
export function isEODDay(dayNumber: number): boolean {
  return dayNumber % 2 === 1;
}

export function dueTestKeys(dayNumber: number): string[] {
  const eod = isEODDay(dayNumber);
  return TEST_DEFS.filter((t) => t.category === "daily" || (t.category === "eod" && eod)).map((t) => t.key);
}

// Convenience defaults for a day's sleep log form, before anything's
// been saved — bedtime always starts at 12 (second-shift schedule), and
// the wake-time default follows whichever phase is active today (8am
// during the 8h phase, 7am during the 7.5h/7h phases). Just a starting
// point in the input — freely editable, never overwrites a saved value.
export function defaultLogTimes(startDate: string | null, today = new Date()): { bedtime: string; wakeTime: string } {
  const dayNumber = studyDayNumber(startDate, today);
  const phase = dayNumber !== null ? currentPhase(dayNumber) : null;
  return { bedtime: "12:00", wakeTime: phase?.hours === 8 ? "08:00" : "07:00" };
}

// The reminder pane's one-line status — what's still outstanding today,
// or a plain "all done" / not-started / finished message.
export function outstandingSummary(
  dayNumber: number | null,
  hasLog: boolean,
  completedTestKeys: Set<string>
): string {
  if (dayNumber === null) return "Set a start date to begin";
  if (dayNumber < 1) return "Study starts soon";
  if (dayNumber > STUDY_LENGTH_DAYS) return "Study complete";
  const missingTests = dueTestKeys(dayNumber).filter((k) => !completedTestKeys.has(k));
  const missing = (hasLog ? 0 : 1) + missingTests.length;
  if (missing === 0) return "All done for today";
  const parts: string[] = [];
  if (!hasLog) parts.push("sleep log");
  if (missingTests.length) parts.push(`${missingTests.length} test${missingTests.length === 1 ? "" : "s"}`);
  return `${parts.join(" + ")} still due today`;
}
