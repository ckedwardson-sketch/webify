# Checklist feature — what's in here

Every path below mirrors your repo, so the whole folder can be copied over the
project root. 12 new files, 11 modified. Full feature notes are in
`docs/CHECKLIST.md`.

## New

```
src/checklist/checklistTypes.ts        line/list/archive/settings shapes
src/checklist/checklistLogic.ts        classification + every edit rule
src/checklist/checklistFormat.ts       dates, truncation, lock-screen rows
src/checklist/checklistStorage.ts      ui_preferences read/write + normalization
src/checklist/ChecklistEditor.tsx      your file, unchanged, placed where its imports expect it
src/checklist/ChecklistEditor.css
src/pages/ChecklistPage.tsx            your file, unchanged
src/pages/ChecklistPage.css
src/pages/ChecklistSettingsPage.tsx    the two-tab settings page
src/pages/ChecklistSettingsPage.css
src/lockscreen/LockScreenSettingsPanel.tsx
docs/CHECKLIST.md
```

## Modified

| File | Change |
| --- | --- |
| `src/types/nav.ts` | `checklist-home`, `checklist-settings` (with optional `tab`) |
| `src/App.tsx` | two imports, two cases in `renderPage` |
| `src/nav/navHistory.ts` | static labels + `sidebarSectionForView` |
| `src/components/Sidebar.tsx` | `isActive` + `handleClick` for Checklist |
| `src/data/appData.ts` | sidebar item after Tasks (this also auto-creates its styleable header via `headerRegistry.ts`) |
| `src/icons/registry.ts` | `nav-checklist` icon key |
| `src/pages/SettingsHomePage.tsx` | nav card pointing at the Page function tab |
| `src/pages/SettingsLockScreenPage.tsx` | now a thin wrapper around the new panel |
| `src/lockscreen/lockScreenSettings.ts` | `showChecklist` + default + normalizer |
| `src/lockscreen/lockScreenSnapshot.ts` | `checklist` rows in `LockFrame` / `SnapshotInput`, loader, frame key |
| `src-tauri/.../LockScreenRenderer.kt` | two hardcoded sections → a general list of three |

No schema migration: state and settings are two JSON blobs in the existing
`ui_preferences` table, the same approach `lockScreenSettings.ts` already uses.

## Not touched

`webify-lockscreen/` holds a second copy of the lockscreen files. It looked like
a separate scratch project rather than something imported by the main app, so I
left it alone — if it's live, `LockScreenRenderer.kt` needs the same edit there.

## Verification

The four non-React modules typecheck clean under your `tsconfig.json` settings
(`strict`, `noUnusedLocals`, `noUnusedParameters`). The rules in
`checklistLogic.ts` and `checklistFormat.ts` were compiled and run against 24
checks covering block classification, the two-blank-line free-text boundary,
Enter / Shift+Enter, both Backspace and Delete stages, clear, archive ordering,
markdown-aware paste, and truncation — all passing.

The `.tsx` files transpile without syntax errors but could not be *type*checked
here: `node_modules` isn't in the repomix, so React's types are unavailable.
Run `npm run build` before trusting them.
