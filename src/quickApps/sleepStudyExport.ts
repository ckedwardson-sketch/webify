import { SleepLog, TestResult } from "../db/sleepStudy";
import { currentPhase, studyDayNumber, TEST_DEFS } from "./sleepStudy";

// Which fields to pull out of each test's score_json blob into their own
// CSV columns — matches exactly what quickApps/tests/*.tsx report via
// onComplete for that test key.
const CSV_FIELDS: Record<string, string[]> = {
  pvt: ["meanRt", "lapses", "falseStarts"],
  simple_rt: ["meanRt", "falseStarts"],
  digit_symbol: ["correct", "total", "seconds"],
  two_back: ["accuracy", "meanRt", "hits", "misses", "falseAlarms", "correctRejections"],
  stroop: ["meanRt", "errors"],
  short_term_memory: ["correct", "total", "exactMatch"],
  kss: ["rating"],
};

function escapeCsv(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function buildSleepStudyCsv(startDate: string | null, logs: SleepLog[], results: TestResult[]): string {
  const logsByDate = new Map(logs.map((l) => [l.studyDate, l]));
  const resultsByDate = new Map<string, Map<string, Record<string, unknown>>>();
  for (const r of results) {
    if (!resultsByDate.has(r.studyDate)) resultsByDate.set(r.studyDate, new Map());
    resultsByDate.get(r.studyDate)!.set(r.testKey, r.score);
  }

  const allDates = Array.from(new Set([...logsByDate.keys(), ...resultsByDate.keys()])).sort();

  const header = [
    "study_date",
    "day_number",
    "phase_hours",
    "bedtime",
    "wake_time",
    "sleep_latency_minutes",
    "awakenings_count",
    "awakenings_minutes",
    "sleep_quality",
    "sleepiness",
    "energy",
    "mood",
    ...TEST_DEFS.flatMap((t) => CSV_FIELDS[t.key].map((f) => `${t.key}_${f}`)),
  ];

  const rows = allDates.map((date) => {
    const log = logsByDate.get(date);
    const dayNumber = studyDayNumber(startDate, new Date(date + "T00:00:00"));
    const phase = dayNumber !== null ? currentPhase(dayNumber) : null;
    const testsForDate = resultsByDate.get(date);
    const testCells = TEST_DEFS.flatMap((t) => {
      const score = testsForDate?.get(t.key);
      return CSV_FIELDS[t.key].map((f) => (score ? escapeCsv(score[f]) : ""));
    });
    return [
      date,
      dayNumber ?? "",
      phase?.hours ?? "",
      escapeCsv(log?.bedtime),
      escapeCsv(log?.wakeTime),
      escapeCsv(log?.sleepLatencyMinutes),
      escapeCsv(log?.awakeningsCount),
      escapeCsv(log?.awakeningsMinutes),
      escapeCsv(log?.sleepQuality),
      escapeCsv(log?.sleepiness),
      escapeCsv(log?.energy),
      escapeCsv(log?.mood),
      ...testCells,
    ].join(",");
  });

  return [header.join(","), ...rows].join("\n");
}
