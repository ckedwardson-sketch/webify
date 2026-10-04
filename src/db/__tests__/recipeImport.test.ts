import { TestDatabaseAdapter } from "./dbHarness";
import { runFoodBudgetMigrations } from "../foodBudget";
import { initDb } from "../database";
import { parseIngredientLine, matchIngredient, getDensityForIngredient, convertLineToGrams, processIngredientLine } from "../recipeImport";
import { createIngredient } from "../foodBudgetUtils";

describe("Recipe Import Tests", () => {
  let dbAdapter: TestDatabaseAdapter;

  beforeEach(async () => {
    dbAdapter = new TestDatabaseAdapter();
    await dbAdapter.initTestDb();
    await dbAdapter.runFoodBudgetMigrations();
  });

  afterEach(async () => {
    await dbAdapter.close();
  });

  test("should parse ingredient lines correctly", () => {
    // Test basic parsing
    expect(parseIngredientLine("2 cups flour")).toEqual({
      amount: 2,
      unit: "cups",
      name: "flour",
      isToTaste: false
    });

    // Test fractions
    expect(parseIngredientLine("1/2 cup sugar")).toEqual({
      amount: 0.5,
      unit: "cup",
      name: "sugar",
      isToTaste: false
    });

    // Test mixed numbers
    expect(parseIngredientLine("1 1/2 cups milk")).toEqual({
      amount: 1.5,
      unit: "cups",
      name: "milk",
      isToTaste: false
    });

    // Test ranges
    expect(parseIngredientLine("2-3 eggs")).toEqual({
      amount: 2.5,
      unit: "",
      name: "eggs",
      isToTaste: false
    });

    // Test "to taste"
    expect(parseIngredientLine("salt to taste")).toEqual({
      amount: 0,
      unit: "",
      name: "to taste",
      isToTaste: true
    });

    // Test parenthetical notes
    expect(parseIngredientLine("1 cup rice (uncooked)")).toEqual({
      amount: 1,
      unit: "cup",
      name: "rice",
      isToTaste: false
    });
  });

  test("should match ingredients with confidence", async () => {
    // Create a test ingredient
    const ingredientId = await createIngredient({
      name: "Rice, cooked",
      category: "grains",
      is_flavoring: 0
    });

    const existingIngredients = [{
      id: ingredientId,
      name: "Rice, cooked"
    }];

    // Test exact match
    const result1 = await matchIngredient("cooked rice", existingIngredients);
    expect(result1.matchedIngredientId).toBe(ingredientId);
    expect(result1.confidence).toBeGreaterThanOrEqual(0.8);

    // Test similar match
    const result2 = await matchIngredient("rice, cooked", existingIngredients);
    expect(result2.matchedIngredientId).toBe(ingredientId);
    expect(result2.confidence).toBeGreaterThanOrEqual(0.8);
  });

  test("should detect form mismatches", async () => {
    // Create a test ingredient with a form
    const ingredientId = await createIngredient({
      name: "Rice, dry",
      category: "grains",
      is_flavoring: 0
    });

    const existingIngredients = [{
      id: ingredientId,
      name: "Rice, dry"
    }];

    // Test form mismatch
    const result = await matchIngredient("cooked rice", existingIngredients);
    expect(result.formMismatch).toBe(true);
    expect(result.matchedIngredientId).toBeNull();
  });

  test("should get density for ingredients", async () => {
    // Test with an ingredient that has density in our lookup table
    const density = await getDensityForIngredient(null, "rice");
    expect(density).toBe(180);

    // Test with an ingredient that doesn't have density
    const noDensity = await getDensityForIngredient(null, "unknown ingredient");
    expect(noDensity).toBeNull();
  });

  test("should convert lines to grams", async () => {
    // Test with a known density ingredient
    const grams = await convertLineToGrams("1 cup rice", null, "rice");
    expect(grams).toBeCloseTo(180, 0); // 1 cup rice = 180g

    // Test with grams unit
    const grams2 = await convertLineToGrams("200g flour", null, "flour");
    expect(grams2).toBe(200);
  });

  test("should process ingredient lines with various outcomes", async () => {
    // Create a test ingredient
    const ingredientId = await createIngredient({
      name: "Rice, cooked",
      category: "grains",
      is_flavoring: 0
    });

    // Test exact match
    const result1 = await processIngredientLine("cooked rice");
    expect(result1.action).toBe("match");
    expect(result1.ingredientId).toBe(ingredientId);

    // Test form mismatch
    const ingredientId2 = await createIngredient({
      name: "Rice, dry",
      category: "grains",
      is_flavoring: 0
    });

    const result2 = await processIngredientLine("cooked rice");
    expect(result2.action).toBe("suggest_create");
  });
});