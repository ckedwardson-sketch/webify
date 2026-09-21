// Local database snapshots for the Data saving / transfer settings page.
// Same VACUUM INTO approach as sync.rs so the live plugin-sql connection
// is never blocked; optional image stripping runs only on the copy.

use std::fs;
use std::path::{Path, PathBuf};
use std::time::Duration;

use serde::Serialize;
use tauri::{AppHandle, Manager};

const DB_FILE_NAME: &str = "webify.db";
const BACKUPS_DIR_NAME: &str = "backups";

fn db_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    Ok(dir.join(DB_FILE_NAME))
}

fn backups_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let backups = dir.join(BACKUPS_DIR_NAME);
    fs::create_dir_all(&backups).map_err(|e| e.to_string())?;
    Ok(backups)
}

fn temp_dir_for(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_cache_dir().map_err(|e| e.to_string())?;
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

fn open_readonly(path: &Path) -> Result<rusqlite::Connection, String> {
    let conn = rusqlite::Connection::open_with_flags(
        path,
        rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY | rusqlite::OpenFlags::SQLITE_OPEN_NO_MUTEX,
    )
    .map_err(|e| e.to_string())?;
    let _ = conn.busy_timeout(Duration::from_secs(5));
    Ok(conn)
}

fn open_readwrite(path: &Path) -> Result<rusqlite::Connection, String> {
    let conn = rusqlite::Connection::open_with_flags(
        path,
        rusqlite::OpenFlags::SQLITE_OPEN_READ_WRITE | rusqlite::OpenFlags::SQLITE_OPEN_NO_MUTEX,
    )
    .map_err(|e| e.to_string())?;
    let _ = conn.busy_timeout(Duration::from_secs(5));
    Ok(conn)
}

fn vacuum_to_path(src: &Path, dest: &Path) -> Result<(), String> {
    if dest.exists() {
        fs::remove_file(dest).map_err(|e| e.to_string())?;
    }
    let conn = open_readonly(src)?;
    let dest_str = dest.to_string_lossy().replace('\'', "''");
    conn.execute_batch(&format!("VACUUM INTO '{}'", dest_str))
        .map_err(|e| e.to_string())
}

/// Null out known image / media columns on a *copy* of the database so the
/// snapshot stays small. Tables that don't exist yet are skipped.
fn strip_images(path: &Path) -> Result<(), String> {
    let conn = open_readwrite(path)?;
    // (table, column) pairs that hold base64 image / photo payloads.
    let targets: &[(&str, &str)] = &[
        ("recipes", "image_data"),
        ("projects", "image_data"),
        ("goals", "image_data"),
        ("responsibilities", "image_data"),
        ("dock_images", "image_data"),
        ("photos", "image_data"),
        ("icon_overrides", "image_data"),
        ("page_backgrounds", "image_data"),
        ("task_completion_images", "image_data"),
    ];
    for &(table, column) in targets {
        let exists: bool = conn
            .query_row(
                "SELECT 1 FROM sqlite_master WHERE type='table' AND name=?1",
                [table],
                |_| Ok(true),
            )
            .unwrap_or(false);
        if !exists {
            continue;
        }
        let sql = format!("UPDATE \"{}\" SET \"{}\" = NULL", table, column);
        let _ = conn.execute_batch(&sql);
    }
    // Compact after bulk nulls.
    let _ = conn.execute_batch("VACUUM");
    Ok(())
}

fn timestamp_slug() -> String {
    // Local-ish UTC stamp safe for filenames: 2026-09-21T15-30-00
    let secs = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    // Format without pulling in chrono — keep deps light.
    // Approximation is fine for sorting; OS mtime is the authoritative time in the UI.
    format!("{}", secs)
}

fn file_size(path: &Path) -> u64 {
    fs::metadata(path).map(|m| m.len()).unwrap_or(0)
}

fn modified_iso(path: &Path) -> String {
    match fs::metadata(path).and_then(|m| m.modified()) {
        Ok(t) => match t.duration_since(std::time::UNIX_EPOCH) {
            Ok(d) => {
                // Minimal ISO-ish UTC from unix secs (no chrono).
                let secs = d.as_secs();
                format!("{}000", secs) // JS Date can parse numeric; we also send path name
            }
            Err(_) => String::new(),
        },
        Err(_) => String::new(),
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupResult {
    pub path: String,
    pub size_bytes: u64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupInfo {
    pub path: String,
    pub name: String,
    pub size_bytes: u64,
    pub modified_at: String,
}

fn snapshot_into(app: &AppHandle, dest: &Path, exclude_images: bool) -> Result<BackupResult, String> {
    let src = db_path(app)?;
    if !src.exists() {
        return Err("Database file not found yet.".into());
    }
    // Stage in cache first so a half-written Downloads/backups file is never left behind.
    let staging = temp_dir_for(app)?.join(format!("webify_export_{}.db", timestamp_slug()));
    vacuum_to_path(&src, &staging)?;
    if exclude_images {
        strip_images(&staging)?;
    }
    if let Some(parent) = dest.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    if dest.exists() {
        fs::remove_file(dest).map_err(|e| e.to_string())?;
    }
    fs::rename(&staging, dest).or_else(|_| {
        // Cross-device rename can fail; fall back to copy + remove.
        fs::copy(&staging, dest).map_err(|e| e.to_string())?;
        fs::remove_file(&staging).map_err(|e| e.to_string())?;
        Ok(())
    })?;
    Ok(BackupResult {
        path: dest.to_string_lossy().to_string(),
        size_bytes: file_size(dest),
    })
}

/// Write a one-off .db into the system Downloads folder (or app data if
/// Downloads is unavailable — e.g. some Android builds).
#[tauri::command]
pub fn export_database_download(app: AppHandle, exclude_images: bool) -> Result<BackupResult, String> {
    let name = format!("webify-export-{}.db", timestamp_slug());
    let dest = match app.path().download_dir() {
        Ok(dir) => dir.join(&name),
        Err(_) => {
            let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
            let exports = dir.join("exports");
            fs::create_dir_all(&exports).map_err(|e| e.to_string())?;
            exports.join(&name)
        }
    };
    snapshot_into(&app, &dest, exclude_images)
}

/// Create a rotated backup under $APPDATA/backups/, then prune older ones.
#[tauri::command]
pub fn create_automatic_backup(
    app: AppHandle,
    exclude_images: bool,
    max_backups: u32,
) -> Result<BackupResult, String> {
    let dir = backups_dir(&app)?;
    let name = format!("webify-backup-{}.db", timestamp_slug());
    let dest = dir.join(&name);
    let result = snapshot_into(&app, &dest, exclude_images)?;
    prune_backups(&dir, max_backups.max(1))?;
    Ok(result)
}

fn prune_backups(dir: &Path, keep: u32) -> Result<(), String> {
    let mut entries: Vec<(PathBuf, std::time::SystemTime)> = Vec::new();
    for entry in fs::read_dir(dir).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        if path.extension().and_then(|e| e.to_str()) != Some("db") {
            continue;
        }
        let modified = entry
            .metadata()
            .and_then(|m| m.modified())
            .unwrap_or(std::time::UNIX_EPOCH);
        entries.push((path, modified));
    }
    entries.sort_by(|a, b| b.1.cmp(&a.1)); // newest first
    for (path, _) in entries.into_iter().skip(keep as usize) {
        let _ = fs::remove_file(path);
    }
    Ok(())
}

#[tauri::command]
pub fn list_automatic_backups(app: AppHandle) -> Result<Vec<BackupInfo>, String> {
    let dir = backups_dir(&app)?;
    let mut out: Vec<BackupInfo> = Vec::new();
    for entry in fs::read_dir(&dir).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        if path.extension().and_then(|e| e.to_str()) != Some("db") {
            continue;
        }
        let name = path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("backup.db")
            .to_string();
        let meta = entry.metadata().ok();
        let size = meta.as_ref().map(|m| m.len()).unwrap_or(0);
        let modified_at = meta
            .and_then(|m| m.modified().ok())
            .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
            .map(|d| {
                // ISO-8601-ish UTC from unix seconds (good enough for Date.parse).
                let s = d.as_secs();
                // YYYY-MM-DDTHH:MM:SSZ would need chrono; pass epoch ms as string.
                format!("{}", s * 1000)
            })
            .unwrap_or_default();
        out.push(BackupInfo {
            path: path.to_string_lossy().to_string(),
            name,
            size_bytes: size,
            modified_at,
        });
    }
    out.sort_by(|a, b| b.modified_at.cmp(&a.modified_at));
    Ok(out)
}

#[tauri::command]
pub fn delete_automatic_backup(path: String) -> Result<(), String> {
    let p = PathBuf::from(&path);
    // Only allow deleting files that live under a folder named "backups"
    // (guards against a bad path from a compromised UI).
    let is_backup = p
        .components()
        .any(|c| c.as_os_str().to_string_lossy() == BACKUPS_DIR_NAME);
    if !is_backup || p.extension().and_then(|e| e.to_str()) != Some("db") {
        return Err("Refusing to delete a file outside the backups folder.".into());
    }
    if p.exists() {
        fs::remove_file(&p).map_err(|e| e.to_string())?;
    }
    Ok(())
}
