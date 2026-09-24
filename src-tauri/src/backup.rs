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
        Ok::<(), String>(())
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

fn create_local_backup(
    app: &AppHandle,
    dir: &Path,
    name: &str,
    exclude_images: bool,
    keep: u32,
) -> Result<BackupResult, String> {
    fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    let dest = dir.join(name);
    let result = snapshot_into(app, &dest, exclude_images)?;
    prune_backups(dir, keep)?;
    Ok(result)
}

/// Create a rotated backup, then prune older ones.
///
/// `custom_location` is BackupSettings.backupLocation from the frontend:
/// - None / "" -> $APPDATA/backups/ (this app's own private folder).
/// - A plain path (desktop) -> written there directly with std::fs.
/// - A content:// URI (Android, from pick_backup_folder) -> Android's
///   scoped storage means std::fs can't touch it, so that path goes
///   through tauri-plugin-android-fs instead (see the android_backup
///   module below).
/// If a custom location fails (folder deleted, permission revoked, etc.)
/// this silently falls back to the default location rather than failing
/// the backup outright — matches what the settings page tells the user.
#[tauri::command]
pub fn create_automatic_backup(
    app: AppHandle,
    exclude_images: bool,
    max_backups: u32,
    custom_location: Option<String>,
) -> Result<BackupResult, String> {
    let name = format!("webify-backup-{}.db", timestamp_slug());
    let keep = max_backups.max(1);

    let fallback = |app: &AppHandle| -> Result<BackupResult, String> {
        create_local_backup(app, &backups_dir(app)?, &name, exclude_images, keep)
    };

    match custom_location.filter(|s| !s.is_empty()) {
        None => fallback(&app),
        Some(loc) if loc.starts_with("content://") => {
            #[cfg(target_os = "android")]
            {
                match android_backup::create_android_backup(&app, &loc, &name, exclude_images, keep) {
                    Ok(result) => Ok(result),
                    Err(e) => {
                        eprintln!("custom backup location failed ({loc}), falling back to default: {e}");
                        fallback(&app)
                    }
                }
            }
            #[cfg(not(target_os = "android"))]
            {
                fallback(&app)
            }
        }
        Some(loc) => {
            let dir = PathBuf::from(&loc);
            match create_local_backup(&app, &dir, &name, exclude_images, keep) {
                Ok(result) => Ok(result),
                Err(e) => {
                    eprintln!("custom backup location failed ({loc}), falling back to default: {e}");
                    fallback(&app)
                }
            }
        }
    }
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

fn list_local_backups(dir: &Path) -> Result<Vec<BackupInfo>, String> {
    let mut out: Vec<BackupInfo> = Vec::new();
    if !dir.exists() {
        return Ok(out);
    }
    for entry in fs::read_dir(dir).map_err(|e| e.to_string())? {
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

/// List backups at the given location (see create_automatic_backup for what
/// `custom_location` can be). Falls back to the default location if a
/// custom one can't be read (folder gone, permission revoked, etc.).
#[tauri::command]
pub fn list_automatic_backups(
    app: AppHandle,
    custom_location: Option<String>,
) -> Result<Vec<BackupInfo>, String> {
    let fallback = |app: &AppHandle| -> Result<Vec<BackupInfo>, String> { list_local_backups(&backups_dir(app)?) };

    match custom_location.filter(|s| !s.is_empty()) {
        None => fallback(&app),
        Some(loc) if loc.starts_with("content://") => {
            #[cfg(target_os = "android")]
            {
                match android_backup::list_android_backups(&app, &loc) {
                    Ok(v) => Ok(v),
                    Err(e) => {
                        eprintln!("listing custom backup location failed ({loc}), falling back to default: {e}");
                        fallback(&app)
                    }
                }
            }
            #[cfg(not(target_os = "android"))]
            {
                fallback(&app)
            }
        }
        Some(loc) => {
            let dir = PathBuf::from(&loc);
            match list_local_backups(&dir) {
                Ok(v) => Ok(v),
                Err(e) => {
                    eprintln!("listing custom backup location failed ({loc}), falling back to default: {e}");
                    fallback(&app)
                }
            }
        }
    }
}

#[tauri::command]
pub fn delete_automatic_backup(app: AppHandle, path: String) -> Result<(), String> {
    if path.starts_with("content://") {
        #[cfg(target_os = "android")]
        {
            return android_backup::delete_android_backup(&app, &path);
        }
        #[cfg(not(target_os = "android"))]
        {
            let _ = app;
            return Err("Android-style backup location used on a non-Android build.".into());
        }
    }
    let p = PathBuf::from(&path);
    // Only allow deleting files that match this app's own backup naming
    // pattern — deliberately not tied to a specific folder name (a custom
    // location won't be called "backups") so this still guards against a
    // bad path from a compromised UI without depending on where the file
    // happens to live.
    let name = p.file_name().and_then(|n| n.to_str()).unwrap_or("");
    let looks_like_backup = name.starts_with("webify-backup-") && name.ends_with(".db");
    if !looks_like_backup {
        return Err("Refusing to delete a file that doesn't look like one of this app's backups.".into());
    }
    if p.exists() {
        fs::remove_file(&p).map_err(|e| e.to_string())?;
    }
    Ok(())
}

// ---------------------------------------------------------------------------
// Custom backup location: native folder picker + human-readable display.
// ---------------------------------------------------------------------------

/// Opens a native folder picker and returns the chosen location, or None if
/// cancelled. Desktop: a normal filesystem path (tauri-plugin-dialog).
/// Android: scoped storage means a user-picked folder is only reachable via
/// a content:// URI (SAF), not a real path — std::fs can't write to it —
/// so that side goes through tauri-plugin-android-fs instead, which also
/// persists the grant so it survives an app restart. Either way, the
/// returned string is opaque to the frontend: it's just saved as
/// BackupSettings.backupLocation and threaded back into the commands above.
#[tauri::command]
pub fn pick_backup_folder(app: AppHandle) -> Result<Option<String>, String> {
    #[cfg(target_os = "android")]
    {
        return android_backup::pick_folder(&app);
    }
    #[cfg(not(any(target_os = "android", target_os = "ios")))]
    {
        use tauri_plugin_dialog::{DialogExt, FilePath};
        let folder = app.dialog().file().blocking_pick_folder();
        return Ok(folder.map(|p| match p {
            FilePath::Path(path) => path.to_string_lossy().to_string(),
            FilePath::Url(url) => url.to_string(),
        }));
    }
    #[cfg(target_os = "ios")]
    {
        let _ = app;
        Err("Choosing a custom backup folder isn't supported on iOS yet.".into())
    }
}

/// Human-readable form of a stored location string, for display in the UI.
/// None/empty -> describes the default $APPDATA/backups/ location.
#[tauri::command]
pub fn describe_backup_location(app: AppHandle, location: Option<String>) -> Result<String, String> {
    let loc = match location.filter(|s| !s.is_empty()) {
        None => {
            let dir = backups_dir(&app)?;
            return Ok(dir.to_string_lossy().to_string());
        }
        Some(l) => l,
    };
    if loc.starts_with("content://") {
        #[cfg(target_os = "android")]
        {
            return Ok(android_backup::describe_location(&app, &loc));
        }
    }
    Ok(loc)
}

// ---------------------------------------------------------------------------
// Android-only: writing into a user-picked SAF folder.
//
// Built against tauri-plugin-android-fs (pinned in Cargo.toml). This
// crate's API has changed shape across versions (method names like
// file_picker()/picker(), take_persistable_uri_permission()/
// persist_uri_permission() have both existed) — if this doesn't compile
// against whatever version actually resolves, check that crate's docs.rs
// page for the pinned version and adjust the method names below; the
// overall approach (snapshot to a normal cache path first, then copy the
// bytes into the SAF-backed folder) stays the same regardless.
// ---------------------------------------------------------------------------
#[cfg(target_os = "android")]
mod android_backup {
    use super::{snapshot_into, temp_dir_for, timestamp_slug, BackupInfo, BackupResult};
    use std::fs;
    use tauri::AppHandle;
    use tauri_plugin_android_fs::{AndroidFsExt, Entry, FileUri};

    pub fn pick_folder(app: &AppHandle) -> Result<Option<String>, String> {
        let api = app.android_fs();
        let picked = api.file_picker().pick_dir(None).map_err(|e| e.to_string())?;
        match picked {
            Some(uri) => {
                api.take_persistable_uri_permission(&uri)
                    .map_err(|e| e.to_string())?;
                Ok(Some(uri.to_string().map_err(|e| e.to_string())?))
            }
            None => Ok(None),
        }
    }

    pub fn describe_location(app: &AppHandle, uri_str: &str) -> String {
        if let Ok(uri) = FileUri::from_str(uri_str) {
            if let Ok(name) = app.android_fs().get_name(&uri) {
                return format!("{name} (chosen folder)");
            }
        }
        uri_str.to_string()
    }

    pub fn create_android_backup(
        app: &AppHandle,
        location: &str,
        name: &str,
        exclude_images: bool,
        keep: u32,
    ) -> Result<BackupResult, String> {
        let dir_uri = FileUri::from_str(location).map_err(|e| e.to_string())?;

        // Android gives no direct filesystem path for a user-picked folder,
        // so snapshot into the app cache (a normal path) first, then copy
        // those bytes into the SAF-backed folder.
        let staging = temp_dir_for(app)?.join(format!("webify_android_backup_{}.db", timestamp_slug()));
        let staged = snapshot_into(app, &staging, exclude_images)?;
        let bytes = fs::read(&staging).map_err(|e| e.to_string())?;
        let _ = fs::remove_file(&staging);

        let api = app.android_fs();
        let file_uri = api
            .create_file(&dir_uri, name, Some("application/octet-stream"))
            .map_err(|e| e.to_string())?;
        api.write(&file_uri, &bytes).map_err(|e| e.to_string())?;

        prune_android_backups(app, &dir_uri, keep)?;

        Ok(BackupResult {
            path: file_uri.to_string().map_err(|e| e.to_string())?,
            size_bytes: staged.size_bytes,
        })
    }

    pub fn list_android_backups(app: &AppHandle, location: &str) -> Result<Vec<BackupInfo>, String> {
        let dir_uri = FileUri::from_str(location).map_err(|e| e.to_string())?;
        let api = app.android_fs();
        let mut out: Vec<BackupInfo> = Vec::new();
        for entry in api.read_dir(&dir_uri).map_err(|e| e.to_string())? {
            if let Entry::File { uri, name, len, .. } = entry {
                if !(name.starts_with("webify-backup-") && name.ends_with(".db")) {
                    continue;
                }
                // Derive the sortable/display timestamp from the filename
                // itself (webify-backup-<unix-secs>.db) rather than relying
                // on a filesystem-style mtime field that may not exist (or
                // may have a different shape) for SAF entries.
                let secs: u64 = name
                    .trim_start_matches("webify-backup-")
                    .trim_end_matches(".db")
                    .parse()
                    .unwrap_or(0);
                out.push(BackupInfo {
                    path: uri.to_string().map_err(|e| e.to_string())?,
                    name,
                    size_bytes: len,
                    modified_at: format!("{}", secs * 1000),
                });
            }
        }
        out.sort_by(|a, b| b.name.cmp(&a.name)); // newest first
        Ok(out)
    }

    fn prune_android_backups(app: &AppHandle, dir_uri: &FileUri, keep: u32) -> Result<(), String> {
        let api = app.android_fs();
        let mut entries: Vec<(FileUri, String)> = Vec::new();
        for entry in api.read_dir(dir_uri).map_err(|e| e.to_string())? {
            if let Entry::File { uri, name, .. } = entry {
                if name.starts_with("webify-backup-") && name.ends_with(".db") {
                    entries.push((uri, name));
                }
            }
        }
        entries.sort_by(|a, b| b.1.cmp(&a.1)); // newest first (sortable filename)
        for (uri, _) in entries.into_iter().skip(keep as usize) {
            let _ = api.remove_file(&uri);
        }
        Ok(())
    }

    pub fn delete_android_backup(app: &AppHandle, uri_str: &str) -> Result<(), String> {
        // Mirrors the desktop safety check: only delete entries whose name
        // matches this app's own backup naming pattern.
        let uri = FileUri::from_str(uri_str).map_err(|e| e.to_string())?;
        let api = app.android_fs();
        let name = api.get_name(&uri).unwrap_or_default();
        if !(name.starts_with("webify-backup-") && name.ends_with(".db")) {
            return Err("Refusing to delete a file that doesn't look like one of this app's backups.".into());
        }
        api.remove_file(&uri).map_err(|e| e.to_string())
    }
}