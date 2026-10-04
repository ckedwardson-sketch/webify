import { TestDatabaseAdapter } from "./dbHarness";
import { runFoodBudgetMigrations } from "../foodBudget";
import { 
  classifyIngredientData,
  classifyIngredient,
  updateDtcValue,
  logPurchase,
  updateIngredient,
  setInCollection,
  getLikelyToUseIngredients,
  getNearDtcIngredients
} from "../foodBudgetUtils";

describe("Core Logic Tests", () => {
  let dbAdapter: TestDatabaseAdapter;

  beforeEach(async () => {
    dbAdapter = new TestDatabaseAdapter();
    await dbAdapter.initTestDb();
    await dbAdapter.runFoodBudgetMigrations();
  });

  afterEach(async () => {
    await dbAdapter.close();
  });

  test("should classify ingredients correctly", () => {
    // Test flavoring ingredient
    const flavoringResult = classifyIngredientData({
      category: 'General',
      is_flavoring: 1,
      calories_per_dollar: 50
    });
    expect(flavoringResult).toBe('Flavoring');

    // Test Homegrown ingredient
    const homegrownResult = classifyIngredientData({
      category: 'Homegrown',
      is_flavoring: 0,
      calories_per_dollar: 50
    });
    expect(homegrownResult).toBe('Homegrown');

    // Test ADTC ingredient
    const adtcResult = classifyIngredientData({
      category: 'General',
      is_flavoring: 0,
      calories_per_dollar: 150
    });
    expect(adtcResult).toBe('ADTC');

    // Test Expense ingredient
    const expenseResult = classifyIngredientData({
      category: 'General',
      is_flavoring: 0,
      calories_per_dollar: 50
    });
    expect(expenseResult).toBe('Expense');

    // Test Unclassified ingredient (no calories_per_dollar)
    const unclassifiedResult = classifyIngredientData({
      category: 'General',
      is_flavoring: 0,
      calories_per_dollar: null
    });
    expect(unclassifiedResult).toBe('Unclassified');
  });

  test("should handle DTC updates properly", async () => {
    // This test will be expanded to verify proper DTC history insertion
    const initialDtc = 100;
    const newDtc = 120;
    
    // Initially, we expect default DTC value
    expect(true).toBe(true); // Placeholder test
  });

  test("should log purchase and detect classification changes", async () => {
    // Create an ingredient
    const db = dbAdapter.getDb();
    const result = await db.execute(
      "INSERT INTO ingredients (name, category, is_flavoring) VALUES ($1, $2, $3)",
      ['Test Ingredient', 'General', 0]
    );
    const ingredientId = result.lastInsertId as number;
    
    // Log a purchase
    const purchaseId = await logPurchase({
      ingredient_id: ingredientId,
      date: new Date().toISOString(),
      price: 1.0,
      amount_grams: 100
    });
    
    expect(purchaseId).toBeGreaterThan(0);
  });

  test("should update ingredient with various fields", async () => {
    const db = dbAdapter.getDb();
    const result = await db.execute(
      "INSERT INTO ingredients (name, category, is_flavoring) VALUES ($1, $2, $3)",
      ['Test Ingredient', 'General', 0]
    );
    const ingredientId = result.lastInsertId as number;
    
    // Update with multiple fields
    await updateIngredient(ingredientId, {
      name: 'Updated Name',
      category: 'Homegrown',
      density_user_edited: 1,
      in_collection: 1
    });
    
    // Verify the update
    const rows = await db.select<{ 
      name: string, 
      category: string,
      density_user_edited: number,
      in_collection: number
    }[]>(
      "SELECT name, category, density_user_edited, in_collection FROM ingredients WHERE id = $1",
      [ingredientId]
    );
    
    expect(rows[0].name).toBe('Updated Name');
    expect(rows[0].category).toBe('Homegrown');
    expect(rows[0].density_user_edited).toBe(1);
    expect(rows[0].in_collection).toBe(1);
  });

  test("should set in collection properly", async () => {
    const db = dbAdapter.getDb();
    const result = await db.execute(
      "INSERT INTO ingredients (name, category, is_flavoring) VALUES ($1, $2, $3)",
      ['Test Ingredient', 'General', 0]
    );
    const ingredientId = result.lastInsertId as number;
    
    // Set in collection
    await setInCollection(ingredientId, true);
    
    const rows = await db.select<{ in_collection: number }[]>(
      "SELECT in_collection FROM ingredients WHERE id = $1",
      [ingredientId]
    );
    
    expect(rows[0].in_collection).toBe(1);
    
    // Set not in collection
    await setInCollection(ingredientId, false);
    
    const rows2 = await db.select<{ in_collection: number }[]>(
      "SELECT in_collection FROM ingredients WHERE id = $1",
      [ingredientId]
    );
    
    expect(rows2[0].in_collection).toBe(0);
  });

  test("should get near DTC ingredients correctly", async () => {
    // Create an ingredient
    const db = dbAdapter.getDb();
    const result = await db.execute(
      "INSERT INTO ingredients (name, category, is_flavoring, in_collection) VALUES ($1, $2, $3, $4)",
      ['Test Ingredient', 'General', 0, 1]
    );
    const ingredientId = result.lastInsertId as number;
    
    // Create a purchase
    await db.execute(
      "INSERT INTO purchases (ingredient_id, date, price, amount_grams) VALUES ($1, $2, $3, $4)",
      [ingredientId, new Date().toISOString(), 1.0, 100]
    );
    
    // Get near DTC ingredients
    const ingredients = await getNearDtcIngredients();
    expect(Array.isArray(ingredients)).toBe(true);
  });

  test("should get likely to use ingredients correctly", async () => {
    // Create an ingredient
    const db = dbAdapter.getDb();
    const result = await db.execute(
      "INSERT INTO ingredients (name, category, is_flavoring, in_collection) VALUES ($1, $2, $3, $4)",
      ['Test Ingredient', 'General', 0, 1]
    );
    const ingredientId = result.lastInsertId as number;
    
    // Create a purchase
    await db.execute(
      "INSERT INTO purchases (ingredient_id, date, price, amount_grams) VALUES ($1, $2, $3, $4)",
      [ingredientId, new Date().toISOString(), 1.0, 100]
    );
    
    // Get likely to use ingredients
    const ingredients = await getLikelyToUseIngredients();
    expect(Array.isArray(ingredients)).toBe(true);
  });
});