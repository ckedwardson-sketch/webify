// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

mod backup;
mod recipe_extract;
mod sync;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default()
        .plugin(
            tauri_plugin_log::Builder::new()
                .level(log::LevelFilter::Debug)
                .build(),
        )
        .plugin(tauri_plugin_sql::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            sync::sync_status,
            sync::sync_download,
            sync::sync_upload,
            recipe_extract::fetch_recipe_from_url,
            backup::export_database_download,
            backup::create_automatic_backup,
            backup::list_automatic_backups,
            backup::delete_automatic_backup,
            backup::pick_backup_folder,
            backup::describe_backup_location
        ]);

    // Desktop-only native folder picker (used by backup::pick_backup_folder
    // for the "choose a backup folder" button). Android uses
    // tauri-plugin-android-fs instead, called directly from backup.rs — it
    // doesn't need registering as a Builder plugin here.
    #[cfg(not(any(target_os = "android", target_os = "ios")))]
    let builder = builder.plugin(tauri_plugin_dialog::init());

    #[cfg(desktop)]
    let builder = builder.setup(|app| {
        sync::start(app.handle().clone());
        Ok(())
    });

    builder
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}