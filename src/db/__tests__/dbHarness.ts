import Database from "@tauri-apps/plugin-sql";
import { runFoodBudgetMigrations } from "../foodBudget";
import { initDb } from "../database";

/**
 * A test database adapter that uses a temporary in-memory SQLite database
 * to run migrations and tests without affecting the real database.
 */
export class TestDatabaseAdapter {
  private db: Database | null = null;

  constructor() {
    // Nothing to initialize for now
  }

  /**
   * Initialize a test database in memory
   */
  async initTestDb(): Promise<Database> {
    // For testing, we'll use an in-memory database
    const db = await Database.load("sqlite::memory:");
    
    // Enable foreign keys for testing consistency
    await db.execute("PRAGMA foreign_keys = ON");
    
    // Initialize the database structure
    await db.execute(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name TEXT PRIMARY KEY,
        applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Initialize food_budget_settings with default DTC value
    await db.execute(`
      CREATE TABLE IF NOT EXISTS food_budget_settings (
        id INTEGER PRIMARY KEY,
        dtc_value REAL NOT NULL DEFAULT 100.0
      )
    `);
    
    // Insert default settings row if it doesn't exist
    const settingsRows = await db.select<{ id: number }[]>(
      "SELECT id FROM food_budget_settings WHERE id = 1"
    );
    
    if (settingsRows.length === 0) {
      await db.execute(
        "INSERT INTO food_budget_settings (id, dtc_value) VALUES (1, 100.0)"
      );
    }
    
    this.db = db;
    return db;
  }

  /**
   * Run food budget migrations on the test database
   */
  async runFoodBudgetMigrations(): Promise<void> {
    if (!this.db) {
      throw new Error("Database not initialized");
    }
    await runFoodBudgetMigrations(this.db);
  }

  /**
   * Get the test database instance
   */
  getDb(): Database {
    if (!this.db) {
      throw new Error("Database not initialized");
    }
    return this.db;
  }

  /**
   * Close the test database connection
   */
  async close(): Promise<void> {
    if (this.db) {
      await this.db.close();
      this.db = null;
    }
  }
}