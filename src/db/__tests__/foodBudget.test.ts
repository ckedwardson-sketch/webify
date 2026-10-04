import { TestDatabaseAdapter } from "./dbHarness";
import { runFoodBudgetMigrations } from "../foodBudget";
import { initDb } from "../database";
import { createIngredient, classifyIngredient } from "../foodBudgetUtils";

describe("Food Budget Tests", () => {
  let dbAdapter: TestDatabaseAdapter;

  beforeEach(async () => {
    dbAdapter = new TestDatabaseAdapter();
    await dbAdapter.initTestDb();
  });

  afterEach(async () => {
    await dbAdapter.close();
  });

  test("should run migrations on empty database and create all tables", async () => {
    await dbAdapter.runFoodBudgetMigrations();
    
    const db = dbAdapter.getDb();
    
    // Check that all expected tables exist
    const tables = [
      "food_budget_settings",
      "dtc_history", 
      "ingredients",
      "recipe_ingredients",
      "purchases",
      "deals",
      "meal_plans",
      "meal_plan_entries",
      "notifications"
    ];
    
    for (const tableName of tables) {
      const result = await db.select<{ name: string }[]>(
        `SELECT name FROM sqlite_master WHERE type = 'table' AND name = $1`,
        [tableName]
      );
      expect(result.length).toBeGreaterThan(0);
    }
  });

  test("should run migrations twice and be idempotent", async () => {
    await dbAdapter.runFoodBudgetMigrations();
    await dbAdapter.runFoodBudgetMigrations(); // Run again
    
    const db = dbAdapter.getDb();
    
    // Check that tables still exist (idempotent)
    const result = await db.select<{ name: string }[]>(
      `SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'ingredients'`
    );
    expect(result.length).toBeGreaterThan(0);
  });

  test("should create an ingredient and classify it without throwing", async () => {
    await dbAdapter.runFoodBudgetMigrations();
    
    const db = dbAdapter.getDb();
    
    // Insert a basic ingredient
    const ingredientId = await createIngredient({
      name: "Test Ingredient",
      category: "general",
      is_flavoring: 0
    });
    
    // Should not throw
    const classification = await classifyIngredient(ingredientId);
    expect(classification).toBeDefined();
  });
});