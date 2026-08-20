# Webify — Project Summary

Personal recipe/life-management desktop app. Tauri + React/TypeScript + SQLite (via
`@tauri-apps/plugin-sql`), plain CSS (no Tailwind/component library). Windows dev
environment, WebView2-based (Chromium quirks apply — e.g. native HTML5 drag-and-drop
requires `dataTransfer.setData` in `dragstart` or it silently fails).

## Stack
- Tauri v2, React 19, TypeScript, Vite
- `@tauri-apps/plugin-sql` (SQLite) — no separate backend, frontend talks to SQLite directly
- `@xyflow/react` — the recipe "web" graph view
- TipTap (`@tiptap/*`) — rich text editor for recipe instructions
- `@tauri-apps/plugin-opener` — opens external links in system browser instead of the app webview

## Navigation
No router. `App.tsx` holds a single `view: View` state (discriminated union in
`src/types/nav.ts`); every page/component calls `onNavigate(newView)` to change it.
Sidebar (`src/components/Sidebar.tsx` + `src/data/appData.ts`) lists sections —
most are placeholder stubs except Recipes and Settings.

## Data model (SQLite)
Two real tables plus support tables. All schema changes go through a tracked
migration system in `src/db/database.ts`:
- `schema_migrations` (name, applied_at) — tracks what's run
- `ensureColumn()` helper: checks the migration log AND the real live schema
  (`PRAGMA table_info`) before running an `ALTER TABLE`, so it's safe regardless of
  whether a database is fresh, mid-migration, or has columns from an older ad-hoc
  system. **Genuine SQL errors now throw** (no more blind try/catch swallowing).
- Known SQLite gotcha already hit once: `ALTER TABLE ADD COLUMN` rejects
  non-constant defaults like `CURRENT_TIMESTAMP` (only `CREATE TABLE` allows that).
  Timestamp columns are added nullable, backfilled once, and every INSERT writes
  `CURRENT_TIMESTAMP` as a literal in the SQL rather than relying on a column default.

**`categories`**: id, name, sort_order

**`recipes`**: id, category_id (FK, cascade delete), name, instructions (HTML, from
the rich text editor), sort_order, image_data (base64 cover image), is_frozen,
is_homegrown, is_favorite, is_proven, parent_recipe_id (self-referential, for
iterations — cascade handled in app code via `deleteRecipe`, not a DB constraint,
since migrated databases may not have the FK), iteration_difference (free text),
created_at, updated_at (maintained by a trigger — `trg_recipes_updated_at`, fires
only on `UPDATE OF name, instructions, image_data, is_frozen, is_homegrown,
is_favorite, is_proven, iteration_difference, category_id` — deliberately excludes
sort_order/display_id so reordering doesn't touch it), display_id (5-digit
zero-padded string, unique, generated with a DB uniqueness check via
`generateUniqueDisplayId()`, immutable after creation, not currently shown in any UI).

**`icon_overrides`** (icon_key PK, image_data): custom images for emoji-style icons.
**`text_element_overrides`** (element_key PK, text, size, color): custom
text/size/color for letter-based buttons (B, I, H¹, etc). Each field independently
nullable.

All queries live in `src/db/*.ts` (`categories.ts`, `recipes.ts`, `icons.ts`,
`textElements.ts`) — no SQL in components.

## Features built
- **Categories/Recipes**: CRUD, drag-reorder (custom `useReorderableList` hook +
  native HTML5 DnD), inline rename, delete-with-confirm. Iterations (duplicated
  recipes linked via `parent_recipe_id`) are excluded from the main category list
  and reached via a "View Iterations" dropdown on the parent recipe instead.
- **Recipe detail page**: cover image upload (base64, no filesystem plugin), 5
  status checkboxes (Proven/Unproven/Frozen/Homegrown/Favorite), double-click-to-rename
  title, Create Iteration button (duplicates everything, links via parent_recipe_id),
  iteration "what's different" note field.
- **Rich text editor** (`src/editor/`): TipTap-based, custom left-side toolbar.
  Custom extensions: `Toggle.ts` (native `<details>/<summary>`, no JS state needed),
  `ResizableImage.tsx` (drag-corner-handle resize via custom NodeView). Link tool
  supports linking to other recipes (`app://recipe/{id}` scheme, intercepted via
  `editorProps.handleClick`) or external URLs (opened via the opener plugin).
- **Recipe web** (`src/pages/RecipesGraphPage.tsx` + `src/components/GraphNodes.tsx`):
  ReactFlow graph, category → recipe cards → expandable iteration clusters (2-wide
  grid). Layout is computed fresh each render from cached data (fetch happens once
  per page visit, NOT on every filter/toggle — this was a real perf bug, fixed).
  Card layout: header (name + iteration toggle), left icon sidebar (frozen/homegrown),
  boxed image area. Green=proven/gray=unproven background, gold border=favorite.
  Column/row spacing is manually tuned (see constants at top of the layout effect) —
  fragile if card/iteration-node dimensions change without updating the matching
  spacing constants.
- **Icon/text customization** (`src/icons/`): `<Icon iconKey="...">` and
  `<TextElement elementKey="...">` components read from React contexts
  (`IconContext.tsx`, `TextElementContext.tsx`) loaded once from DB at app start.
  Settings > Icons and Settings > Text Elements let the user upload replacement
  images or edit text/size/color per element. Registries (`registry.ts`,
  `textRegistry.ts`) are the single source of truth for what's customizable —
  add an entry there, then swap the hardcoded glyph for `<Icon>`/`<TextElement>`
  wherever it's used.

## Known rough edges / things worth knowing
- Not every page's data-loading `useEffect` has error handling — a genuine DB
  failure hangs silently on some pages rather than showing an error (this was
  fixed for `App.tsx`'s initial load and `RecipesGraphPage.tsx`, not audited
  elsewhere).
- `display_id` and timestamps exist in the DB but aren't surfaced in any UI yet.
- No sync/offline story yet — intentionally deferred (see original project vision
  below).

## Original project vision (context, not yet built)
This app is meant to grow into a broader personal life-management system:
Goals → Projects → Progress Webs (dependency-graph task planning with an
auto-layout algorithm the user designed on paper), Responsibilities (recurring
reminders), Inventory, Notes. Recipes was built first specifically to prove out
the architecture (DB, rich content, graph visualization) before tackling those.
AI assistance is meant to stay narrowly scoped (formatting/suggestions), never
deciding the user's actual goals/structure. Long-term: full offline operation,
local AI, phone sync via a "primary device ↔ sync layer ↔ other devices" model —
none of this is implemented yet, but early architecture choices (SQLite as source
of truth, no cloud dependency) were made with it in mind.
