import { getDb } from "../db/database";
import { getNative } from "./nativeBridge";
import { loadLockScreenPayload, LockPayload } from "./lockScreenSnapshot";

// Keeps the phone's lock screen in step with the database. Android
// only — on desktop getNative() is null and none of this does anything.
//
// Triggers: app start, any database write (debounced), the app going
// to/coming back from the background, and explicit calls from the
// settings page. A push whose content matches the previous one is
// skipped, so unrelated writes (layout tweaks, theme changes, ...)
// cost one cheap read and nothing else.

let started = false;
let timer: ReturnType<typeof setTimeout> | null = null;
let inFlight = false;
let rerun = false;
let lastSignature = "";
let lastResult = "";

// The first frame's `at` is "now", which changes every call — ignore
// it, or nothing would ever compare equal.
function signatureOf(payload: LockPayload): string {
  return JSON.stringify({
    settings: payload.settings,
    frames: payload.frames.map((f, i) => (i === 0 ? { ...f, at: 0 } : f)),
  });
}

export function requestLockScreenRefresh(delayMs = 2500): void {
  if (!getNative()) return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    void pushLockScreenNow();
  }, delayMs);
}

export async function pushLockScreenNow(force = false): Promise<string> {
  const native = getNative();
  if (!native) return "Lock screen updates only work in the Android app.";
  if (inFlight) {
    rerun = true;
    return "Update already running.";
  }
  inFlight = true;
  try {
    const payload = await loadLockScreenPayload();
    const signature = signatureOf(payload);
    if (!force && signature === lastSignature) return lastResult || "ok (unchanged)";
    const result = native.push(JSON.stringify(payload));
    lastSignature = signature;
    lastResult = result;
    return result;
  } catch (err) {
    return `error: ${err instanceof Error ? err.message : String(err)}`;
  } finally {
    inFlight = false;
    if (rerun) {
      rerun = false;
      requestLockScreenRefresh(300);
    }
  }
}

export async function startLockScreenSync(): Promise<void> {
  if (started || !getNative()) return;
  started = true;

  // Every write goes through this one connection, so wrapping execute()
  // catches all of them without touching each db/*.ts module.
  const db = await getDb();
  const originalExecute = db.execute.bind(db);
  db.execute = async (query, bindValues) => {
    const result = await originalExecute(query, bindValues);
    requestLockScreenRefresh();
    return result;
  };

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      // Leaving the app is the moment that matters — push right away.
      if (timer) clearTimeout(timer);
      timer = null;
      void pushLockScreenNow();
    } else {
      requestLockScreenRefresh(400);
    }
  });

  await pushLockScreenNow();
}
