import Database from "@tauri-apps/plugin-sql";
import { notesBlocksToHtml, LegacyNoteBlockRow } from "./notesMigration";

const DB_URL = "sqlite:webify.db";

let dbInstance: Database | null = null;

// ---- Migration bookkeeping ----------------------------------------

async function isMigrationApplied(db: Database, name: string): Promise<boolean> {
  const rows = await db.select<{ name: string }[]>(
    "SELECT name FROM schema_migrations WHERE name = $1",
    [name]
  );
  return rows.length > 0;
}

async function markMigrationApplied(db: Database, name: string): Promise<void> {
  await db.execute("INSERT OR IGNORE INTO schema_migrations (name) VALUES ($1)", [name]);
}

async function columnExists(db: Database, table: string, column: string): Promise<boolean> {
  const columns = await db.select<{ name: string }[]>(`PRAGMA table_info(${table})`);
  return columns.some((c) => c.name === column);
}

// A column-adding migration that's safe regardless of how the database
// got here: an old database that already has this column from the
// previous blind try/catch system, a brand-new database whose
// CREATE TABLE already included it, or a genuinely old database that
// needs it added for the first time. It checks the real schema, not
// just the migration log, before deciding whether to run.
async function ensureColumn(
  db: Database,
  name: string,
  table: string,
  column: string,
  definition: string
): Promise<void> {
  if (await isMigrationApplied(db, name)) return;
  if (!(await columnExists(db, table, column))) {
    await db.execute(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
  await markMigrationApplied(db, name);
}

// Generates a 5-digit, zero-padded, unique recipe display id. Checks
// the database rather than trusting randomness alone.
export async function generateUniqueDisplayId(db: Database): Promise<string> {
  for (let attempt = 0; attempt < 50; attempt++) {
    const candidate = String(Math.floor(Math.random() * 100000)).padStart(5, "0");
    const existing = await db.select<{ count: number }[]>(
      "SELECT COUNT(*) as count FROM recipes WHERE display_id = $1",
      [candidate]
    );
    if (existing[0].count === 0) return candidate;
  }
  throw new Error("Could not generate a unique 5-digit recipe display id after 50 attempts");
}

async function runMigrations(db: Database): Promise<void> {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Columns from the old, pre-migration-system era. ensureColumn
  // checks real column presence first, so this is safe whether an
  // existing database already has them or not.
  await ensureColumn(db, "add_recipes_sort_order", "recipes", "sort_order", "INTEGER NOT NULL DEFAULT 0");
  await ensureColumn(db, "add_recipes_image_data", "recipes", "image_data", "TEXT");
  await ensureColumn(db, "add_recipes_is_frozen", "recipes", "is_frozen", "INTEGER NOT NULL DEFAULT 0");
  await ensureColumn(db, "add_recipes_is_homegrown", "recipes", "is_homegrown", "INTEGER NOT NULL DEFAULT 0");
  await ensureColumn(db, "add_recipes_is_favorite", "recipes", "is_favorite", "INTEGER NOT NULL DEFAULT 0");
  await ensureColumn(db, "add_recipes_is_proven", "recipes", "is_proven", "INTEGER NOT NULL DEFAULT 0");
  await ensureColumn(db, "add_recipes_parent_recipe_id", "recipes", "parent_recipe_id", "INTEGER");
  await ensureColumn(db, "add_recipes_iteration_difference", "recipes", "iteration_difference", "TEXT");

  // Timestamps. SQLite's ALTER TABLE ADD COLUMN refuses a non-constant
  // default like CURRENT_TIMESTAMP (only CREATE TABLE allows that) —
  // so these are added as plain nullable columns instead, existing
  // rows are backfilled once below, and every INSERT going forward
  // writes CURRENT_TIMESTAMP explicitly as a literal (see db/recipes.ts).
  await ensureColumn(db, "add_recipes_created_at", "recipes", "created_at", "TEXT");
  await ensureColumn(db, "add_recipes_updated_at", "recipes", "updated_at", "TEXT");

  if (!(await isMigrationApplied(db, "backfill_recipes_timestamps"))) {
    await db.execute(
      "UPDATE recipes SET created_at = CURRENT_TIMESTAMP WHERE created_at IS NULL"
    );
    await db.execute(
      "UPDATE recipes SET updated_at = CURRENT_TIMESTAMP WHERE updated_at IS NULL"
    );
    await markMigrationApplied(db, "backfill_recipes_timestamps");
  }

  // 5-digit human-facing display id. No meaningful column DEFAULT for
  // this (needs a uniqueness check), so existing rows are backfilled
  // explicitly below, and new rows get one assigned at insert time in
  // db/recipes.ts.
  await ensureColumn(db, "add_recipes_display_id", "recipes", "display_id", "TEXT");

  if (!(await isMigrationApplied(db, "backfill_recipes_display_id"))) {
    const rows = await db.select<{ id: number }[]>("SELECT id FROM recipes WHERE display_id IS NULL");
    for (const row of rows) {
      const displayId = await generateUniqueDisplayId(db);
      await db.execute("UPDATE recipes SET display_id = $1 WHERE id = $2", [displayId, row.id]);
    }
    await markMigrationApplied(db, "backfill_recipes_display_id");
  }

  // updated_at trigger. Only watches columns that represent an actual
  // content edit — sort_order (drag reorder) and display_id
  // (immutable after creation) are deliberately left out.
  if (!(await isMigrationApplied(db, "add_recipes_updated_at_trigger"))) {
    await db.execute(`
      CREATE TRIGGER IF NOT EXISTS trg_recipes_updated_at
      AFTER UPDATE OF name, instructions, image_data, is_frozen, is_homegrown, is_favorite, is_proven, iteration_difference, category_id
      ON recipes
      FOR EACH ROW
      BEGIN
        UPDATE recipes SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
      END;
    `);
    await markMigrationApplied(db, "add_recipes_updated_at_trigger");
  }

  // Icon overrides — key/image pairs set from Settings > Icons.
  // Absence of a row for a given key just means "use the default".
  if (!(await isMigrationApplied(db, "create_icon_overrides_table"))) {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS icon_overrides (
        icon_key TEXT PRIMARY KEY,
        image_data TEXT NOT NULL
      )
    `);
    await markMigrationApplied(db, "create_icon_overrides_table");
  }

  // Text element overrides — customizable text/size/color for the
  // letter-based toolbar controls (B, I, H¹, etc). Each field is
  // independently nullable, so you can change just the color and
  // leave the text/size at their defaults.
  if (!(await isMigrationApplied(db, "create_text_element_overrides_table"))) {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS text_element_overrides (
        element_key TEXT PRIMARY KEY,
        text TEXT,
        size INTEGER,
        color TEXT
      )
    `);
    await markMigrationApplied(db, "create_text_element_overrides_table");
  }

  // Header style overrides — customizable font size/color/bold/underline
  // for named "header" text around the app (currently the sidebar's
  // title and nav items — see icons/headerRegistry.ts). Same independently
  // -nullable convention as text_element_overrides, but this registry
  // never overrides the text content itself, only its style.
  if (!(await isMigrationApplied(db, "create_header_style_overrides_table"))) {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS header_style_overrides (
        header_key TEXT PRIMARY KEY,
        size INTEGER,
        color TEXT,
        bold INTEGER,
        underline INTEGER
      )
    `);
    await markMigrationApplied(db, "create_header_style_overrides_table");
  }

  // Adds the ability to rename a header's text (not just style it) — the
  // sidebar's title/nav labels were style-only until now.
  if (!(await isMigrationApplied(db, "add_header_style_overrides_text_column"))) {
    await db.execute(`ALTER TABLE header_style_overrides ADD COLUMN text TEXT`);
    await markMigrationApplied(db, "add_header_style_overrides_text_column");
  }

  // Button style overrides — customizable text/font/colors/box size for
  // whole buttons (not just their icon or a single text glyph), e.g. the
  // recipe web's Filter and Zoom Out / Back buttons. Every field is
  // independently nullable, same convention as text_element_overrides.
  if (!(await isMigrationApplied(db, "create_button_style_overrides_table"))) {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS button_style_overrides (
        button_key TEXT PRIMARY KEY,
        text TEXT,
        font_family TEXT,
        font_size INTEGER,
        text_color TEXT,
        background_color TEXT,
        border_color TEXT,
        padding_x INTEGER,
        padding_y INTEGER,
        border_radius INTEGER
      )
    `);
    await markMigrationApplied(db, "create_button_style_overrides_table");
  }

  // Theme settings — a small generic key/value store (not a per-element
  // registry like the tables above) for the handful of app-wide/web-wide
  // color choices: light/dark mode plus the recipe web's background and
  // node colors. Absence of a key just means "use the default".
  if (!(await isMigrationApplied(db, "create_theme_settings_table"))) {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS theme_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )
    `);
    await markMigrationApplied(db, "create_theme_settings_table");
  }

  // Screen-capture batch selection — which pages/categories/recipes are
  // checked in the capture widget's checklist. Presence of a row means
  // "included in the next batch capture"; this persists so the same
  // set gets captured every time until the user changes it.
  if (!(await isMigrationApplied(db, "create_capture_targets_table"))) {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS capture_targets (
        target_key TEXT PRIMARY KEY
      )
    `);
    await markMigrationApplied(db, "create_capture_targets_table");
  }

  // Saved theme presets — an in-app library alongside file export/
  // import. Each row is a full snapshot (icons + text elements + button
  // styles + theme settings) serialized as JSON, the same shape the
  // file export produces, so both paths share one apply routine.
  if (!(await isMigrationApplied(db, "create_theme_presets_table"))) {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS theme_presets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        data TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await markMigrationApplied(db, "create_theme_presets_table");
  }

  // Dream web — a free-form canvas the user builds entirely by hand
  // (no derived structure like the recipe web's category/parent
  // hierarchy): dreams placed and sized wherever the user drags them,
  // linked however the user connects them.
  if (!(await isMigrationApplied(db, "create_dreams_table"))) {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS dreams (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        reasoning TEXT NOT NULL DEFAULT '',
        expected_date TEXT,
        priority TEXT NOT NULL DEFAULT 'medium',
        notes TEXT NOT NULL DEFAULT '',
        pos_x REAL NOT NULL DEFAULT 0,
        pos_y REAL NOT NULL DEFAULT 0,
        scale REAL NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await markMigrationApplied(db, "create_dreams_table");
  }

  // User-drawn connections between dream nodes — not derived from any
  // hierarchy, just whatever the user dragged a connection between.
  if (!(await isMigrationApplied(db, "create_dream_links_table"))) {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS dream_links (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        source_dream_id INTEGER NOT NULL REFERENCES dreams(id) ON DELETE CASCADE,
        target_dream_id INTEGER NOT NULL REFERENCES dreams(id) ON DELETE CASCADE,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(source_dream_id, target_dream_id)
      )
    `);
    await markMigrationApplied(db, "create_dream_links_table");
  }

  // Which point on each end's node boundary a link visually connects
  // to, stored as a rotational angle (degrees, 0-360) around that node's
  // center rather than a raw x/y — so the connection point recomputes
  // correctly against the node's current shape (see theme/nodeShapes.ts
  // and theme/nodeBoundary.ts) instead of drifting if the shape changes.
  // Null means "no angle recorded" (a link created before this existed,
  // or via the old fixed corner-handle system) — DreamWebPage falls back
  // to a default angle for those.
  await ensureColumn(db, "add_dream_links_source_angle", "dream_links", "source_angle", "REAL");
  await ensureColumn(db, "add_dream_links_target_angle", "dream_links", "target_angle", "REAL");

  // Deep memory for dream pages: every time name/reasoning/expected
  // date/priority/notes changes, the prior value is appended here
  // before the update lands — so a dream page can show its own history
  // even though the live row only ever holds the current value.
  if (!(await isMigrationApplied(db, "create_dream_history_table"))) {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS dream_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        dream_id INTEGER NOT NULL REFERENCES dreams(id) ON DELETE CASCADE,
        field TEXT NOT NULL,
        old_value TEXT,
        new_value TEXT,
        changed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await markMigrationApplied(db, "create_dream_history_table");
  }

  // Expected date becomes a range (start/end) instead of a single day —
  // far-off dreams can only be pinned down to a month or year, which is
  // modeled as a wide range rather than a fake precise date. The old
  // expected_date column is left in place unused rather than dropped
  // (SQLite ALTER TABLE DROP COLUMN is a real risk on a live db file);
  // any pre-existing value is backfilled into both ends of the range.
  await ensureColumn(db, "add_dreams_expected_date_start", "dreams", "expected_date_start", "TEXT");
  await ensureColumn(db, "add_dreams_expected_date_end", "dreams", "expected_date_end", "TEXT");

  if (!(await isMigrationApplied(db, "backfill_dreams_expected_date_range"))) {
    await db.execute(
      `UPDATE dreams SET expected_date_start = expected_date, expected_date_end = expected_date
       WHERE expected_date_start IS NULL AND expected_date IS NOT NULL`
    );
    await markMigrationApplied(db, "backfill_dreams_expected_date_range");
  }

  // "Put to bed" — parks a dream off the timeline instead of deleting
  // it. sleep_until is informational (shown on the dream page) and
  // doesn't currently drive any auto-wake behavior.
  await ensureColumn(db, "add_dreams_is_asleep", "dreams", "is_asleep", "INTEGER NOT NULL DEFAULT 0");
  await ensureColumn(db, "add_dreams_sleep_until", "dreams", "sleep_until", "TEXT");

  // Accountability: the reason typed in when a field was changed,
  // alongside the old/new value already captured.
  await ensureColumn(db, "add_dream_history_reason", "dream_history", "reason", "TEXT");

  // Responsibilities — recurring tasks (daily/weekly-biweekly/yearly).
  // schedule_json holds a category-shaped JSON blob (see
  // src/types/responsibility.ts) rather than a wide sparse column set,
  // since the three categories' scheduling data genuinely don't share
  // a shape.
  if (!(await isMigrationApplied(db, "create_responsibilities_table"))) {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS responsibilities (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        consequences TEXT NOT NULL DEFAULT '',
        reasoning TEXT NOT NULL DEFAULT '',
        category TEXT NOT NULL,
        icon TEXT NOT NULL DEFAULT '📋',
        sound_key TEXT NOT NULL DEFAULT 'chime',
        schedule_json TEXT NOT NULL DEFAULT '{}',
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT,
        updated_at TEXT
      )
    `);
    await markMigrationApplied(db, "create_responsibilities_table");
  }

  await ensureColumn(
    db,
    "add_responsibilities_pending_lead_time",
    "responsibilities",
    "pending_lead_time_hours",
    "REAL NOT NULL DEFAULT 0"
  );

  // One row per date a responsibility was actually marked done. Due-ness
  // and "completed for the current period" are both computed live from
  // this + the schedule, rather than pre-generating occurrence rows —
  // simpler and needs no background scheduler.
  if (!(await isMigrationApplied(db, "create_responsibility_completions_table"))) {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS responsibility_completions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        responsibility_id INTEGER NOT NULL REFERENCES responsibilities(id) ON DELETE CASCADE,
        occurrence_date TEXT NOT NULL,
        completed_at TEXT NOT NULL,
        UNIQUE(responsibility_id, occurrence_date)
      )
    `);
    await markMigrationApplied(db, "create_responsibility_completions_table");
  }

  if (!(await isMigrationApplied(db, "create_issue_reports_table"))) {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS issue_reports (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        note TEXT NOT NULL,
        screenshot_data TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await markMigrationApplied(db, "create_issue_reports_table");
  }

  // Projects — concrete initiatives hung off a dream, each with its own
  // goals/reasoning/to-do text plus a board of widgets (journal entries,
  // link/image items) for freeform tracking.
  if (!(await isMigrationApplied(db, "create_projects_table"))) {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS projects (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        dream_id INTEGER NOT NULL REFERENCES dreams(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        goals TEXT NOT NULL DEFAULT '',
        reasoning TEXT NOT NULL DEFAULT '',
        needs_doing TEXT NOT NULL DEFAULT '',
        expected_date_start TEXT,
        expected_date_end TEXT,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT,
        updated_at TEXT
      )
    `);
    await markMigrationApplied(db, "create_projects_table");
  }

  if (!(await isMigrationApplied(db, "create_project_widgets_table"))) {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS project_widgets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        widget_type TEXT NOT NULL,
        title TEXT NOT NULL DEFAULT '',
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await markMigrationApplied(db, "create_project_widgets_table");
  }

  if (!(await isMigrationApplied(db, "create_project_journal_entries_table"))) {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS project_journal_entries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        widget_id INTEGER NOT NULL REFERENCES project_widgets(id) ON DELETE CASCADE,
        content TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await markMigrationApplied(db, "create_project_journal_entries_table");
  }

  if (!(await isMigrationApplied(db, "create_project_board_items_table"))) {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS project_board_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        widget_id INTEGER NOT NULL REFERENCES project_widgets(id) ON DELETE CASCADE,
        item_type TEXT NOT NULL,
        text_content TEXT,
        link_href TEXT,
        link_label TEXT,
        image_data TEXT,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await markMigrationApplied(db, "create_project_board_items_table");
  }

  // A project no longer has to hang off a dream — it can just exist on
  // its own, linked later or never. SQLite can't drop a NOT NULL/change
  // an ON DELETE clause with ALTER TABLE, so this rebuilds the table:
  // new shape, copy every row over unchanged, swap it in. ON DELETE
  // CASCADE becomes SET NULL — deleting a dream should detach its
  // projects, not take them down with it.
  if (!(await isMigrationApplied(db, "make_projects_dream_id_optional"))) {
    await db.execute(`
      CREATE TABLE projects_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        dream_id INTEGER REFERENCES dreams(id) ON DELETE SET NULL,
        name TEXT NOT NULL,
        goals TEXT NOT NULL DEFAULT '',
        reasoning TEXT NOT NULL DEFAULT '',
        needs_doing TEXT NOT NULL DEFAULT '',
        expected_date_start TEXT,
        expected_date_end TEXT,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT,
        updated_at TEXT
      )
    `);
    await db.execute(`
      INSERT INTO projects_new
        (id, dream_id, name, goals, reasoning, needs_doing, expected_date_start, expected_date_end, sort_order, created_at, updated_at)
      SELECT id, dream_id, name, goals, reasoning, needs_doing, expected_date_start, expected_date_end, sort_order, created_at, updated_at
      FROM projects
    `);
    await db.execute(`DROP TABLE projects`);
    await db.execute(`ALTER TABLE projects_new RENAME TO projects`);
    await markMigrationApplied(db, "make_projects_dream_id_optional");
  }

  // Progress web — baseline only, see types/models.ts's ProgressNode
  // comment. Free-drag position like an undated dream; no links table
  // yet since there's no dependency logic to hang it off of. Belongs to
  // exactly one project (see the design-notes course-correction: only
  // projects have progress webs, not a single global one).
  if (!(await isMigrationApplied(db, "create_progress_nodes_table"))) {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS progress_nodes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
        category TEXT NOT NULL DEFAULT 'task',
        short_description TEXT NOT NULL DEFAULT '',
        description TEXT NOT NULL DEFAULT '',
        difficulty TEXT NOT NULL DEFAULT 'moderate',
        reason TEXT NOT NULL DEFAULT '',
        instructions TEXT NOT NULL DEFAULT '',
        image_data TEXT,
        is_complete INTEGER NOT NULL DEFAULT 0,
        is_read INTEGER NOT NULL DEFAULT 0,
        pos_x REAL NOT NULL DEFAULT 0,
        pos_y REAL NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await markMigrationApplied(db, "create_progress_nodes_table");
  }

  // project_id didn't exist yet the first time create_progress_nodes_table
  // ran on an already-migrated dev database — ensureColumn covers that
  // database, a fresh one already gets it from the CREATE TABLE above.
  await ensureColumn(db, "add_progress_nodes_project_id", "progress_nodes", "project_id", "INTEGER REFERENCES projects(id) ON DELETE CASCADE");

  // Goals — one layer above projects: a bigger aim a handful of projects
  // might serve, optionally (never automatically) tied to a dream, same
  // as projects. Deliberately mirrors the projects table shape 1:1
  // rather than needs_doing text hint reuse or a self join, so the two
  // stay simple and independent. Widgets (journal/link-board) are
  // shared with projects via project_widgets.goal_id below rather than
  // a parallel goal_widgets table — the widget content tables
  // (project_journal_entries/project_board_items) key off widget_id
  // alone, so they don't need to know or care which owner it's for.
  if (!(await isMigrationApplied(db, "create_goals_table"))) {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS goals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        dream_id INTEGER REFERENCES dreams(id) ON DELETE SET NULL,
        name TEXT NOT NULL,
        goals TEXT NOT NULL DEFAULT '',
        reasoning TEXT NOT NULL DEFAULT '',
        needs_doing TEXT NOT NULL DEFAULT '',
        expected_date_start TEXT,
        expected_date_end TEXT,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT,
        updated_at TEXT
      )
    `);
    await markMigrationApplied(db, "create_goals_table");
  }

  // Lets a widget (journal or link/image board) belong to a goal instead
  // of a project — goals are otherwise formatted identically to
  // projects, so they share this table rather than needing a parallel
  // one. Same rebuild technique as make_projects_dream_id_optional:
  // project_id can't just be widened with ALTER TABLE. Exactly one of
  // project_id/goal_id is set per row (enforced at the app level, not a
  // CHECK constraint, to keep this a plain rebuild).
  if (!(await isMigrationApplied(db, "add_project_widgets_goal_id"))) {
    await db.execute(`
      CREATE TABLE project_widgets_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
        goal_id INTEGER REFERENCES goals(id) ON DELETE CASCADE,
        widget_type TEXT NOT NULL,
        title TEXT NOT NULL DEFAULT '',
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await db.execute(`
      INSERT INTO project_widgets_new (id, project_id, widget_type, title, sort_order, created_at)
      SELECT id, project_id, widget_type, title, sort_order, created_at FROM project_widgets
    `);
    await db.execute(`DROP TABLE project_widgets`);
    await db.execute(`ALTER TABLE project_widgets_new RENAME TO project_widgets`);
    await markMigrationApplied(db, "add_project_widgets_goal_id");
  }

  // A single rough guess at when work begins — separate from the
  // expected_date_start/end range above, which is about the target/done
  // date, not the start. Deliberately just one date, not a range: it's
  // an estimate, not something worth precision-picking like the done-by
  // date is.
  await ensureColumn(db, "add_projects_estimated_start_date", "projects", "estimated_start_date", "TEXT");
  await ensureColumn(db, "add_goals_estimated_start_date", "goals", "estimated_start_date", "TEXT");

  // A goal's horizontal position on the Dream Web, once the user has
  // dragged it there — null means "not yet dragged, use the computed
  // cluster position under its parent dream" (see DreamWebPage.tsx's
  // goalPositionsFor). Goals have no free-form y of their own even once
  // dragged — only x moves; y always tracks either the goal's own date
  // or its parent dream, same rule as before.
  await ensureColumn(db, "add_goals_pos_x", "goals", "pos_x", "REAL");

  // The dream-side anchor angle for a goal's dashed "attached to its
  // dream" edge (see DreamWebPage.tsx) — null means "not dragged yet,
  // keep auto-pointing at the goal" (the original behavior); once
  // dragged, this pins it so a reconnect gesture actually sticks
  // instead of snapping back to the auto-computed angle on next render.
  await ensureColumn(db, "add_goals_dream_attach_angle", "goals", "dream_attach_angle", "REAL");

  // A "passion project" is just a goal with this flag set — same table,
  // same fields, same Goal Web machinery (it "can have its own progress
  // web" for free this way) — just shown on the Projects page instead
  // of the Goals page (see ProjectsHomePage.tsx), with a lighter-weight
  // creation flow and an auto-provisioned Image Dock widget.
  await ensureColumn(db, "add_goals_is_passion_project", "goals", "is_passion_project", "INTEGER NOT NULL DEFAULT 0");

  // Designer-defined slider controls (see theme/customSliders.ts) — a
  // theme can declare its own continuously-adjustable knobs (e.g. "grain
  // overlay opacity") instead of only the fixed fields on ThemeSettings.
  // One row per slider; `value` is the app user's current live setting,
  // separate from `default_value` (what the designer/import shipped),
  // so dragging the slider doesn't require re-importing the theme.
  if (!(await isMigrationApplied(db, "create_theme_custom_sliders_table"))) {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS theme_custom_sliders (
        id TEXT PRIMARY KEY,
        label TEXT NOT NULL,
        css_var TEXT NOT NULL,
        min_value REAL NOT NULL,
        max_value REAL NOT NULL,
        step_value REAL NOT NULL,
        default_value REAL NOT NULL,
        value REAL NOT NULL,
        unit TEXT NOT NULL DEFAULT '',
        description TEXT NOT NULL DEFAULT '',
        sort_order INTEGER NOT NULL DEFAULT 0
      )
    `);
    await markMigrationApplied(db, "create_theme_custom_sliders_table");
  }

  // Lets a project belong to a goal — previously projects only linked to
  // a dream (see make_projects_dream_id_optional above). SET NULL, not
  // CASCADE, matching projects.dream_id's "optional, detach don't
  // destroy" convention: deleting a goal shouldn't take its projects
  // with it.
  await ensureColumn(db, "add_projects_goal_id", "projects", "goal_id", "INTEGER REFERENCES goals(id) ON DELETE SET NULL");

  // Progress Web was retired as its own routed screen — Goal Web now
  // shows tasks directly (see GoalWebPage.tsx). A task can belong to
  // exactly one of project_id/goal_id, same dual-ownership convention as
  // project_widgets: a goal with no project layer can still have tasks
  // directly on it, and a project's own tasks still cascade-delete with
  // it either way.
  await ensureColumn(db, "add_progress_nodes_goal_id", "progress_nodes", "goal_id", "INTEGER REFERENCES goals(id) ON DELETE CASCADE");

  // Lets a responsibility optionally be linked onto a goal's web too
  // (see GoalWebPage.tsx's "Link Responsibility" flow) — SET NULL, same
  // "optional, detach don't destroy" convention as projects.goal_id.
  await ensureColumn(db, "add_responsibilities_goal_id", "responsibilities", "goal_id", "INTEGER REFERENCES goals(id) ON DELETE SET NULL");

  // Remembers exactly where a web canvas (Dream Web, or one goal's Goal
  // Web) was panned/zoomed to, so reopening it lands back where you left
  // off instead of always re-fitting the whole canvas. One row per
  // scope_key ("dream-web", or "goal-web:<id>"); overwritten wholesale on
  // every viewport change rather than accumulating history.
  if (!(await isMigrationApplied(db, "create_saved_viewports_table"))) {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS saved_viewports (
        scope_key TEXT PRIMARY KEY,
        x REAL NOT NULL,
        y REAL NOT NULL,
        zoom REAL NOT NULL
      )
    `);
    await markMigrationApplied(db, "create_saved_viewports_table");
  }

  // Named zoom bookmarks within one goal's web — the replacement for
  // "open a separate screen for this project": save the current pan/
  // zoom under a label (e.g. a project's task cluster), then jump back
  // to it later without leaving the canvas. Purely a viewport snapshot,
  // not a data relationship — deleting a bookmark touches nothing else.
  if (!(await isMigrationApplied(db, "create_goal_web_bookmarks_table"))) {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS goal_web_bookmarks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        goal_id INTEGER NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
        label TEXT NOT NULL,
        x REAL NOT NULL,
        y REAL NOT NULL,
        zoom REAL NOT NULL,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await markMigrationApplied(db, "create_goal_web_bookmarks_table");
  }

  // Three new widget types alongside journal/linkboard (see
  // types/project.ts's ProjectWidgetType) — each keyed by widget_id,
  // cascading with its owning project_widgets row like the existing
  // content tables do.

  // Table — one JSON blob per widget (columns + rows), not one row per
  // cell: there's no formula/relational need, just a flexible grid.
  if (!(await isMigrationApplied(db, "create_project_tables_table"))) {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS project_tables (
        widget_id INTEGER PRIMARY KEY REFERENCES project_widgets(id) ON DELETE CASCADE,
        data_json TEXT NOT NULL DEFAULT '{}'
      )
    `);
    await markMigrationApplied(db, "create_project_tables_table");
  }

  // Quick Photo — one settings row per widget (display mode, intervals,
  // orientation, capture behavior) plus many photo_entries rows.
  if (!(await isMigrationApplied(db, "create_photo_widget_settings_table"))) {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS photo_widget_settings (
        widget_id INTEGER PRIMARY KEY REFERENCES project_widgets(id) ON DELETE CASCADE,
        display_mode TEXT NOT NULL DEFAULT 'carddeck',
        slideshow_interval_seconds INTEGER NOT NULL DEFAULT 5,
        carddeck_interval_seconds INTEGER NOT NULL DEFAULT 0,
        orientation TEXT NOT NULL DEFAULT 'landscape',
        ask_for_caption INTEGER NOT NULL DEFAULT 0,
        capture_location INTEGER NOT NULL DEFAULT 0
      )
    `);
    await markMigrationApplied(db, "create_photo_widget_settings_table");
  }

  // Which camera slideshow/carddeck's tap-to-capture uses — added after
  // the table above already existed for some installs, hence ensureColumn.
  await ensureColumn(db, "add_photo_settings_preferred_camera", "photo_widget_settings", "preferred_camera", "TEXT NOT NULL DEFAULT 'rear'");

  if (!(await isMigrationApplied(db, "create_photo_entries_table"))) {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS photo_entries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        widget_id INTEGER NOT NULL REFERENCES project_widgets(id) ON DELETE CASCADE,
        image_data TEXT NOT NULL,
        caption TEXT,
        latitude REAL,
        longitude REAL,
        taken_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        sort_order INTEGER NOT NULL DEFAULT 0
      )
    `);
    await markMigrationApplied(db, "create_photo_entries_table");
  }

  // Image Dock — free-drag/resize images within one widget's box,
  // percent-based coordinates so the layout holds up at any dock size.
  if (!(await isMigrationApplied(db, "create_dock_images_table"))) {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS dock_images (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        widget_id INTEGER NOT NULL REFERENCES project_widgets(id) ON DELETE CASCADE,
        image_data TEXT NOT NULL,
        x REAL NOT NULL DEFAULT 8,
        y REAL NOT NULL DEFAULT 8,
        width REAL NOT NULL DEFAULT 28,
        height REAL NOT NULL DEFAULT 28,
        z_index INTEGER NOT NULL DEFAULT 0
      )
    `);
    await markMigrationApplied(db, "create_dock_images_table");
  }

  // Rearrange mode's saved layouts (see components/RearrangeToolbar.tsx)
  // — a snapshot of one page's widget list (types + titles, optionally
  // content) that can be loaded back onto any page whose widget types
  // it's compatible with. `category` records where it was saved from
  // (e.g. "project", "goal") for the load browser's grouping — not an
  // access restriction, just organization.
  if (!(await isMigrationApplied(db, "create_saved_layouts_table"))) {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS saved_layouts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        category TEXT NOT NULL,
        include_content INTEGER NOT NULL DEFAULT 0,
        data_json TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await markMigrationApplied(db, "create_saved_layouts_table");
  }

  // A responsibility can belong to any number of goals (previously a
  // single responsibilities.goal_id FK) — this junction table replaces
  // that, backfilled below from whatever single links already existed.
  // The old column is left in place, unused, rather than dropped.
  if (!(await isMigrationApplied(db, "create_goal_responsibility_links_table"))) {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS goal_responsibility_links (
        goal_id INTEGER NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
        responsibility_id INTEGER NOT NULL REFERENCES responsibilities(id) ON DELETE CASCADE,
        PRIMARY KEY (goal_id, responsibility_id)
      )
    `);
    await db.execute(`
      INSERT OR IGNORE INTO goal_responsibility_links (goal_id, responsibility_id)
      SELECT goal_id, id FROM responsibilities WHERE goal_id IS NOT NULL
    `);
    await markMigrationApplied(db, "create_goal_responsibility_links_table");
  }

  // Likewise, a goal can attach to any number of dreams (previously a
  // single goals.dream_id FK) so it can render as more than one node on
  // the Dream Web — one per dream it's attached to. attach_angle/pos_x
  // are per-link, not per-goal, since each rendered instance sits at a
  // different spot relative to its own parent dream. Backfilled from
  // whatever single attachment already existed; goals.dream_id itself is
  // left in place afterward as the "originally created under" dream used
  // by other pages (Goals list, breadcrumbs) — it isn't kept in sync
  // with later Dream Web attach/detach actions.
  if (!(await isMigrationApplied(db, "create_goal_dream_links_table"))) {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS goal_dream_links (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        goal_id INTEGER NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
        dream_id INTEGER NOT NULL REFERENCES dreams(id) ON DELETE CASCADE,
        attach_angle REAL,
        pos_x REAL,
        UNIQUE(goal_id, dream_id)
      )
    `);
    await db.execute(`
      INSERT OR IGNORE INTO goal_dream_links (goal_id, dream_id, attach_angle, pos_x)
      SELECT id, dream_id, dream_attach_angle, pos_x FROM goals WHERE dream_id IS NOT NULL
    `);
    await markMigrationApplied(db, "create_goal_dream_links_table");
  }

  // Generalized field rearrangement (see rearrange/RearrangeModeContext.tsx
  // and db/fieldLayout.ts) — Project/Goal Detail pages used to render
  // their fields (Goals text, Reasoning, dates, the widget grid...) in a
  // fixed hardcoded order. This table makes that order per-owner and
  // draggable, same as the widget grid already was. A fresh owner has no
  // rows here yet — db/fieldLayout.ts lazily backfills the original
  // hardcoded order the first time it's read, so nothing regresses for
  // existing projects/goals. freetext_fields backs the one genuinely new
  // field kind this system adds (a plain label+textarea box, unlimited
  // per owner, unlike the fixed structured fields).
  if (!(await isMigrationApplied(db, "create_field_layout_table"))) {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS freetext_fields (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        label TEXT NOT NULL DEFAULT 'Notes',
        content TEXT NOT NULL DEFAULT ''
      )
    `);
    await db.execute(`
      CREATE TABLE IF NOT EXISTS field_layout (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        category TEXT NOT NULL,
        owner_id INTEGER NOT NULL,
        field_type TEXT NOT NULL,
        ref_id INTEGER,
        sort_order REAL NOT NULL
      )
    `);
    await markMigrationApplied(db, "create_field_layout_table");
  }

  // Notes — a Notion-lite workspace of pages (optionally nested,
  // grouped by a free-text category) each made of ordered blocks. See
  // db/notes.ts and pages/NotesPage.tsx.
  if (!(await isMigrationApplied(db, "create_notes_tables"))) {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS notes_pages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        parent_id INTEGER REFERENCES notes_pages(id) ON DELETE CASCADE,
        category TEXT NOT NULL DEFAULT 'General',
        title TEXT NOT NULL DEFAULT 'Untitled',
        icon TEXT NOT NULL DEFAULT '📄',
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await db.execute(`
      CREATE TABLE IF NOT EXISTS notes_blocks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        page_id INTEGER NOT NULL REFERENCES notes_pages(id) ON DELETE CASCADE,
        block_type TEXT NOT NULL DEFAULT 'paragraph',
        content TEXT NOT NULL DEFAULT '',
        checked INTEGER NOT NULL DEFAULT 0,
        sort_order INTEGER NOT NULL DEFAULT 0
      )
    `);
    await markMigrationApplied(db, "create_notes_tables");
  }

  // Notes editor rework: content moves from many notes_blocks rows to a
  // single Tiptap HTML document per page (see editor/NoteContentEditor.tsx).
  // notes_blocks is left in place, unread, after the one-time backfill —
  // this project has been burned by destructive migrations before
  // (commit 5b379d0), so nothing gets dropped.
  await ensureColumn(db, "add_notes_pages_content", "notes_pages", "content", "TEXT NOT NULL DEFAULT ''");
  if (!(await isMigrationApplied(db, "migrate_notes_blocks_to_content"))) {
    const pages = await db.select<{ id: number }[]>("SELECT id FROM notes_pages");
    for (const page of pages) {
      const blocks = await db.select<LegacyNoteBlockRow[]>(
        "SELECT block_type as blockType, content, checked FROM notes_blocks WHERE page_id = $1 ORDER BY sort_order",
        [page.id]
      );
      const html = notesBlocksToHtml(blocks);
      await db.execute("UPDATE notes_pages SET content = $1 WHERE id = $2", [html, page.id]);
    }
    await markMigrationApplied(db, "migrate_notes_blocks_to_content");
  }

  // Bugfix: fetchFieldLayout's lazy backfill (see db/fieldLayout.ts) was
  // a plain "if no rows, insert the defaults" check with no protection
  // against two concurrent calls both seeing zero rows and both
  // inserting — which React's StrictMode double-invoked effects made
  // easy to trigger in practice, leaving every singleton field (Goals,
  // Reasoning, the widget slot, etc.) duplicated for anyone who'd
  // already opened a project/goal/dream page. This dedupes existing
  // damage (keeping the lowest id per owner+field_type) and adds a
  // partial unique index so it can't happen again — see the now
  // "INSERT OR IGNORE" backfill/addBuiltinField in fieldLayout.ts.
  if (!(await isMigrationApplied(db, "dedupe_and_constrain_field_layout"))) {
    await db.execute(`
      DELETE FROM field_layout
      WHERE field_type != 'freetext'
      AND id NOT IN (
        SELECT MIN(id) FROM field_layout
        WHERE field_type != 'freetext'
        GROUP BY category, owner_id, field_type
      )
    `);
    await db.execute(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_field_layout_singleton
      ON field_layout(category, owner_id, field_type)
      WHERE field_type != 'freetext'
    `);
    await markMigrationApplied(db, "dedupe_and_constrain_field_layout");
  }

  // Rearrange mode overhaul: a field can now (1) have a user-renamed
  // header, (2) — Memory specifically — a custom saved box height, and
  // (3) sit paired to the right of another field instead of its own
  // full-width row. paired_with_id/pair_mode live on the *secondary*
  // (the one added "to the right"); no REFERENCES clause, same reasoning
  // as owner_id above — a plain app-level cross-reference, cleaned up by
  // hand (see fieldLayout.ts's removeField), not a real FK, so a
  // snapshot restore (rearrange/fieldUndo.ts) can freely re-insert rows
  // in any order without a dangling-reference window tripping
  // PRAGMA foreign_keys.
  await ensureColumn(db, "add_field_layout_custom_label", "field_layout", "custom_label", "TEXT");
  await ensureColumn(db, "add_field_layout_height_px", "field_layout", "height_px", "INTEGER");
  await ensureColumn(db, "add_field_layout_paired_with_id", "field_layout", "paired_with_id", "INTEGER");
  await ensureColumn(db, "add_field_layout_pair_mode", "field_layout", "pair_mode", "TEXT");

  // Per-page content/header style overrides (font size/color/corner
  // radius/border for a field's box, font size/color/bold/underline for
  // its header) — deliberately per field_layout row rather than a global
  // default, since the whole point (per the user's ask) is that the same
  // field type can look different from one project/goal/dream to the
  // next. Every column independently nullable = "inherit the default
  // look"; resetting just writes NULL back.
  await ensureColumn(db, "add_field_layout_content_font_size", "field_layout", "content_font_size", "INTEGER");
  await ensureColumn(db, "add_field_layout_content_color", "field_layout", "content_color", "TEXT");
  await ensureColumn(db, "add_field_layout_content_radius", "field_layout", "content_radius", "INTEGER");
  await ensureColumn(db, "add_field_layout_content_border_color", "field_layout", "content_border_color", "TEXT");
  await ensureColumn(db, "add_field_layout_content_border_width", "field_layout", "content_border_width", "INTEGER");
  await ensureColumn(db, "add_field_layout_header_font_size", "field_layout", "header_font_size", "INTEGER");
  await ensureColumn(db, "add_field_layout_header_color", "field_layout", "header_color", "TEXT");
  await ensureColumn(db, "add_field_layout_header_bold", "field_layout", "header_bold", "INTEGER");
  await ensureColumn(db, "add_field_layout_header_underline", "field_layout", "header_underline", "INTEGER");

  // A field's own box background — the "per field" half of Color Mode
  // (see FieldStylePopover.tsx's 🎨 control and
  // overlay/ColorModeHoverPopover.tsx's ctrl+hover editor for the same
  // surface). Same independently-nullable convention as every other
  // content_* column above: null means "use the page's field-background
  // default (Color Mode's global 'field' target)".
  await ensureColumn(db, "add_field_layout_content_background_color", "field_layout", "content_background_color", "TEXT");

  // Per-field "show this on the Dream/Goal/Project Web graph card"
  // toggle, plus a companion "show its header too" toggle — the
  // ctrl+hover-free, always-visible half of the same field_layout row
  // (see FieldStylePopover.tsx's new "On the web" section). Off by
  // default (0/NULL) so a fresh field never shows on the graph until the
  // user opts in — except the one-time backfill below, which preserves
  // the content that was always hardcoded-visible before this existed.
  await ensureColumn(db, "add_field_layout_show_on_web", "field_layout", "show_on_web", "INTEGER");
  await ensureColumn(db, "add_field_layout_web_header", "field_layout", "web_header", "INTEGER");

  if (!(await isMigrationApplied(db, "backfill_field_layout_show_on_web_defaults"))) {
    // Before this feature existed, GoalWebPage's goal card always showed
    // its "goals" text and ProjectWebPage's project card always showed
    // its "needs doing" text — flipping those two on by default keeps
    // existing webs looking the same after upgrading; everything else
    // stays opt-in.
    await db.execute(
      "UPDATE field_layout SET show_on_web = 1 WHERE category = 'goal' AND field_type = 'goals_text'"
    );
    await db.execute(
      "UPDATE field_layout SET show_on_web = 1 WHERE category = 'project' AND field_type = 'needs_doing_text'"
    );
    await markMigrationApplied(db, "backfill_field_layout_show_on_web_defaults");
  }

  // Generalized memory/history log for the portable "memory" field type
  // (see fieldLayout.ts's FieldType) — same shape as dream_history, but
  // keyed by category+owner_id like field_layout itself so it can back a
  // Memory field added to a Project or Goal, not just a Dream. Dream's
  // own built-in Memory field keeps reading dream_history unchanged;
  // this is additive, not a migration of existing dream data.
  if (!(await isMigrationApplied(db, "create_entity_history_table"))) {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS entity_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        category TEXT NOT NULL,
        owner_id INTEGER NOT NULL,
        field TEXT NOT NULL,
        old_value TEXT,
        new_value TEXT,
        reason TEXT,
        changed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await markMigrationApplied(db, "create_entity_history_table");
  }

  // Lets a Dream carry the same "rough single-day guess" start-date field
  // Projects/Goals already have (estimated_start_date) — the portable
  // half of "the start date in projects should be [addable elsewhere]".
  // Dream's own dated range (expected_date_start/end) is unrelated and
  // keeps its DreamWeb node-sizing side effect; this is just the extra,
  // optional field.
  await ensureColumn(db, "add_dreams_estimated_start_date", "dreams", "estimated_start_date", "TEXT");

  // Editor tool-surface settings (toolbar/context-menu/bubble-menu/slash
  // command on-off + input mode) — a small generic key/value store like
  // theme_settings, but deliberately separate from it: these aren't theme
  // concepts and shouldn't be swept into theme export/import/presets.
  if (!(await isMigrationApplied(db, "create_editor_settings_table"))) {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS editor_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )
    `);
    await markMigrationApplied(db, "create_editor_settings_table");
  }

  // Per-page background overrides for Color Mode (see
  // overlay/ColorModeSurfaceHighlighter.tsx) — ctrl+hovering a tagged
  // surface on a Project/Goal/Dream/Recipe detail page and picking a
  // color/image there should only affect that one page, unlike the
  // app-wide backgrounds in theme_settings. scope_key identifies the
  // owning page (e.g. "project:5"), surface_key identifies which
  // background on that page (currently just "page-bg", the page's own
  // root background) — composite key lets one page carry several
  // independently-colorable surfaces later without a schema change.
  if (!(await isMigrationApplied(db, "create_page_background_overrides_table"))) {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS page_background_overrides (
        scope_key TEXT NOT NULL,
        surface_key TEXT NOT NULL,
        color TEXT,
        image_data TEXT,
        tile TEXT,
        scale TEXT,
        PRIMARY KEY (scope_key, surface_key)
      )
    `);
    await markMigrationApplied(db, "create_page_background_overrides_table");
  }
}

