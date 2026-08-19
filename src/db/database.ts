import Database from "@tauri-apps/plugin-sql";

const DB_URL = "sqlite:webify.db";

let dbInstance: Database | null = null;

// Loads (or reuses) the single SQLite connection and makes sure the
// tables we need exist. Safe to call repeatedly — CREATE TABLE IF NOT
// EXISTS is a no-op once the tables are already there.
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
      sort_order INTEGER NOT NULL DEFAULT 0
    )
  `);

  // Migration for anyone who already had a recipes table from before
  // sort_order existed. SQLite has no "ADD COLUMN IF NOT EXISTS", so we
  // just try it and ignore the error if the column is already there.
  try {
    await db.execute(
      "ALTER TABLE recipes ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0"
    );
  } catch {
    // Column already exists — nothing to do.
  }

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
