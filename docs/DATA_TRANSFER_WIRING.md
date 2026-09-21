# Data saving / transfer — wiring notes

Apply these small edits by hand (or merge) after placing the new files with
`place-files`. New files already carry `@@PLACE:` markers.

## New files (marker-placed)

| Path | Role |
| --- | --- |
| `src/db/backupSettings.ts` | Settings blob in `ui_preferences` (`backup.settings`) |
| `src/db/backup.ts` | JS wrappers + `maybeRunAutomaticBackup` |
| `src/pages/SettingsSyncPage.tsx` | Tabbed page (replaces the old single-tab Sync page) |
| `src/pages/SettingsDataTransfer.css` | Tab / switch / backup-list styles |
| `src-tauri/src/backup.rs` | VACUUM snapshot, strip images, Downloads export, rotation |

## `src-tauri/src/lib.rs`

Add the module and register the four commands:

```rust
mod recipe_extract;
mod sync;
mod backup;   // <-- add

// ...

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
])
```

## `src-tauri/capabilities/default.json`

No new permissions are required for writing under `$APPDATA` via Rust
`std::fs`, or for `app.path().download_dir()`. Existing `fs:*` entries stay
as they are for the JS sync install path.

## `src/types/nav.ts`

Change the sync view to accept an optional tab (same idea as checklist-settings):

```ts
| { type: "settings-sync"; tab?: "sync" | "cloud-backups" | "db-download" }
```

## `src/App.tsx`

Pass the optional tab through:

```tsx
case "settings-sync":
  return <SettingsSyncPage onNavigate={navigate} tab={view.tab} />;
```

## `src/pages/SettingsHomePage.tsx`

Update the nav card:

```ts
{ view: { type: "settings-sync" }, title: "Data saving / transfer", desc: "Wifi sync, automatic backups, and database download" },
```

## `src/nav/navHistory.ts`

```ts
"settings-sync": "Data saving / transfer",
```

## `src/pages/settingsSearchIndex.ts`

Update the existing Sync entry and add two more, e.g.:

```ts
{
  section: "Data saving / transfer",
  label: "Sync with computer",
  key: "sync-with-computer",
  view: { type: "settings-sync", tab: "sync" },
},
{
  section: "Data saving / transfer",
  label: "Automatic cloud backups",
  key: "automatic-cloud-backups",
  view: { type: "settings-sync", tab: "cloud-backups" },
},
{
  section: "Data saving / transfer",
  label: "Download database",
  key: "db-download",
  view: { type: "settings-sync", tab: "db-download" },
},
```

## Optional: run due backups on app resume

In `App.tsx` next to other startup effects (after `dbReady`):

```ts
import { maybeRunAutomaticBackup } from "./db/backup";

useEffect(() => {
  if (!dbReady) return;
  void maybeRunAutomaticBackup().catch((err) =>
    console.warn("automatic backup:", err)
  );
}, [dbReady]);
```

## Behaviour summary

- **Sync tab** — identical to the previous Sync page.
- **Automatic cloud backups** — local rotating snapshots under
  `$APPDATA/backups/`, with enable / interval / max count / exclude-images.
  UI copy notes that a future release can push the same files to a personal
  cloud folder; retention and size settings already match that design.
- **DB download** — one-off `VACUUM INTO` copy into the system Downloads
  folder (fallback: `$APPDATA/exports/`), optional image strip.