// ---- Connection + schema setup -------------------------------------

export async function getDb(): Promise<Database> {
  if (dbInstance) return dbInstance;

  const db = await Database.load(DB_URL);

  // SQLite doesn't enforce foreign keys unless you turn it on per
  // connection. Without this, "ON DELETE CASCADE" below silently does
  // nothing and deleting a category would leave its recipes orphaned.
  await db.execute("PRAGMA foreign_keys = ON");

  await db.execute(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      sort_order INTEGER NOT NULL DEFAULT 0
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS recipes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      instructions TEXT NOT NULL DEFAULT '',
      sort_order INTEGER NOT NULL DEFAULT 0,
      image_data TEXT,
      is_frozen INTEGER NOT NULL DEFAULT 0,
      is_homegrown INTEGER NOT NULL DEFAULT 0,
      is_favorite INTEGER NOT NULL DEFAULT 0,
      is_proven INTEGER NOT NULL DEFAULT 0,
      parent_recipe_id INTEGER,
      iteration_difference TEXT,
      created_at TEXT,
      updated_at TEXT,
      display_id TEXT
    )
  `);

  await runMigrations(db);

  // Seed the four default categories the first time the DB is empty.
  // After this, categories are just normal rows the user can add to.
  const existing = await db.select<{ count: number }[]>(
    "SELECT COUNT(*) as count FROM categories"
  );
  if (existing[0].count === 0) {
    const defaults = ["Breakfast", "Lunch", "Dinner", "Dessert"];
    for (let i = 0; i < defaults.length; i++) {
      await db.execute(
        "INSERT INTO categories (name, sort_order) VALUES ($1, $2)",
        [defaults[i], i]
      );
    }
  }

  dbInstance = db;
  return db;
}
