import { invoke } from "@tauri-apps/api/core";
import { rename, remove, exists } from "@tauri-apps/plugin-fs";
import { appDataDir, join } from "@tauri-apps/api/path";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { getDb, getSyncMeta, closeDb } from "./database";

// Whole-database, "newest revision wins" sync over the home LAN — see
// src-tauri/src/sync.rs for both the server side (computer only) and the
// sync_status/sync_download/sync_upload commands this calls into. The
// phone is always the one that initiates (tapping Sync Now in Settings),
// matching the "manual sync, computer just needs to be running" design:
// there's no background polling and no automatic per-row merging, just
// "whichever whole copy changed more recently replaces the other one".
//
// The actual file transfer happens entirely in native Rust, streaming
// straight to/from disk — a large db buffered through fetch().
// arrayBuffer() + writeFile() was hanging for minutes and sometimes
// getting the whole app OOM-killed on mobile with no catchable error.
const DB_FILE_NAME = "webify.db";
const INCOMING_FILE_NAME = "webify_incoming.db";
const BACKUP_FILE_NAME = "webify_backup_previous.db";

export type SyncDirection = "none" | "uploaded" | "downloaded";

export interface SyncOutcome {
  direction: SyncDirection;
  localRevision: number;
  remoteRevision: number;
}

interface RemoteStatus {
  device_id: string;
  revision: number;
  updated_at: string;
}

export async function syncWithComputer(computerIp: string): Promise<SyncOutcome> {
  const db = await getDb();
  const local = await getSyncMeta(db);

  const remote = await invoke<RemoteStatus>("sync_status", { computerIp });

  if (remote.revision === local.revision) {
    return { direction: "none", localRevision: local.revision, remoteRevision: remote.revision };
  }

  if (local.revision > remote.revision) {
    await invoke("sync_upload", { computerIp });
    return { direction: "uploaded", localRevision: local.revision, remoteRevision: remote.revision };
  }

  await invoke("sync_download", { computerIp });
  await installStagedSnapshot();
  return { direction: "downloaded", localRevision: local.revision, remoteRevision: remote.revision };
}

// Swaps whatever's staged at webify_incoming.db in for the live database:
// closes the open connection, keeps one rolling backup of the file it
// replaces (not an unbounded pile of them — disk space on this app's
// machines has already been a real problem once), then reloads the whole
// page so every query re-runs against the new data. Used both right after
// this device downloads a snapshot, and — via the "sync-db-received"
// event below — after this device's own Rust sync server receives an
// upload pushed from the other device.
export async function installStagedSnapshot(): Promise<void> {
  const dir = await appDataDir();
  const dbPath = await join(dir, DB_FILE_NAME);
  const backupPath = await join(dir, BACKUP_FILE_NAME);
  const stagingPath = await join(dir, INCOMING_FILE_NAME);

  await closeDb();

  if (await exists(backupPath)) {
    await remove(backupPath);
  }
  await rename(dbPath, backupPath);
  await rename(stagingPath, dbPath);

  window.location.reload();
}

// Only meaningful on the computer, where the Rust sync server can receive
// an upload at any time (the phone initiates sync, not the computer) —
// calling this on the phone is harmless, it just never fires.
export function listenForIncomingSync(): Promise<UnlistenFn> {
  return listen("sync-db-received", () => {
    void installStagedSnapshot();
  });
}
