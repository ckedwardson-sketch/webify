// Cooldown for a board task linked to a skill (src/db/tasksBoard.ts) —
// 'daily'/'weekly' reset at the local calendar boundary, reusing the
// exact same boundary helpers Responsibilities already uses, so a
// "daily" skill task and a "daily" responsibility mean the same thing.
// 'hours' has no calendar boundary that makes sense, so it's a flat
// duration since the last completion instead.
import { todayISO, startOfWeekISO } from "../responsibilities/scheduling";
import { TaskCooldownType } from "../types/skill";

export interface TaskCooldownStatus {
  grayed: boolean;
  label: string | null;
}

export function taskCooldownStatus(
  lastCompletedAt: string | null,
  cooldown: { type: TaskCooldownType; hours: number } | null
): TaskCooldownStatus {
  if (!lastCompletedAt || !cooldown) return { grayed: false, label: null };
  const last = new Date(lastCompletedAt.replace(" ", "T") + "Z");

  if (cooldown.type === "daily") {
    if (todayISO() === todayISO(last)) return { grayed: true, label: "Available tomorrow" };
    return { grayed: false, label: null };
  }

  if (cooldown.type === "weekly") {
    if (startOfWeekISO() === startOfWeekISO(last)) return { grayed: true, label: "Available next week" };
    return { grayed: false, label: null };
  }

  // 'hours' — flat duration from the last completion.
  const availableAt = last.getTime() + cooldown.hours * 60 * 60 * 1000;
  if (Date.now() < availableAt) {
    const hoursLeft = Math.max(1, Math.ceil((availableAt - Date.now()) / (60 * 60 * 1000)));
    return { grayed: true, label: `Available in ${hoursLeft}h` };
  }
  return { grayed: false, label: null };
}
