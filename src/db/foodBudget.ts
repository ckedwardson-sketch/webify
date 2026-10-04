import Database from "@tauri-apps/plugin-sql";
import { ensureColumn, isMigrationApplied, markMigrationApplied, getDb } from "./database";
import { getCurrentDtcValue } from "./foodBudgetUtils";

// ---- Food Budget Database Schema and Migrations ----

export interface RecipeIngredient {
  id: number;
  recipe_id: number;
  ingredient_id: number | null;
  grams: number;
  original_unit_text: string;
  sort_order: number;
}

// ---- Recipe Ingredients Functions ----

/**
 * Gets all ingredients for a given recipe
 */
export async function getRecipeIngredients(recipeId: number): Promise<RecipeIngredient[]> {
  const db = await getDb();
  const ingredients = await db.select<RecipeIngredient[]>(
    `SELECT id, recipe_id, ingredient_id, grams, original_unit_text, sort_order
     FROM recipe_ingredients
     WHERE recipe_id = $1
     ORDER BY sort_order ASC`,
    [recipeId]
  );
  return ingredients;
}

/**
 * Sets all ingredients for a given recipe, replacing existing ones in a single transaction
 */
export async function setRecipeIngredients(recipeId: number, rows: RecipeIngredient[]): Promise<void> {
  const db = await getDb();
  
  await db.execute('BEGIN TRANSACTION');
  
  try {
    // Delete existing ingredients for this recipe
    await db.execute(
      'DELETE FROM recipe_ingredients WHERE recipe_id = $1',
      [recipeId]
    );
    
    // Insert new ingredients
    for (const row of rows) {
      await db.execute(
        `INSERT INTO recipe_ingredients 
         (recipe_id, ingredient_id, grams, original_unit_text, sort_order)
         VALUES ($1, $2, $3, $4, $5)`,
        [recipeId, row.ingredient_id, row.grams, row.original_unit_text, row.sort_order]
      );
    }
    
    await db.execute('COMMIT');
  } catch (error) {
    await db.execute('ROLLBACK');
    throw error;
  }
}

// ---- Recipe Cost and Source Bar Calculation Functions ----

/**
 * Calculates cost per serving for a recipe
 * @param recipeId - The ID of the recipe
 * @returns Cost per serving in dollars
 */
export async function calculateRecipeCostPerServing(recipeId: number): Promise<number> {
  const db = await getDb();
  
  // Get recipe details to get servings
  const recipeRows = await db.select<Array<{ servings: number }>>(
    'SELECT servings FROM recipes WHERE id = $1',
    [recipeId]
  );
  
  if (recipeRows.length === 0) {
    return 0;
  }
  
  const servings = recipeRows[0].servings || 1;
  
  // Get all ingredients for the recipe
  const recipeIngredients = await getRecipeIngredients(recipeId);
  
  let totalCost = 0;
  
  for (const ri of recipeIngredients) {
    if (ri.ingredient_id === null) {
      // Skip ingredients without an associated ingredient ID (plain text)
      continue;
    }
    
    // Get ingredient details
    const ingredientRows = await db.select<Array<{
      id: number;
      name: string;
      category: string;
      is_flavoring: number;
      homegrown_calories_per_dollar?: number;
      density_g_per_cup?: number;
    }>>('SELECT id, name, category, is_flavoring, homegrown_calories_per_dollar, density_g_per_cup FROM ingredients WHERE id = $1', [ri.ingredient_id]);
    
    if (ingredientRows.length === 0) {
      // Skip if ingredient doesn't exist
      continue;
    }
    
    const ingredient = ingredientRows[0];
    
    // Skip flavorings
    if (ingredient.is_flavoring === 1) {
      continue;
    }
    
    // Get the latest purchase price for this ingredient
    const purchaseRows = await db.select<Array<{
      price: number;
      amount_grams: number;
    }>>('SELECT price, amount_grams FROM purchases WHERE ingredient_id = $1 ORDER BY date DESC, id DESC LIMIT 1', [ri.ingredient_id]);
    
    if (purchaseRows.length > 0) {
      const purchase = purchaseRows[0];
      const pricePerGram = purchase.price / purchase.amount_grams;
      const ingredientCost = ri.grams * pricePerGram;
      totalCost += ingredientCost;
    } else {
      // If no purchase exists, check if it's a homegrown ingredient
      if (ingredient.homegrown_calories_per_dollar !== null && ingredient.homegrown_calories_per_dollar !== undefined) {
        // For homegrown ingredients, cost per gram = calories per gram / assigned calories per dollar
        // We need to get the calories per gram from nutrition data
        const caloriesPerGram = await getCaloriesPerGram(ingredient.id);
        if (caloriesPerGram !== null) {
          const costPerGram = caloriesPerGram / ingredient.homegrown_calories_per_dollar;
          const ingredientCost = ri.grams * costPerGram;
          totalCost += ingredientCost;
        }
      }
    }
  }
  
  // Calculate cost per serving
  return totalCost / servings;
}

