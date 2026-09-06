// Device/time-based theme switching. A schedule is a small JSON array
// naming which saved theme preset (see db/themePresets.ts) should be
// active starting at each hour of the day — e.g. a dark preset from
// 20:00 and a bright one from 07:00. Stored as a single JSON string in
// ThemeSettings.timeBasedThemeSchedule (AdvancedThemeSettings) so it
// rides the same override/export plumbing as every other theme field,
// without needing a new DB table.
export interface TimeBasedThemeEntry {
  // 0-23. The preset applies from this hour (local time) until the
  // next entry's startHour (wrapping around midnight).
  startHour: number;
  // Matched against db/themePresets.ts's ThemePresetRow.name.
  presetName: string;
}

export function parseTimeBasedThemeSchedule(json: string): TimeBasedThemeEntry[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed)) return [];
    const entries: TimeBasedThemeEntry[] = [];
    for (const raw of parsed) {
      if (!raw || typeof raw !== "object") continue;
      const startHour = Number((raw as { startHour?: unknown }).startHour);
      const presetName = (raw as { presetName?: unknown }).presetName;
      if (!Number.isFinite(startHour) || typeof presetName !== "string" || !presetName) continue;
      entries.push({ startHour: Math.min(23, Math.max(0, Math.round(startHour))), presetName });
    }
    return entries.sort((a, b) => a.startHour - b.startHour);
  } catch {
    return [];
  }
}

// Finds whichever entry is "active" at the given hour: the latest
// entry whose startHour is <= hour, or (if the current hour is before
// every entry's startHour) the last entry — since its window wraps
// past midnight into the next day.
export function activeScheduleEntry(entries: TimeBasedThemeEntry[], hour: number): TimeBasedThemeEntry | null {
  if (entries.length === 0) return null;
  let active = entries[entries.length - 1];
  for (const entry of entries) {
    if (entry.startHour <= hour) active = entry;
  }
  return active;
}
