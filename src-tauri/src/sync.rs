// Whole-database, "newest revision wins" sync over the home LAN. The
// computer always runs the small HTTP server below (desktop-only); the
// phone is always the one that initiates, via the sync_status/
// sync_download/sync_upload commands, matching the "manual Sync Now
// button on the phone, computer just needs to be running" design.
//
// Both sides stream the database file straight to/from disk using
// native Rust (rusqlite + reqwest), instead of shuttling the bytes
// through the JS/IPC bridge. A 50-100MB db buffered through
// fetch().arrayBuffer() + writeFile() on a memory-constrained mobile
// WebView was hanging for minutes and sometimes getting the whole app
// OOM-killed with no catchable error — streaming avoids ever holding
// the whole file in memory at once.

use std::io::Read;
use std::path::{Path, PathBuf};
use std::time::Duration;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};

pub const SYNC_PORT: u16 = 4600;

const DB_FILE_NAME: &str = "webify.db";
const INCOMING_FILE_NAME: &str = "webify_incoming.db";
const SQLITE_HEADER: &[u8] = b"SQLite format 3\0";

fn db_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    Ok(dir.join(DB_FILE_NAME))
}

fn incoming_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    Ok(dir.join(INCOMING_FILE_NAME))
}

// std::env::temp_dir() resolves to /data/local/tmp on Android, which is
// an adb-only path regular apps can't write to (SELinux blocks it) — use
// the app's own cache dir instead, which Tauri gives us on every platform.
fn temp_dir_for(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_cache_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
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

// VACUUM INTO produces a fully consistent, compacted snapshot of the live
// database without needing to lock out the app's own connection — safe to
// run concurrently since it only needs a read transaction. Used on both
// ends: the desktop server for GET /db, and the mobile client for the
// upload side of sync_upload.
fn vacuum_to_path(src: &Path, dest: &Path) -> Result<(), String> {
    let conn = open_readonly(src)?;
    let dest_str = dest.to_string_lossy().replace('\'', "''");
    conn.execute_batch(&format!("VACUUM INTO '{}'", dest_str))
        .map_err(|e| e.to_string())
}

fn read_first_bytes<R: Read>(reader: &mut R, n: usize) -> Result<Vec<u8>, String> {
    let mut buf = vec![0u8; n];
    reader.read_exact(&mut buf).map_err(|e| e.to_string())?;
    Ok(buf)
}

// --- Client side (any platform: desktop or mobile) ---------------------

#[derive(Serialize, Deserialize)]
pub struct SyncStatus {
    pub device_id: String,
    pub revision: i64,
    pub updated_at: String,
}

#[tauri::command]
pub fn sync_status(computer_ip: String) -> Result<SyncStatus, String> {
    let url = format!("http://{}:{}/status", computer_ip, SYNC_PORT);
    let resp = reqwest::blocking::Client::builder()
        .timeout(Duration::from_secs(15))
        .build()
        .map_err(|e| e.to_string())?
        .get(&url)
        .send()
        .map_err(|e| format!("Couldn't reach the computer: {}", e))?;

    if !resp.status().is_success() {
        return Err(format!("Couldn't reach the computer (status {})", resp.status()));
    }

    resp.json::<SyncStatus>().map_err(|e| e.to_string())
}

// Downloads the computer's current db snapshot and stages it at
// webify_incoming.db, streaming the response body straight to disk.
// The frontend still does the actual install (close db, backup, rename,
// reload) since that part is cheap and needs the JS-side db handle closed
// first anyway.
#[tauri::command]
pub fn sync_download(app: AppHandle, computer_ip: String) -> Result<(), String> {
    let url = format!("http://{}:{}/db", computer_ip, SYNC_PORT);
    let mut resp = reqwest::blocking::Client::builder()
        .timeout(Duration::from_secs(300))
        .build()
        .map_err(|e| e.to_string())?
        .get(&url)
        .send()
        .map_err(|e| format!("Download from computer failed: {}", e))?;

    if !resp.status().is_success() {
        return Err(format!("Download from computer failed (status {})", resp.status()));
    }

    let header = read_first_bytes(&mut resp, SQLITE_HEADER.len())?;
    if header != SQLITE_HEADER {
        return Err("Computer didn't return a valid database".to_string());
    }

    let dest = incoming_path(&app)?;
    let mut file = std::fs::File::create(&dest).map_err(|e| e.to_string())?;
    let mut chained = header.chain(resp);
    std::io::copy(&mut chained, &mut file).map_err(|e| e.to_string())?;
    Ok(())
}

// Snapshots this device's live db via VACUUM INTO a temp file, then
// streams that file up as the POST body — never loading the whole
// database into memory.
#[tauri::command]
pub fn sync_upload(app: AppHandle, computer_ip: String) -> Result<(), String> {
    let tmp_path = temp_dir_for(&app)?.join(format!("webify_upload_{}.db", std::process::id()));
    vacuum_to_path(&db_path(&app)?, &tmp_path)?;

    let result = (|| {
        let file = std::fs::File::open(&tmp_path).map_err(|e| e.to_string())?;
        let url = format!("http://{}:{}/db", computer_ip, SYNC_PORT);
        let resp = reqwest::blocking::Client::builder()
            .timeout(Duration::from_secs(300))
            .build()
            .map_err(|e| e.to_string())?
            .post(&url)
            .body(file)
            .send()
            .map_err(|e| format!("Upload to computer failed: {}", e))?;

        if !resp.status().is_success() {
            return Err(format!("Upload to computer failed (status {})", resp.status()));
        }
        Ok(())
    })();

    let _ = std::fs::remove_file(&tmp_path);
    result
}

// --- Server side (desktop only — the computer is always the server) ----

#[cfg(desktop)]
mod server {
    use super::*;
    use tauri::Emitter;

    fn read_status(path: &Path) -> Result<SyncStatus, String> {
        let conn = open_readonly(path)?;
        conn.query_row(
            "SELECT device_id, revision, updated_at FROM sync_meta WHERE id = 1",
            [],
            |row| {
                Ok(SyncStatus {
                    device_id: row.get(0)?,
                    revision: row.get(1)?,
                    updated_at: row.get(2)?,
                })
            },
        )
        .map_err(|e| e.to_string())
    }

    fn handle_request(app: &AppHandle, mut request: tiny_http::Request) -> Result<(), String> {
        match (request.method().clone(), request.url().to_string()) {
            (tiny_http::Method::Get, ref url) if url == "/status" => {
                let status = read_status(&db_path(app)?)?;
                let body = serde_json::to_string(&status).map_err(|e| e.to_string())?;
                let header = tiny_http::Header::from_bytes(
                    &b"Content-Type"[..],
                    &b"application/json"[..],
                )
                .unwrap();
                request
                    .respond(tiny_http::Response::from_string(body).with_header(header))
                    .map_err(|e| e.to_string())
            }
            (tiny_http::Method::Get, ref url) if url == "/db" => {
                let tmp_path = temp_dir_for(app)?
                    .join(format!("webify_snapshot_{}.db", std::process::id()));
                vacuum_to_path(&db_path(app)?, &tmp_path)?;

                let result = (|| {
                    let file = std::fs::File::open(&tmp_path).map_err(|e| e.to_string())?;
                    let header = tiny_http::Header::from_bytes(
                        &b"Content-Type"[..],
                        &b"application/octet-stream"[..],
                    )
                    .unwrap();
                    request
                        .respond(tiny_http::Response::from_file(file).with_header(header))
                        .map_err(|e| e.to_string())
                })();

                let _ = std::fs::remove_file(&tmp_path);
                result
            }
            (tiny_http::Method::Post, ref url) if url == "/db" => {
                let mut reader = request.as_reader();
                let header = match read_first_bytes(&mut reader, SQLITE_HEADER.len()) {
                    Ok(h) => h,
                    Err(_) => {
                        return request
                            .respond(
                                tiny_http::Response::from_string(
                                    "not a sqlite database".to_string(),
                                )
                                .with_status_code(400),
                            )
                            .map_err(|e| e.to_string());
                    }
                };

                if header != SQLITE_HEADER {
                    return request
                        .respond(
                            tiny_http::Response::from_string("not a sqlite database".to_string())
                                .with_status_code(400),
                        )
                        .map_err(|e| e.to_string());
                }

                // Staged under a different filename so this never touches
                // the live db file directly — the frontend (listening for
                // the event below) closes its connection and does the
                // actual swap, which avoids racing the app's own open
                // file handle.
                let dest = incoming_path(app)?;
                let mut file = std::fs::File::create(&dest).map_err(|e| e.to_string())?;
                let mut chained = header.chain(reader);
                std::io::copy(&mut chained, &mut file).map_err(|e| e.to_string())?;
                drop(file);

                let _ = app.emit("sync-db-received", ());
                request
                    .respond(tiny_http::Response::from_string("ok".to_string()))
                    .map_err(|e| e.to_string())
            }
            _ => request
                .respond(
                    tiny_http::Response::from_string("not found".to_string())
                        .with_status_code(404),
                )
                .map_err(|e| e.to_string()),
        }
    }

    pub fn start(app: AppHandle) {
        std::thread::spawn(move || {
            let server = match tiny_http::Server::http(("0.0.0.0", SYNC_PORT)) {
                Ok(s) => s,
                Err(e) => {
                    eprintln!("webify sync: failed to bind port {}: {}", SYNC_PORT, e);
                    return;
                }
            };

            for request in server.incoming_requests() {
                if let Err(e) = handle_request(&app, request) {
                    eprintln!("webify sync: request error: {}", e);
                }
            }
        });
    }
}

#[cfg(desktop)]
pub use server::start;