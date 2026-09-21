import { getDb } from "../db/database";

// Settings for the lock screen list (see lockScreenSync.ts). Stored as
// one JSON blob in the existing ui_preferences key/value table, so no
// schema change is needed. Like every other setting they travel with
// the database when it syncs; the background *image* does not — it's
// kept on the phone only (see LockScreenBridge.kt).
export interface LockScreenSettings {
  // Master switch. Off = the phone stops updating the lock screen
  // wallpaper (whatever is currently set stays until you change it).
  enabled: boolean;
  // Off = the task banner AND the task list disappear completely.
  showTasks: boolean;
  showResponsibilities: boolean;
  // The Checklist section's unticked tasks (checklist/checklistStorage).
  showChecklist: boolean;
  // Row text size in px on a 1080px-wide screen; other sizes scale.
  fontSize: number;
  textColor: string;
  // Secondary text: right-hand details, section headers, done rows.
  secondaryColor: string;
  // Solid background, used when no background image is set.
  bgColor: string;
  // 0-80 — black overlay on top of a background image, for legibility.
  bgDim: number;
  // Layout, as a percent of screen height measured from the top.
  // The task banner sits above the Samsung clock, the lists below it.
  bannerTop: number;
  listTop: number;
  listBottom: number;
}

export const LOCK_SCREEN_DEFAULTS: LockScreenSettings = {
  enabled: false,
  showTasks: true,
  showResponsibilities: true,
  showChecklist: true,
  fontSize: 40,
  textColor: "#ffffff",
  secondaryColor: "#b8c0cc",
  bgColor: "#101418",
  bgDim: 35,
  bannerTop: 5,
  listTop: 28,
  listBottom: 70,
};

const KEY = "lockscreen.settings";
const COLOR_RE = /^#[0-9a-fA-F]{6}$/;

function clamp(value: unknown, lo: number, hi: number, fallback: number): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(hi, Math.max(lo, Math.round(n)));
}

function color(value: unknown, fallback: string): string {
  return typeof value === "string" && COLOR_RE.test(value) ? value : fallback;
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

// Fills anything missing/invalid with the default and clamps ranges, so
// a hand-edited or older stored blob can never produce a broken layout.
export function normalizeLockScreenSettings(raw: Partial<Record<keyof LockScreenSettings, unknown>> | null): LockScreenSettings {
  const d = LOCK_SCREEN_DEFAULTS;
  const r = raw ?? {};
  const listTop = clamp(r.listTop, 5, 80, d.listTop);
  const listBottom = Math.max(listTop + 10, clamp(r.listBottom, 20, 98, d.listBottom));
  return {
    enabled: bool(r.enabled, d.enabled),
    showTasks: bool(r.showTasks, d.showTasks),
    showResponsibilities: bool(r.showResponsibilities, d.showResponsibilities),
    showChecklist: bool(r.showChecklist, d.showChecklist),
    fontSize: clamp(r.fontSize, 24, 64, d.fontSize),
    textColor: color(r.textColor, d.textColor),
    secondaryColor: color(r.secondaryColor, d.secondaryColor),
    bgColor: color(r.bgColor, d.bgColor),
    bgDim: clamp(r.bgDim, 0, 80, d.bgDim),
    bannerTop: clamp(r.bannerTop, 0, 30, d.bannerTop),
    listTop,
    listBottom: Math.min(98, listBottom),
  };
}

export async function fetchLockScreenSettings(): Promise<LockScreenSettings> {
  const db = await getDb();
  const rows = await db.select<{ value: string }[]>("SELECT value FROM ui_preferences WHERE key = $1", [KEY]);
  if (!rows[0]) return { ...LOCK_SCREEN_DEFAULTS };
  try {
    return normalizeLockScreenSettings(JSON.parse(rows[0].value));
  } catch {
    return { ...LOCK_SCREEN_DEFAULTS };
  }
}

export async function saveLockScreenSettings(settings: LockScreenSettings): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT INTO ui_preferences (key, value) VALUES ($1, $2)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [KEY, JSON.stringify(normalizeLockScreenSettings(settings))]
  );
}