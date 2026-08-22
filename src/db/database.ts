import Database from "@tauri-apps/plugin-sql";

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
