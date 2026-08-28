export type ResponsibilityCategory = "daily" | "weekly" | "yearly";

export interface DailySchedule {
  rangeStart: string; // "HH:MM", earliest acceptable time
  rangeEnd: string; // "HH:MM", latest acceptable time
  suggestedTime: string; // "HH:MM"
  alarms: string[]; // "HH:MM" times to remind at
  // Which weekdays this daily task actually applies to — e.g. a
  // "daily" task that's really Monday-Friday only. 0 = Sun .. 6 = Sat.
  // Defaults to every day for anything created before this existed.
  activeDays: number[];
  // Optional — how long the task itself actually takes, once started.
  // When set, the "Today" timeline (ResponsibilitiesHomePage) anchors
  // its start marker to rangeEnd (the latest-acceptable/must-start-by
  // time) instead of suggestedTime, and — if this is at least 90
  // minutes — draws a line out to a second marker at rangeEnd +
  // taskTimeHours, so a task with real duration reads as a block of
  // time rather than a single instant. Undefined/0 means "no duration,"
  // the original single-marker-at-suggestedTime behavior.
  taskTimeHours?: number;
}

export interface WeeklySchedule {
  frequency: "weekly" | "biweekly";
  // "OR" days — the task is satisfied by completing it on ANY one of
  // these. 0 = Sunday .. 6 = Saturday.
  allowedDays: number[];
  alarms: string[]; // "HH:MM" times to remind at, on whichever allowed day is due
}

export type YearlyAlarmMode = "day" | "week" | "hours";

export interface YearlyAlarmConfig {
  mode: YearlyAlarmMode;
  dayTimes: string[]; // mode "day": fire at these times every day within the range
  weekDays: number[]; // mode "week": fire on these weekdays
  weekTimes: string[]; // mode "week": at these times, on those weekdays
  everyHours: number; // mode "hours": fire every N hours, e.g. 4
}

export interface YearlySchedule {
  startMonth: number; // 1-12
  startDay: number; // 1-31
  endMonth: number;
  endDay: number;
  // Optional recurring alarm while within the range. Null = no alarm.
  alarm: YearlyAlarmConfig | null;
}

export type ResponsibilitySchedule = DailySchedule | WeeklySchedule | YearlySchedule;

export interface Responsibility {
  id: number;
  name: string;
  description: string;
  consequences: string;
  reasoning: string;
  category: ResponsibilityCategory;
  icon: string;
  soundKey: string;
  schedule: ResponsibilitySchedule;
  sortOrder: number;
  // How many hours before its next due moment this should start
  // showing as pending. 0 (the default) means "show for the whole
  // period" — daily's whole day, weekly's whole week, yearly's whole
  // date range — matching the original behavior. Set higher to narrow
  // the window closer to the actual due moment.
  pendingLeadTimeHours: number;
  // Links this responsibility onto any number of goals' webs (see
  // GoalWebPage.tsx's "Link Responsibility" flow) so it shows up
  // alongside each goal's projects/tasks. Never required or automatic —
  // can be empty, or shared across multiple goals at once.
  goalIds: number[];
  createdAt?: string;
  updatedAt?: string;
}

export interface ResponsibilityCompletion {
  id: number;
  responsibilityId: number;
  occurrenceDate: string; // "YYYY-MM-DD"
  completedAt: string;
}

export function defaultScheduleFor(category: ResponsibilityCategory): ResponsibilitySchedule {
  if (category === "daily") {
    return {
      rangeStart: "08:00",
      rangeEnd: "20:00",
      suggestedTime: "09:00",
      alarms: [],
      activeDays: [0, 1, 2, 3, 4, 5, 6],
    };
  }
  if (category === "weekly") {
    return { frequency: "weekly", allowedDays: [1], alarms: [] };
  }
  return { startMonth: 1, startDay: 1, endMonth: 1, endDay: 7, alarm: null };
}

export function defaultYearlyAlarm(mode: YearlyAlarmMode): YearlyAlarmConfig {
  return { mode, dayTimes: [], weekDays: [1], weekTimes: [], everyHours: 4 };
}

// Fills in any fields missing from schedules created before they
// existed, so old responsibilities don't break the UI or silently lose
// their "every day" / "no lead time" behavior.
export function normalizeSchedule(
  category: ResponsibilityCategory,
  schedule: Partial<ResponsibilitySchedule>
): ResponsibilitySchedule {
  if (category === "daily") {
    const s = schedule as Partial<DailySchedule>;
    return {
      rangeStart: s.rangeStart ?? "08:00",
      rangeEnd: s.rangeEnd ?? "20:00",
      suggestedTime: s.suggestedTime ?? "09:00",
      alarms: s.alarms ?? [],
      activeDays: s.activeDays ?? [0, 1, 2, 3, 4, 5, 6],
      taskTimeHours: s.taskTimeHours,
    };
  }
  if (category === "weekly") {
    const s = schedule as Partial<WeeklySchedule>;
    return {
      frequency: s.frequency ?? "weekly",
      allowedDays: s.allowedDays ?? [1],
      alarms: s.alarms ?? [],
    };
  }
  const s = schedule as Partial<YearlySchedule>;
  return {
    startMonth: s.startMonth ?? 1,
    startDay: s.startDay ?? 1,
    endMonth: s.endMonth ?? 1,
    endDay: s.endDay ?? 7,
    alarm: s.alarm ?? null,
  };
}
