# Quick Settings tile (Checklist countdown)

Samsung / Android Quick Settings tile that shows **one number**: remaining
unticked checklist tasks — the same set the lock screen draws — and opens
Webify to a configurable first-level page on tap.

## What you get

| Piece | Role |
| --- | --- |
| `ChecklistTileService` | Android `TileService`: label "Checklist", subtitle = count |
| `LockScreenBridge.updateQuickTile` / `consumeOpenView` | JS ↔ native |
| Lock screen settings → **Quick Settings tile** | Enable count + "Open on tap" destination |
| Same push path as the lock screen | Count stays current when you edit the checklist |

## Add the tile on the phone (S10e / One UI)

1. Swipe down twice to open Quick Settings.
2. Tap **Edit** (pencil / three-dot → Edit).
3. Find **Checklist** under Webify's tiles and drag it into the active row.
4. Tap it: app opens to the page set under Settings → Lock Screen → **Open on tap**
   (default: Checklist).

## Settings (in-app)

**Settings → Lock Screen** (or Checklist settings → Lock screen tab):

- **Update tile count** — when on, every lock-screen push also writes the
  remaining-checklist number into the tile. Off leaves the last number (or "—").
- **Open on tap** — any first-level destination (Home, Checklist, Tasks, Goals,
  Projects, Dreams, Responsibilities, Recipes, Notes, Skills, Quick Apps, Settings).

## Files (place with `place_files`)

```
src/lockscreen/lockScreenSettings.ts      qsTileEnabled + qsTileDestination + FIRST_LEVEL_DESTINATIONS
src/lockscreen/nativeBridge.ts            updateQuickTile, consumeOpenView
src/lockscreen/lockScreenSync.ts          pushQuickTile after every payload push
src/lockscreen/LockScreenSettingsPanel.tsx  UI section
src/lockscreen/openViewFromNative.ts      NEW — key → View + consume helper
src-tauri/.../ChecklistTileService.kt     NEW
src-tauri/.../LockScreenBridge.kt         + two methods
src-tauri/.../MainActivity.kt             stash EXTRA_OPEN_VIEW
src-tauri/.../AndroidManifest.xml         TileService declaration
src-tauri/.../res/drawable/ic_qs_checklist.xml  NEW white vector icon
src-tauri/.../proguard-rules.pro          keep tile service
docs/QS_TILE_APP_HOOK.md                  App.tsx wiring (manual, 2 useEffects)
```

`webify-lockscreen/` is a separate scratch tree — mirror the Kotlin/manifest
changes there only if you still ship that project.

## Notes

- The tile is **not** a live timer; it is a countdown of **remaining tasks**.
- Active tile metadata is set so SystemUI can bind without the panel open
  when `requestListeningState` runs after a push.
- Destination list is the same idea as "home can open anywhere first-level":
  only top-level `View.type` values, no deep detail pages.
