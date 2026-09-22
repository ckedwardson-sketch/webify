import { invoke } from "@tauri-apps/api/core";
import {
  BackupSettings,
  fetchBackupSettings,
  isBackupDue,
  saveBackupSettings,
} from "./backupSettings";

// Thin JS wrappers around the Rust backup commands (src-tauri/src/backup.rs).
// Snapshots use the same VACUUM INTO path as LAN sync so the live DB is never
// locked out, and image stripping is done on the *copy* only.

export interface BackupInfo {
  /** Absolute path on disk. */
  path: string;
  /** File name only, e.g. webify-backup-2026-09-21T15-30-00.db */
  name: string;
  /** Bytes on disk. */
  sizeBytes: number;
  /** Modified time as ISO string (from the filesystem). */
  modifiedAt: string;
}

export interface BackupResult {
  path: string;
  sizeBytes: number;
}

/** One-off export: writes a .db into the system Downloads folder when possible. */
export async function exportDatabaseDownload(excludeImages: boolean): Promise<BackupResult> {
  return invoke<BackupResult>("export_database_download", { excludeImages });
}

/**
 * Create a rotated automatic-backup snapshot.
 * `customLocation` is BackupSettings.backupLocation — pass "" (or leave the
 * default) to use this device's app data folder.
 */
export async function createAutomaticBackup(
  excludeImages: boolean,
  maxBackups: number,
  customLocation: string = ""
): Promise<BackupResult> {
  return invoke<BackupResult>("create_automatic_backup", {
    excludeImages,
    maxBackups,
    customLocation: customLocation || null,
  });
}

export async function listAutomaticBackups(customLocation: string = ""): Promise<BackupInfo[]> {
  return invoke<BackupInfo[]>("list_automatic_backups", { customLocation: customLocation || null });
}

export async function deleteAutomaticBackup(path: string): Promise<void> {
  await invoke("delete_automatic_backup", { path });
}

/**
 * Opens a native folder picker (desktop: normal folder dialog; Android: the
 * system document-tree picker, with permission persisted so it survives an
 * app restart) and returns the chosen location string, or null if the user
 * cancelled. Save the result as BackupSettings.backupLocation.
 */
export async function pickBackupFolder(): Promise<string | null> {
  return invoke<string | null>("pick_backup_folder");
}

/** Human-readable form of a stored location, for display in the UI. */
export async function describeBackupLocation(location: string): Promise<string> {
  return invoke<string>("describe_backup_location", { location: location || null });
}

/**
 * If automatic backups are enabled and due, take one and stamp lastBackupAt.
 * Safe to call often (e.g. on app resume / settings load); no-ops when not due.
 */
export async function maybeRunAutomaticBackup(): Promise<BackupResult | null> {
  const settings = await fetchBackupSettings();
  if (!isBackupDue(settings)) return null;
  const result = await createAutomaticBackup(
    settings.excludeImages,
    settings.maxBackups,
    settings.backupLocation
  );
  const next: BackupSettings = {
    ...settings,
    lastBackupAt: new Date().toISOString(),
  };
  await saveBackupSettings(next);
  return result;
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}