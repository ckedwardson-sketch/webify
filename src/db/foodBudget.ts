import Database from "@tauri-apps/plugin-sql";
import { ensureColumn, isMigrationApplied, markMigrationApplied } from "./database";

// ---- Food Budget Database Schema and Migrations ----

async function runFoodBudgetMigrations(db: Database): Promise<void> {
  // Settings table with DTC history
  if (!(await isMigrationApplied(db, "create_food_budget_settings_table"))) {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS food_budget_settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        dtc_value REAL NOT NULL DEFAULT 0,
        inflation_rate REAL NOT NULL DEFAULT 0,
        notification_mode TEXT NOT NULL DEFAULT 'urgent',
        warning_days INTEGER NOT NULL DEFAULT 0,
        warning_weeks INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Create a trigger to update the updated_at timestamp
    await db.execute(`
      CREATE TRIGGER IF NOT EXISTS trg_food_budget_settings_updated_at
      AFTER UPDATE ON food_budget_settings
      BEGIN
        UPDATE food_budget_settings SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
      END;
    `);
    
    await markMigrationApplied(db, "create_food_budget_settings_table");
  }

  // DTC History table
  if (!(await isMigrationApplied(db, "create_dtc_history_table"))) {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS dtc_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        dtc_value REAL NOT NULL,
        effective_date TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await markMigrationApplied(db, "create_dtc_history_table");
  }

  // Ingredients table
  if (!(await isMigrationApplied(db, "create_ingredients_table"))) {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS ingredients (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        category TEXT NOT NULL DEFAULT 'general',
        is_flavoring INTEGER NOT NULL DEFAULT 0,
        density_g_per_cup REAL,
        nutrition_json TEXT,
        health_blurb TEXT,
        homegrown_calories_per_dollar REAL,
        in_collection INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Create a trigger to update the updated_at timestamp
    await db.execute(`
      CREATE TRIGGER IF NOT EXISTS trg_ingredients_updated_at
      AFTER UPDATE ON ingredients
      BEGIN
        UPDATE ingredients SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
      END;
    `);
    
    await markMigrationApplied(db, "create_ingredients_table");
  }

  // Purchases table
  if (!(await isMigrationApplied(db, "create_purchases_table"))) {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS purchases (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ingredient_id INTEGER NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
        date TEXT NOT NULL,
        price REAL NOT NULL,
        amount_grams REAL NOT NULL,
        store TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await markMigrationApplied(db, "create_purchases_table");
  }

  // Deals table
  if (!(await isMigrationApplied(db, "create_deals_table"))) {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS deals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ingredient_id INTEGER NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
        type TEXT NOT NULL,
        type_specific_json TEXT,
        image_paths TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await markMigrationApplied(db, "create_deals_table");
  }

  // Recipes table with food budget additions
  if (!(await isMigrationApplied(db, "add_food_budget_columns_to_recipes"))) {
    await ensureColumn(db, "add_food_budget_recipe_columns", "recipes", "cost_per_serving", "REAL");
    await ensureColumn(db, "add_food_budget_recipe_columns", "recipes", "source_breakdown", "TEXT");
    await markMigrationApplied(db, "add_food_budget_columns_to_recipes");
  }

  // Recipe ingredients table with food budget additions
  if (!(await isMigrationApplied(db, "add_food_budget_columns_to_recipe_ingredients"))) {
    await ensureColumn(db, "add_recipe_ingredient_dtc_flags", "recipe_ingredients", "is_homegrown", "INTEGER NOT NULL DEFAULT 0");
    await ensureColumn(db, "add_recipe_ingredient_dtc_flags", "recipe_ingredients", "is_expense", "INTEGER NOT NULL DEFAULT 0");
    await markMigrationApplied(db, "add_food_budget_columns_to_recipe_ingredients");
  }

  // Meal plans table
  if (!(await isMigrationApplied(db, "create_meal_plans_table"))) {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS meal_plans (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        month TEXT NOT NULL,
        meals_per_day INTEGER NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Create a trigger to update the updated_at timestamp
    await db.execute(`
      CREATE TRIGGER IF NOT EXISTS trg_meal_plans_updated_at
      AFTER UPDATE ON meal_plans
      BEGIN
        UPDATE meal_plans SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
      END;
    `);
    
    await markMigrationApplied(db, "create_meal_plans_table");
  }

  // Meal plan entries table
  if (!(await isMigrationApplied(db, "create_meal_plan_entries_table"))) {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS meal_plan_entries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        meal_plan_id INTEGER NOT NULL REFERENCES meal_plans(id) ON DELETE CASCADE,
        recipe_id INTEGER NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
        count INTEGER NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await markMigrationApplied(db, "create_meal_plan_entries_table");
  }

  // Notifications table
  if (!(await isMigrationApplied(db, "create_notifications_table"))) {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL,
        ingredient_id INTEGER,
        message TEXT NOT NULL,
        read_flag INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        warning_stage TEXT
      )
    `);
    await markMigrationApplied(db, "create_notifications_table");
  }

  // Ensure the food_budget_settings table has a default row
  if (!(await isMigrationApplied(db, "seed_food_budget_settings"))) {
    const count = await db.select<{ count: number }[]>(
      "SELECT COUNT(*) as count FROM food_budget_settings"
    );
    
    if (count[0].count === 0) {
      await db.execute(`
        INSERT INTO food_budget_settings (dtc_value, inflation_rate, notification_mode, warning_days, warning_weeks)
        VALUES (100.0, 0.02, 'urgent', 0, 0)
      `);
    }
    
    await markMigrationApplied(db, "seed_food_budget_settings");
  }
}

export { runFoodBudgetMigrations };