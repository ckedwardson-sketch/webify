import { getDb } from "./database";

// Automatic backup preferences live as one JSON blob in ui_preferences,
// same pattern as checklist.settings / lock-screen settings — no schema
// migration, travels with the database when it syncs.

export type BackupInterval = "6h" | "12h" | "daily" | "weekly";

export interface BackupSettings {
  /** When on, the app creates rotated snapshots on the interval below. */
  enabled: boolean;
  /** Strip image_data / photo blobs from the snapshot (much smaller). */
  excludeImages: boolean;
  /** How often a new backup is taken while the app is running. */
  interval: BackupInterval;
  /** How many completed backups to keep before the oldest is deleted. */
  maxBackups: number;
  /** ISO timestamp of the last successful automatic backup, or null. */
  lastBackupAt: string | null;
}

export const BACKUP_SETTINGS_DEFAULTS: BackupSettings = {
  enabled: false,
  excludeImages: true,
  interval: "daily",
  maxBackups: 7,
  lastBackupAt: null,
};

export const BACKUP_INTERVAL_OPTIONS: { value: BackupInterval; label: string; hours: number }[] = [
  { value: "6h", label: "Every 6 hours", hours: 6 },
  { value: "12h", label: "Every 12 hours", hours: 12 },
  { value: "daily", label: "Once a day", hours: 24 },
  { value: "weekly", label: "Once a week", hours: 24 * 7 },
];

const PREF_KEY = "backup.settings";

function clampInt(n: unknown, min: number, max: number, fallback: number): number {
  const v = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(v)) return fallback;
  return Math.min(max, Math.max(min, Math.round(v)));
}

export function normalizeBackupSettings(raw: unknown): BackupSettings {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const intervalRaw = o.interval;
  const interval: BackupInterval =
    intervalRaw === "6h" || intervalRaw === "12h" || intervalRaw === "daily" || intervalRaw === "weekly"
      ? intervalRaw
      : BACKUP_SETTINGS_DEFAULTS.interval;
  const last =
    typeof o.lastBackupAt === "string" && o.lastBackupAt.length > 0 ? o.lastBackupAt : null;
  return {
    enabled: o.enabled === true,
    excludeImages: o.excludeImages !== false, // default on
    interval,
    maxBackups: clampInt(o.maxBackups, 1, 30, BACKUP_SETTINGS_DEFAULTS.maxBackups),
    lastBackupAt: last,
  };
}

export async function fetchBackupSettings(): Promise<BackupSettings> {
  const db = await getDb();
  const rows = await db.select<{ value: string }[]>(
    "SELECT value FROM ui_preferences WHERE key = $1",
    [PREF_KEY]
  );
  if (!rows.length || !rows[0].value) return { ...BACKUP_SETTINGS_DEFAULTS };
  try {
    return normalizeBackupSettings(JSON.parse(rows[0].value));
  } catch {
    return { ...BACKUP_SETTINGS_DEFAULTS };
  }
}

export async function saveBackupSettings(settings: BackupSettings): Promise<void> {
  const normalized = normalizeBackupSettings(settings);
  const db = await getDb();
  await db.execute(
    `INSERT INTO ui_preferences (key, value) VALUES ($1, $2)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [PREF_KEY, JSON.stringify(normalized)]
  );
}

export function intervalHours(interval: BackupInterval): number {
  return BACKUP_INTERVAL_OPTIONS.find((o) => o.value === interval)?.hours ?? 24;
}

/** True when enabled and enough time has passed since lastBackupAt (or never backed up). */
export function isBackupDue(settings: BackupSettings, nowMs = Date.now()): boolean {
  if (!settings.enabled) return false;
  if (!settings.lastBackupAt) return true;
  const last = Date.parse(settings.lastBackupAt);
  if (!Number.isFinite(last)) return true;
  return nowMs - last >= intervalHours(settings.interval) * 60 * 60 * 1000;
}
