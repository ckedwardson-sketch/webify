import { RaftDogWeek } from "../db/raftWithDog";
import { cycleWeekStartISO } from "./raftWithDogTime";

const DAY_MS = 24 * 60 * 60 * 1000;

// % of weeks with a completed task, over the trailing window ending at
// `now`'s cycle. `windowDays` null means "lifetime" — from the earliest
// recorded week through now. Returns null when there's no cycle in
// range yet (nothing to divide by).
export function completionPercent(
  weeks: RaftDogWeek[],
  windowDays: number | null,
  now = new Date()
): number | null {
  if (weeks.length === 0 && windowDays === null) return null;

  const currentCycle = cycleWeekStartISO(now);
  const periodStart =
    windowDays === null
      ? weeks.reduce((min, w) => (w.weekStart < min ? w.weekStart : min), currentCycle)
      : cycleWeekStartISO(new Date(now.getTime() - windowDays * DAY_MS));

  const start = new Date(periodStart + "T00:00:00").getTime();
  const end = new Date(currentCycle + "T00:00:00").getTime();
  const totalCycles = Math.max(1, Math.round((end - start) / (7 * DAY_MS)) + 1);

  const completedInRange = weeks.filter((w) => w.completed && w.weekStart >= periodStart).length;
  return Math.round((completedInRange / totalCycles) * 100);
}
