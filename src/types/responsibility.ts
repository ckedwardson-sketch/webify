export type ResponsibilityCategory = "daily" | "weekly" | "yearly";

export interface DailySchedule {
  rangeStart: string; // "HH:MM", earliest acceptable time
  rangeEnd: string; // "HH:MM", latest acceptable time
  suggestedTime: string; // "HH:MM"
  alarms: string[]; // "HH:MM" times to remind at
}

export interface WeeklySchedule {
  frequency: "weekly" | "biweekly";
  // "OR" days — the task is satisfied by completing it on ANY one of
  // these. 0 = Sunday .. 6 = Saturday.
  allowedDays: number[];
}

export interface YearlySchedule {
  startMonth: number; // 1-12
  startDay: number; // 1-31
  endMonth: number;
  endDay: number;
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
    return { rangeStart: "08:00", rangeEnd: "20:00", suggestedTime: "09:00", alarms: [] };
  }
  if (category === "weekly") {
    return { frequency: "weekly", allowedDays: [1] };
  }
  return { startMonth: 1, startDay: 1, endMonth: 1, endDay: 7 };
}