/**
 * Helper function to get calories per gram for an ingredient
 * @param ingredientId - The ID of the ingredient
 * @returns Calories per gram or null if not available
 */
async function getCaloriesPerGram(ingredientId: number): Promise<number | null> {
  const db = await getDb();
  
  // Get the nutrition data
  const ingredientRows = await db.select<Array<{ nutrition_json: string }>>(
    'SELECT nutrition_json FROM ingredients WHERE id = $1',
    [ingredientId]
  );
  
  if (ingredientRows.length === 0 || !ingredientRows[0].nutrition_json) {
    return null;
  }
  
  try {
    const nutrition = JSON.parse(ingredientRows[0].nutrition_json);
    return nutrition.calories_per_100g ? nutrition.calories_per_100g / 100 : null;
  } catch (e) {
    return null;
  }
}

/**
 * Calculates source bar percentages for a recipe
 * @param recipeId - The ID of the recipe
 * @returns Object with source percentages
 */
export async function calculateRecipeSourceBar(recipeId: number): Promise<{
  adtcPercentage: number;
  homegrownPercentage: number;
  expensePercentage: number;
  unclassifiedPercentage: number;
}> {
  const db = await getDb();
  
  // Get all ingredients for the recipe
  const recipeIngredients = await getRecipeIngredients(recipeId);
  
  // Count ingredients by source type
  let adtcCount = 0;
  let homegrownCount = 0;
  let expenseCount = 0;
  let unclassifiedCount = 0;
  
  for (const ri of recipeIngredients) {
    if (ri.ingredient_id === null) {
      // Treat plain text ingredients as unclassified
      unclassifiedCount++;
      continue;
    }
    
    // Get ingredient details
    const ingredientRows = await db.select<Array<{
      id: number;
      name: string;
      category: string;
      is_flavoring: number;
      homegrown_calories_per_dollar?: number;
    }>>('SELECT id, name, category, is_flavoring, homegrown_calories_per_dollar FROM ingredients WHERE id = $1', [ri.ingredient_id]);
    
    if (ingredientRows.length === 0) {
      // Treat missing ingredients as unclassified
      unclassifiedCount++;
      continue;
    }
    
    const ingredient = ingredientRows[0];
    
    // Skip flavorings
    if (ingredient.is_flavoring === 1) {
      continue;
    }
    
    // Get the latest purchase price for this ingredient to determine classification
    const purchaseRows = await db.select<Array<{
      price: number;
      amount_grams: number;
      date: string;
    }>>('SELECT price, amount_grams, date FROM purchases WHERE ingredient_id = $1 ORDER BY date DESC, id DESC LIMIT 1', [ri.ingredient_id]);
    
    if (purchaseRows.length > 0) {
      const purchase = purchaseRows[0];
      const caloriesPerGram = await getCaloriesPerGram(ingredient.id);
      
      if (caloriesPerGram !== null) {
        const caloriesPerDollar = purchase.price / purchase.amount_grams / caloriesPerGram;
        const dtcValue = await getCurrentDtcValue();
        
        if (caloriesPerDollar >= dtcValue) {
          adtcCount++;
        } else {
          expenseCount++;
        }
      } else {
        unclassifiedCount++;
      }
    } else {
      // Check if it's a homegrown ingredient
      if (ingredient.homegrown_calories_per_dollar !== null && ingredient.homegrown_calories_per_dollar !== undefined) {
        homegrownCount++;
      } else {
        unclassifiedCount++;
      }
    }
  }
  
  // Calculate total
  const total = adtcCount + homegrownCount + expenseCount + unclassifiedCount;
  
  // Calculate percentages
  const adtcPercentage = total > 0 ? (adtcCount / total) * 100 : 0;
  const homegrownPercentage = total > 0 ? (homegrownCount / total) * 100 : 0;
  const expensePercentage = total > 0 ? (expenseCount / total) * 100 : 0;
  const unclassifiedPercentage = total > 0 ? (unclassifiedCount / total) * 100 : 0;
  
  return {
    adtcPercentage,
    homegrownPercentage,
    expensePercentage,
    unclassifiedPercentage
  };
}

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
        in_collection INTEGER NOT NULL DEFAULT 0,
        density_user_edited INTEGER NOT NULL DEFAULT 0,
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

  // Recipe ingredients table
  if (!(await isMigrationApplied(db, "create_recipe_ingredients_table"))) {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS recipe_ingredients (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        recipe_id INTEGER NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
        ingredient_id INTEGER REFERENCES ingredients(id) ON DELETE SET NULL,
        grams REAL,
        original_unit_text TEXT,
        sort_order INTEGER NOT NULL DEFAULT 0
      )
    `);
    await markMigrationApplied(db, "create_recipe_ingredients_table");
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
    await markMigrationApplied(db, "add_food_budget_columns_to_recipes");
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
      
      // Also seed dtc_history with the initial DTC value
      await db.execute(`
        INSERT INTO dtc_history (dtc_value, effective_date)
        VALUES (100.0, CURRENT_TIMESTAMP)
      `);
    }
    
    await markMigrationApplied(db, "seed_food_budget_settings");
  }
}

// ---- Meal Plan Functions ----

/**
 * Gets or creates a meal plan for a given month
 */
export async function getOrCreateMealPlan(month: string, mealsPerDay: number): Promise<{ id: number; month: string; mealsPerDay: number }> {
  const db = await getDb();
  
  // Try to find an existing meal plan for this month
  const existingPlans = await db.select<Array<{ id: number; month: string; mealsPerDay: number }>>(
    'SELECT id, month, mealsPerDay FROM meal_plans WHERE month = $1',
    [month]
  );
  
  if (existingPlans.length > 0) {
    return existingPlans[0];
  }
  
  // Create a new meal plan
  const result = await db.execute(
    'INSERT INTO meal_plans (month, meals_per_day) VALUES ($1, $2) RETURNING id',
    [month, mealsPerDay]
  );
  
  return {
    id: result.lastInsertId,
    month,
    mealsPerDay
  };
}

/**
 * Gets all meal plan entries for a given meal plan ID
 */
export async function getMealPlanEntries(mealPlanId: number): Promise<Array<{
  id: number;
  recipe_id: number;
  count: number;
}>> {
  const db = await getDb();
  const entries = await db.select<Array<{
    id: number;
    recipe_id: number;
    count: number;
  }>>('SELECT id, recipe_id, count FROM meal_plan_entries WHERE meal_plan_id = $1 ORDER BY id ASC', [mealPlanId]);
  return entries;
}

/**
 * Sets meal plan entries for a given meal plan, replacing existing ones in a single transaction
 */
export async function setMealPlanEntries(mealPlanId: number, entries: Array<{ recipe_id: number; count: number }>): Promise<void> {
  const db = await getDb();
  
  await db.execute('BEGIN TRANSACTION');
  
  try {
    // Delete existing entries for this meal plan
    await db.execute(
      'DELETE FROM meal_plan_entries WHERE meal_plan_id = $1',
      [mealPlanId]
    );
    
    // Insert new entries
    for (const entry of entries) {
      await db.execute(
        'INSERT INTO meal_plan_entries (meal_plan_id, recipe_id, count) VALUES ($1, $2, $3)',
        [mealPlanId, entry.recipe_id, entry.count]
      );
    }
    
    await db.execute('COMMIT');
  } catch (error) {
    await db.execute('ROLLBACK');
    throw error;
  }
}

/**
 * Calculates total planned servings for a meal plan
 */
export async function calculateTotalPlannedServings(mealPlanId: number): Promise<number> {
  const db = await getDb();
  
  // Get all entries for this meal plan
  const entries = await getMealPlanEntries(mealPlanId);
  
  let totalServings = 0;
  
  for (const entry of entries) {
    // Get recipe details to get servings
    const recipeRows = await db.select<Array<{ servings: number }>>(
      'SELECT servings FROM recipes WHERE id = $1',
      [entry.recipe_id]
    );
    
    if (recipeRows.length > 0) {
      const servings = recipeRows[0].servings || 1;
      totalServings += entry.count * servings;
    }
  }
  
  return totalServings;
}

/**
 * Calculates planned servings by recipe for a meal plan
 */
export async function calculatePlannedServingsByRecipe(mealPlanId: number): Promise<Array<{
  recipe_id: number;
  recipe_name: string;
  count: number;
  servings_per_recipe: number;
  total_servings: number;
}>> {
  const db = await getDb();
  
  // Get all entries for this meal plan
  const entries = await getMealPlanEntries(mealPlanId);
  
  const results = [];
  
  for (const entry of entries) {
    // Get recipe details
    const recipeRows = await db.select<Array<{ name: string; servings: number }>>(
      'SELECT name, servings FROM recipes WHERE id = $1',
      [entry.recipe_id]
    );
    
    if (recipeRows.length > 0) {
      const recipe = recipeRows[0];
      const totalServings = entry.count * (recipe.servings || 1);
      
      results.push({
        recipe_id: entry.recipe_id,
        recipe_name: recipe.name,
        count: entry.count,
        servings_per_recipe: recipe.servings || 1,
        total_servings: totalServings
      });
    }
  }
  
  return results;
}

/**
 * Calculates meal mix percentages by recipe for a meal plan
 */
export async function calculateMealMixPercentages(mealPlanId: number): Promise<Array<{
  recipe_id: number;
  recipe_name: string;
  percentage: number;
  total_servings: number;
}>> {
  const db = await getDb();
  
  // Get all entries for this meal plan
  const entries = await getMealPlanEntries(mealPlanId);
  
  // Get total servings
  const totalServings = await calculateTotalPlannedServings(mealPlanId);
  
  if (totalServings === 0) {
    return [];
  }
  
  const results = [];
  
  for (const entry of entries) {
    // Get recipe details
    const recipeRows = await db.select<Array<{ name: string; servings: number }>>(
      'SELECT name, servings FROM recipes WHERE id = $1',
      [entry.recipe_id]
    );
    
    if (recipeRows.length > 0) {
      const recipe = recipeRows[0];
      const totalServingsForRecipe = entry.count * (recipe.servings || 1);
      const percentage = (totalServingsForRecipe / totalServings) * 100;
      
      results.push({
        recipe_id: entry.recipe_id,
        recipe_name: recipe.name,
        percentage,
        total_servings: totalServingsForRecipe
      });
    }
  }
  
  return results;
}

/**
 * Calculates ingredient source mix percentages for a meal plan
 */
export async function calculateIngredientSourceMix(mealPlanId: number): Promise<{
  adtcPercentage: number;
  homegrownPercentage: number;
  expensePercentage: number;
  unclassifiedPercentage: number;
}> {
  const db = await getDb();
  
  // Get all entries for this meal plan
  const entries = await getMealPlanEntries(mealPlanId);
  
  // Count ingredients by source type
  let adtcCount = 0;
  let homegrownCount = 0;
  let expenseCount = 0;
  let unclassifiedCount = 0;
  
  for (const entry of entries) {
    // Get recipe ingredients
    const recipeIngredients = await getRecipeIngredients(entry.recipe_id);
    
    for (const ri of recipeIngredients) {
      if (ri.ingredient_id === null) {
        // Treat plain text ingredients as unclassified
        unclassifiedCount++;
        continue;
      }
      
      // Get ingredient details
      const ingredientRows = await db.select<Array<{
        id: number;
        name: string;
        category: string;
        is_flavoring: number;
        homegrown_calories_per_dollar?: number;
      }>>('SELECT id, name, category, is_flavoring, homegrown_calories_per_dollar FROM ingredients WHERE id = $1', [ri.ingredient_id]);
      
      if (ingredientRows.length === 0) {
        // Treat missing ingredients as unclassified
        unclassifiedCount++;
        continue;
      }
      
      const ingredient = ingredientRows[0];
      
      // Skip flavorings
      if (ingredient.is_flavoring === 1) {
        continue;
      }
      
      // Get the latest purchase price for this ingredient to determine classification
      const purchaseRows = await db.select<Array<{
        price: number;
        amount_grams: number;
        date: string;
      }>>('SELECT price, amount_grams, date FROM purchases WHERE ingredient_id = $1 ORDER BY date DESC, id DESC LIMIT 1', [ri.ingredient_id]);
      
      if (purchaseRows.length > 0) {
        const purchase = purchaseRows[0];
        const caloriesPerGram = await getCaloriesPerGram(ingredient.id);
        
        if (caloriesPerGram !== null) {
          const caloriesPerDollar = purchase.price / purchase.amount_grams / caloriesPerGram;
          const dtcValue = await getCurrentDtcValue();
          
          if (caloriesPerDollar >= dtcValue) {
            adtcCount++;
          } else {
            expenseCount++;
          }
        } else {
          unclassifiedCount++;
        }
      } else {
        // Check if it's a homegrown ingredient
        if (ingredient.homegrown_calories_per_dollar !== null && ingredient.homegrown_calories_per_dollar !== undefined) {
          homegrownCount++;
        } else {
          unclassifiedCount++;
        }
      }
    }
  }
  
  // Calculate total
  const total = adtcCount + homegrownCount + expenseCount + unclassifiedCount;
  
  // Calculate percentages
  const adtcPercentage = total > 0 ? (adtcCount / total) * 100 : 0;
  const homegrownPercentage = total > 0 ? (homegrownCount / total) * 100 : 0;
  const expensePercentage = total > 0 ? (expenseCount / total) * 100 : 0;
  const unclassifiedPercentage = total > 0 ? (unclassifiedCount / total) * 100 : 0;
  
  return {
    adtcPercentage,
    homegrownPercentage,
    expensePercentage,
    unclassifiedPercentage
  };
}

/**
 * Calculates cost breakdown for a meal plan
 */
export async function calculateMealPlanCostBreakdown(mealPlanId: number): Promise<{
  totalEstimatedCost: number;
  costPerMeal: number;
  costPerDay: number;
  mostExpensiveRecipe: { name: string; cost: number } | null;
  expenseIngredients: Array<{ name: string; cost: number }>;
  incompleteCostRecipes: Array<{ name: string }>;
}> {
  const db = await getDb();
  
  // Get all entries for this meal plan
  const entries = await getMealPlanEntries(mealPlanId);
  
  let totalEstimatedCost = 0;
  let totalServings = 0;
  let mostExpensiveRecipe = { name: '', cost: 0 };
  const expenseIngredients = [];
  const incompleteCostRecipes = [];
  
  for (const entry of entries) {
    // Get recipe details to get servings
    const recipeRows = await db.select<Array<{ name: string; servings: number }>>(
      'SELECT name, servings FROM recipes WHERE id = $1',
      [entry.recipe_id]
    );
    
    if (recipeRows.length === 0) {
      continue;
    }
    
    const recipe = recipeRows[0];
    const servings = recipe.servings || 1;
    const count = entry.count;
    const totalServingsForRecipe = count * servings;
    
    // Calculate cost for this recipe
    const recipeCost = await calculateRecipeCostPerServing(entry.recipe_id);
    const totalCostForRecipe = recipeCost * totalServingsForRecipe;
    
    // Check if this recipe has incomplete cost data
    if (recipeCost === 0) {
      incompleteCostRecipes.push({ name: recipe.name });
    }
    
    // Track the most expensive recipe
    if (totalCostForRecipe > mostExpensiveRecipe.cost) {
      mostExpensiveRecipe = { name: recipe.name, cost: totalCostForRecipe };
    }
    
    totalEstimatedCost += totalCostForRecipe;
    totalServings += totalServingsForRecipe;
  }
  
  // Calculate cost per meal and cost per day
  const costPerMeal = totalServings > 0 ? totalEstimatedCost / totalServings : 0;
  // For cost per day, we need to know how many days in the month
  // This is a simplified approach - in reality, we'd need to know the month
  
  // For now, we'll return what we can calculate
  return {
    totalEstimatedCost,
    costPerMeal,
    costPerDay: 0, // Need to determine based on month
    mostExpensiveRecipe: mostExpensiveRecipe.name ? mostExpensiveRecipe : null,
    expenseIngredients,
    incompleteCostRecipes
  };
}

// ---- Helper Functions ----

/**
 * Gets the current DTC (Dollar per Calorie) threshold value
 */
async function getCurrentDtcValue(): Promise<number> {
  const db = await getDb();
  
  const settings = await db.select<Array<{ dtc_threshold: number }>>(
    'SELECT dtc_threshold FROM food_budget_settings LIMIT 1'
  );
  
  if (settings.length > 0) {
    return settings[0].dtc_threshold;
  }
  
  // Default DTC value if not set
  return 0.1; // Adjust as needed
}

/**
 * Gets calories per gram for an ingredient
 */
async function getCaloriesPerGram(ingredientId: number): Promise<number | null> {
  const db = await getDb();
  
  // This is a simplified approach - in a real implementation, you'd need to
  // calculate or store calories per gram for ingredients
  const ingredient = await db.select<Array<{ calories_per_gram?: number }>>(
    'SELECT calories_per_gram FROM ingredients WHERE id = $1',
    [ingredientId]
  );
  
  if (ingredient.length > 0 && ingredient[0].calories_per_gram !== undefined) {
    return ingredient[0].calories_per_gram;
  }
  
  return null;
}

/**
 * Calculates the cost per serving for a recipe
 */
async function calculateRecipeCostPerServing(recipeId: number): Promise<number> {
  const db = await getDb();
  
  // Get recipe ingredients
  const recipeIngredients = await getRecipeIngredients(recipeId);
  
  let totalCost = 0;
  
  for (const ri of recipeIngredients) {
    if (ri.ingredient_id === null) {
      // Skip plain text ingredients for cost calculation
      continue;
    }
    
    // Get ingredient details
    const ingredientRows = await db.select<Array<{
      id: number;
      name: string;
      category: string;
      is_flavoring: number;
    }>>('SELECT id, name, category, is_flavoring FROM ingredients WHERE id = $1', [ri.ingredient_id]);
    
    if (ingredientRows.length === 0) {
      continue;
    }
    
    const ingredient = ingredientRows[0];
    
    // Skip flavorings
    if (ingredient.is_flavoring === 1) {
      continue;
    }
    
    // Get the latest purchase price for this ingredient
    const purchaseRows = await db.select<Array<{
      price: number;
      amount_grams: number;
      date: string;
    }>>('SELECT price, amount_grams, date FROM purchases WHERE ingredient_id = $1 ORDER BY date DESC, id DESC LIMIT 1', [ri.ingredient_id]);
    
    if (purchaseRows.length > 0) {
      const purchase = purchaseRows[0];
      // Calculate cost for the amount needed for this recipe ingredient
      const amountNeeded = ri.amount_grams || 0;
      const costPerGram = purchase.price / purchase.amount_grams;
      const costForAmount = costPerGram * amountNeeded;
      
      totalCost += costForAmount;
    }
  }
  
  // Get recipe servings
  const recipeRows = await db.select<Array<{ servings: number }>>(
    'SELECT servings FROM recipes WHERE id = $1',
    [recipeId]
  );
  
  const servings = recipeRows.length > 0 ? recipeRows[0].servings || 1 : 1;
  
  return totalCost / servings;
}

// --- Meal Plan Functions ---

/**
 * Gets or creates a meal plan for a specific month
 * @param month - The month in YYYY-MM format
 * @param mealsPerDay - Number of meals per day
 * @returns The meal plan object
 */
export async function getOrCreateMealPlan(month: string, mealsPerDay: number): Promise<{ id: number; month: string; mealsPerDay: number }> {
  const db = await getDb();
  
  // Try to find existing meal plan
  const existingPlans = await db.select<Array<{ id: number; month: string; mealsPerDay: number }>>(
    'SELECT id, month, mealsPerDay FROM meal_plans WHERE month = $1',
    [month]
  );
  
  if (existingPlans.length > 0) {
    return existingPlans[0];
  }
  
  // Create new meal plan
  const result = await db.execute(
    'INSERT INTO meal_plans (month, meals_per_day) VALUES ($1, $2) RETURNING id, month, mealsPerDay',
    [month, mealsPerDay]
  );
  
  return {
    id: result.lastInsertId,
    month: month,
    mealsPerDay: mealsPerDay
  };
}

/**
 * Gets all entries for a meal plan
 * @param mealPlanId - The ID of the meal plan
 * @returns Array of meal plan entries
 */
export async function getMealPlanEntries(mealPlanId: number): Promise<Array<{ id: number; recipe_id: number; count: number }>> {
  const db = await getDb();
  
  const entries = await db.select<Array<{ id: number; recipe_id: number; count: number }>>(
    'SELECT id, recipe_id, count FROM meal_plan_entries WHERE meal_plan_id = $1 ORDER BY id ASC',
    [mealPlanId]
  );
  
  return entries;
}

/**
 * Sets meal plan entries (replaces existing entries)
 * @param mealPlanId - The ID of the meal plan
 * @param entries - Array of recipe entries to set
 */
export async function setMealPlanEntries(mealPlanId: number, entries: Array<{ recipe_id: number; count: number }>): Promise<void> {
  const db = await getDb();
  
  // Delete existing entries
  await db.execute('DELETE FROM meal_plan_entries WHERE meal_plan_id = $1', [mealPlanId]);
  
  // Insert new entries
  for (const entry of entries) {
    await db.execute(
      'INSERT INTO meal_plan_entries (meal_plan_id, recipe_id, count) VALUES ($1, $2, $3)',
      [mealPlanId, entry.recipe_id, entry.count]
    );
  }
}

/**
 * Calculates meal mix percentages for a meal plan
 * @param mealPlanId - The ID of the meal plan
 * @returns Object with percentage breakdowns
 */
export async function calculateMealMixPercentages(mealPlanId: number): Promise<{
  adtcPercentage: number;
  homegrownPercentage: number;
  expensePercentage: number;
  unclassifiedPercentage: number;
}> {
  const db = await getDb();
  
  // Get all entries for this meal plan
  const entries = await getMealPlanEntries(mealPlanId);
  
  // Get recipe IDs from entries
  const recipeIds = entries.map(e => e.recipe_id);
  
  // Get recipe details for all recipes in the plan
  const recipes = await db.select<Array<{
    id: number;
    is_homegrown: number;
    is_expense: number;
  }>>('SELECT id, is_homegrown, is_expense FROM recipes WHERE id IN (' + recipeIds.join(',') + ')');
  
  // Count recipes by type
  let adtcCount = 0;
  let homegrownCount = 0;
  let expenseCount = 0;
  let unclassifiedCount = 0;
  
  for (const entry of entries) {
    const recipe = recipes.find(r => r.id === entry.recipe_id);
    
    if (!recipe) continue;
    
    if (recipe.is_homegrown === 1) {
      homegrownCount += entry.count;
    } else if (recipe.is_expense === 1) {
      expenseCount += entry.count;
    } else {
      // Check if recipe has DTC ingredients
      const recipeIngredients = await db.select<Array<{ ingredient_id: number }>>(
        'SELECT ingredient_id FROM recipe_ingredients WHERE recipe_id = $1 AND ingredient_id IS NOT NULL',
        [entry.recipe_id]
      );
      
      let hasDtcIngredient = false;
      for (const ri of recipeIngredients) {
        const ingredient = await db.select<Array<{ category: string }>>(
          'SELECT category FROM ingredients WHERE id = $1',
          [ri.ingredient_id]
        );
        
        if (ingredient.length > 0 && ingredient[0].category === 'DTC') {
          hasDtcIngredient = true;
          break;
        }
      }
      
      if (hasDtcIngredient) {
        adtcCount += entry.count;
      } else {
        unclassifiedCount += entry.count;
      }
    }
  }
  
  // Calculate totals
  const totalCount = adtcCount + homegrownCount + expenseCount + unclassifiedCount;
  
  // Return percentages (avoid division by zero)
  const adtcPercentage = totalCount > 0 ? (adtcCount / totalCount) * 100 : 0;
  const homegrownPercentage = totalCount > 0 ? (homegrownCount / totalCount) * 100 : 0;
  const expensePercentage = totalCount > 0 ? (expenseCount / totalCount) * 100 : 0;
  const unclassifiedPercentage = totalCount > 0 ? (unclassifiedCount / totalCount) * 100 : 0;
  
  return {
    adtcPercentage,
    homegrownPercentage,
    expensePercentage,
    unclassifiedPercentage
  };
}

/**
 * Calculates ingredient sources for a meal plan
 * @param mealPlanId - The ID of the meal plan
 * @returns Object with ingredient source breakdowns
 */
export async function calculateIngredientSources(mealPlanId: number): Promise<{
  homegrownCaloriesPerDollar: number;
  expenseCaloriesPerDollar: number;
  dtcCaloriesPerDollar: number;
  unclassifiedCaloriesPerDollar: number;
}> {
  const db = await getDb();
  
  // Get all entries for this meal plan
  const entries = await getMealPlanEntries(mealPlanId);
  
  // Get recipe IDs from entries
  const recipeIds = entries.map(e => e.recipe_id);
  
  // Get all ingredients for all recipes in the plan
  const recipeIngredients = await db.select<Array<{
    recipe_id: number;
    ingredient_id: number;
    grams: number;
  }>>('SELECT recipe_id, ingredient_id, grams FROM recipe_ingredients WHERE recipe_id IN (' + recipeIds.join(',') + ') AND ingredient_id IS NOT NULL');
  
  // Group by ingredient to calculate total amounts
  const ingredientTotals = new Map<number, number>(); // ingredient_id -> total grams
  
  for (const ri of recipeIngredients) {
    const existing = ingredientTotals.get(ri.ingredient_id) || 0;
    ingredientTotals.set(ri.ingredient_id, existing + (ri.grams || 0));
  }
  
  // Get ingredient details and calculate calories per dollar
  let homegrownCaloriesPerDollar = 0;
  let expenseCaloriesPerDollar = 0;
  let dtcCaloriesPerDollar = 0;
  let unclassifiedCaloriesPerDollar = 0;
  
  let totalHomegrownCalories = 0;
  let totalHomegrownDollars = 0;
  let totalExpenseCalories = 0;
  let totalExpenseDollars = 0;
  let totalDtcCalories = 0;
  let totalDtcDollars = 0;
  let totalUnclassifiedCalories = 0;
  let totalUnclassifiedDollars = 0;
  
  for (const [ingredientId, totalGrams] of ingredientTotals.entries()) {
    // Get ingredient details
    const ingredientRows = await db.select<Array<{
      name: string;
      category: string;
      is_flavoring: number;
      homegrown_calories_per_dollar: number;
    }>>('SELECT name, category, is_flavoring, homegrown_calories_per_dollar FROM ingredients WHERE id = $1', [ingredientId]);
    
    if (ingredientRows.length === 0) continue;
    
    const ingredient = ingredientRows[0];
    
    // Skip flavorings
    if (ingredient.is_flavoring === 1) continue;
    
    // Get the latest purchase price for this ingredient
    const purchaseRows = await db.select<Array<{
      price: number;
      amount_grams: number;
    }>>('SELECT price, amount_grams FROM purchases WHERE ingredient_id = $1 ORDER BY date DESC, id DESC LIMIT 1', [ingredientId]);
    
    if (purchaseRows.length === 0) continue;
    
    const purchase = purchaseRows[0];
    const costPerGram = purchase.price / purchase.amount_grams;
    const totalCost = costPerGram * totalGrams;
    
    // Get calories per gram from nutrition data
    const caloriesPerGram = 0; // This would need to come from nutrition data
    
    // Determine ingredient source category
    if (ingredient.category === 'homegrown') {
      const caloriesPerDollar = ingredient.homegrown_calories_per_dollar || 0;
      totalHomegrownCalories += caloriesPerGram * totalGrams;
      totalHomegrownDollars += totalCost;
      homegrownCaloriesPerDollar = totalHomegrownCalories / totalHomegrownDollars;
    } else if (ingredient.category === 'expense') {
      totalExpenseCalories += caloriesPerGram * totalGrams;
      totalExpenseDollars += totalCost;
      expenseCaloriesPerDollar = totalExpenseCalories / totalExpenseDollars;
    } else if (ingredient.category === 'DTC') {
      totalDtcCalories += caloriesPerGram * totalGrams;
      totalDtcDollars += totalCost;
      dtcCaloriesPerDollar = totalDtcCalories / totalDtcDollars;
    } else {
      totalUnclassifiedCalories += caloriesPerGram * totalGrams;
      totalUnclassifiedDollars += totalCost;
      unclassifiedCaloriesPerDollar = totalUnclassifiedCalories / totalUnclassifiedDollars;
    }
  }
  
  return {
    homegrownCaloriesPerDollar,
    expenseCaloriesPerDollar,
    dtcCaloriesPerDollar,
    unclassifiedCaloriesPerDollar
  };
}

export { runFoodBudgetMigrations };