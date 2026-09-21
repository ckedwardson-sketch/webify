# Checklist

A deliberately plain section: one big text field that doubles as a to-do list,
and the main thing the phone's lock screen draws. Everything else in Webify is
structured (goals → projects → progress webs); this is the opposite, and on
purpose — the point is that adding a task costs one keystroke.

Sidebar entry: **Checklist**. Views: `checklist-home`, `checklist-settings`.

## The model

A line is `{ id, text, checkbox, checked, checkedAt? }`. A **task** is measured
checkbox-to-checkbox: the line that carries the checkbox plus every following
line that doesn't, so a task can be several lines long.

```
[x] Feed the chickens        task   — starts a block
    and top up their water   cont   — same block
[ ] Order more feed          task   — new block
                             (blank)
                             (blank) — two in a row ends the list
reminder: co-op shuts at 5   free   — outside the system
```

**Free text** is whatever sits after the *last* checkbox once two or more blank
lines have separated it. It is never ticked, cleared or archived, and is shown
dimmed with a left rule. Two blank lines in the *middle* of a list don't count —
you clearly went on to add more tasks below them.

## Keys

| Key | What it does |
| --- | --- |
| Enter | New task (a new checkbox line). Inside free text, just a newline. |
| Shift+Enter | Continues the current task on a new line. |
| Backspace at line start | First press removes the checkbox, folding the line into the task above. Second press merges it into the line above. |
| Delete at line end | Mirror image: first press pulls the next task into this block, second merges. |
| Paste | Multi-line paste becomes one task per line. `- [x] thing` and `* thing` are recognised, so a list copied from somewhere else arrives as tasks, already ticked where it said so. |

All of this lives in `src/checklist/checklistLogic.ts`, which imports nothing but
types — no React, no database. `ChecklistEditor.tsx` only wires DOM events to it.

## The big button

Top bar, right-hand side. Two modes, set by **Page function** in settings:

- **Clear checked items** — removes ticked blocks outright.
- **Send checked to bottom** (archive mode) — moves them to an archive ten blank
  lines below your last line. Newest at the top, older below; a batch archived
  together is sorted by the time each task was ticked, newest first. Archive mode
  adds an optional right-aligned date column with ten formats (`3/6/26`,
  `Mar 6 · 8:04 PM`, `Fri 8:04 PM`, `2026-03-06`, …). Timestamps are stored raw,
  so changing the format re-renders every old entry.

## Multiple lists

Off by default. Switched on, the top bar grows Chrome-style tabs (tap the active
one to rename, two-tap × to delete), a **New list** button, and a grid-view
toggle on the left. Grid view sits *before* the tabs in the same flex row, so
opening it pushes them across rather than covering them. Each card shows a
"picture" of its list — which is the list itself, shrunk, so it's always current
and costs nothing to produce.

## Truncation

Never shortens what you type. It only applies where a task has to fit somewhere
small: the lock screen, and the grid thumbnails.

- **Slider** — characters before the cut; the top of the range means no limit.
  Cuts at a word boundary when one is close enough.
- **Truncate at the first line break** — a task written as a short line plus a
  few lines of detail shows only that first line.

## Lock screen

The checklist is the first of three sections the wallpaper draws (then Tasks,
then Responsibilities), toggled by **Checklist** under Show on the lock screen
settings. It sends the *unticked* tasks of whichever list you're on, already
truncated; ticked ones are deliberately left off, since the wallpaper is a glance
at what's left rather than a record of what's done. With multiple lists on, each
row carries its list name on the right.

`LockScreenRenderer.kt` allocates the available height between whichever sections
are non-empty, proportionally to their size but never less than one row each, and
spends a truncated section's last row on "+N more".

## Settings

`checklist-settings` has two large tabs:

1. **Lock screen** — the existing lock screen page. Its controls live in
   `src/lockscreen/LockScreenSettingsPanel.tsx` so this tab and
   `Settings → Lock Screen` are the same component, not two copies.
2. **Page function** — Text, Page function, Archive mode (only shown once the
   button has been switched to archive mode), Multiple lists.

## Storage

Two JSON blobs in the existing `ui_preferences` key/value table —
`checklist.state` and `checklist.settings` — the same approach
`lockScreenSettings.ts` uses. No schema migration, and both travel with the
database when it syncs. Everything read back goes through
`normalizeChecklistState` / `normalizeChecklistSettings`, so a half-written,
hand-edited or older blob can't produce a checklist the editor chokes on.

Saves are debounced 300ms after typing settles, and flushed immediately when the
page unmounts or the app goes to the background — followed by a lock screen push,
so what you just typed is on the wallpaper by the time you've locked the phone.

## Files

```
src/checklist/
  checklistTypes.ts     shapes only, no React or DB
  checklistLogic.ts     classification + every edit rule
  checklistFormat.ts    dates, truncation, lock-screen rows
  checklistStorage.ts   ui_preferences read/write + normalization
  ChecklistEditor.tsx   one auto-growing <textarea> per line
  ChecklistEditor.css
src/pages/
  ChecklistPage.tsx     top bar, tabs, grid view
  ChecklistPage.css
  ChecklistSettingsPage.tsx
  ChecklistSettingsPage.css
src/lockscreen/
  LockScreenSettingsPanel.tsx   extracted from SettingsLockScreenPage
```

## Worth knowing

- The editor is one `<textarea>` per line rather than a single
  `contentEditable`: Android soft keyboards are far more predictable with real
  form fields, and Enter/Backspace have to be intercepted per line anyway.
  Android also reports keydown as `Unidentified` (keycode 229), so
  `beforeinput` carries the intent instead — see the comments in
  `ChecklistEditor.tsx`.
- Checklist writes go through `db.execute`, which `lockScreenSync.ts` wraps, so
  every edit already schedules a debounced wallpaper refresh. No extra plumbing.
- Only the active list reaches the lock screen. Sending all of them, prefixed by
  list name, is a small change in `checklistLockRows`.