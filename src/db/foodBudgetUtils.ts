import { getDb } from "./database";

// ---- Food Budget Utility Functions ----

/**
 * Get current DTC (Dollar-to-Calorie) value
 */
export async function getCurrentDtcValue(): Promise<number> {
  const db = await getDb();
  const rows = await db.select<{ dtc_value: number }[]>(
    "SELECT dtc_value FROM food_budget_settings WHERE id = 1"
  );
  
  if (rows.length > 0) {
    return rows[0].dtc_value;
  }
  
  // Return default value if no settings found
  return 100.0;
}

/**
 * Update DTC value and save to history
 */
export async function updateDtcValue(newValue: number): Promise<void> {
  const db = await getDb();
  
  // Save current value to history
  const currentValue = await getCurrentDtcValue();
  await db.execute(
    "INSERT INTO dtc_history (dtc_value, effective_date) VALUES ($1, CURRENT_TIMESTAMP)",
    [currentValue]
  );
  
  // Update current setting
  await db.execute(
    "UPDATE food_budget_settings SET dtc_value = $1 WHERE id = 1",
    [newValue]
  );
}

/**
 * Get DTC history
 */
export async function getDtcHistory(): Promise<Array<{id: number, dtc_value: number, effective_date: string}>> {
  const db = await getDb();
  const rows = await db.select<{ id: number, dtc_value: number, effective_date: string }[]>(
    "SELECT id, dtc_value, effective_date FROM dtc_history ORDER BY effective_date DESC"
  );
  return rows;
}

/**
 * Get all ingredients
 */
export async function getAllIngredients(): Promise<Array<{
  id: number,
  name: string,
  category: string,
  is_flavoring: number,
  density_g_per_cup?: number,
  nutrition_json?: string,
  health_blurb?: string,
  homegrown_calories_per_dollar?: number,
  in_collection: number
}>> {
  const db = await getDb();
  const rows = await db.select<{
    id: number,
    name: string,
    category: string,
    is_flavoring: number,
    density_g_per_cup?: number,
    nutrition_json?: string,
    health_blurb?: string,
    homegrown_calories_per_dollar?: number,
    in_collection: number
  }[]>(
    "SELECT id, name, category, is_flavoring, density_g_per_cup, nutrition_json, health_blurb, homegrown_calories_per_dollar, in_collection FROM ingredients ORDER BY name"
  );
  return rows;
}

/**
 * Get ingredients by category
 */
export async function getIngredientsByCategory(category: string): Promise<Array<{
  id: number,
  name: string,
  category: string,
  is_flavoring: number,
  density_g_per_cup?: number,
  nutrition_json?: string,
  health_blurb?: string,
  homegrown_calories_per_dollar?: number,
  in_collection: number
}>> {
  const db = await getDb();
  const rows = await db.select<{
    id: number,
    name: string,
    category: string,
    is_flavoring: number,
    density_g_per_cup?: number,
    nutrition_json?: string,
    health_blurb?: string,
    homegrown_calories_per_dollar?: number,
    in_collection: number
  }[]>(
    "SELECT id, name, category, is_flavoring, density_g_per_cup, nutrition_json, health_blurb, homegrown_calories_per_dollar, in_collection FROM ingredients WHERE category = $1 ORDER BY name",
    [category]
  );
  return rows;
}

/**
 * Get ingredient by ID
 */
export async function getIngredientById(id: number): Promise<{
  id: number,
  name: string,
  category: string,
  is_flavoring: number,
  density_g_per_cup?: number,
  nutrition_json?: string,
  health_blurb?: string,
  homegrown_calories_per_dollar?: number,
  in_collection: number
} | null> {
  const db = await getDb();
  const rows = await db.select<{
    id: number,
    name: string,
    category: string,
    is_flavoring: number,
    density_g_per_cup?: number,
    nutrition_json?: string,
    health_blurb?: string,
    homegrown_calories_per_dollar?: number,
    in_collection: number
  }[]>(
    "SELECT id, name, category, is_flavoring, density_g_per_cup, nutrition_json, health_blurb, homegrown_calories_per_dollar, in_collection FROM ingredients WHERE id = $1",
    [id]
  );
  
  if (rows.length > 0) {
    return rows[0];
  }
  return null;
}

/**
 * Create a new ingredient
 */
export async function createIngredient(ingredient: {
  name: string,
  category: string,
  is_flavoring: number,
  density_g_per_cup?: number,
  nutrition_json?: string,
  health_blurb?: string,
  homegrown_calories_per_dollar?: number
}): Promise<number> {
  const db = await getDb();
  
  const result = await db.execute(
    `INSERT INTO ingredients 
    (name, category, is_flavoring, density_g_per_cup, nutrition_json, health_blurb, homegrown_calories_per_dollar, in_collection) 
    VALUES ($1, $2, $3, $4, $5, $6, $7, 1)`,
    [
      ingredient.name,
      ingredient.category,
      ingredient.is_flavoring,
      ingredient.density_g_per_cup || null,
      ingredient.nutrition_json || null,
      ingredient.health_blurb || null,
      ingredient.homegrown_calories_per_dollar || null
    ]
  );
  
  return result.lastInsertId as number;
}

/**
 * Update an ingredient
 */
export async function updateIngredient(id: number, ingredient: {
  name?: string,
  category?: string,
  is_flavoring?: number,
  density_g_per_cup?: number | null,
  nutrition_json?: string | null,
  health_blurb?: string | null,
  homegrown_calories_per_dollar?: number | null
}): Promise<void> {
  const db = await getDb();
  
  const updates: string[] = [];
  const params: any[] = [];
  
  if (ingredient.name !== undefined) {
    updates.push("name = $1");
    params.push(ingredient.name);
  }
  
  if (ingredient.category !== undefined) {
    updates.push("category = $2");
    params.push(ingredient.category);
  }
  
  if (ingredient.is_flavoring !== undefined) {
    updates.push("is_flavoring = $3");
    params.push(ingredient.is_flavoring);
  }
  
  if (ingredient.density_g_per_cup !== undefined) {
    updates.push("density_g_per_cup = $4");
    params.push(ingredient.density_g_per_cup);
  }
  
  if (ingredient.nutrition_json !== undefined) {
    updates.push("nutrition_json = $5");
    params.push(ingredient.nutrition_json);
  }
  
  if (ingredient.health_blurb !== undefined) {
    updates.push("health_blurb = $6");
    params.push(ingredient.health_blurb);
  }
  
  if (ingredient.homegrown_calories_per_dollar !== undefined) {
    updates.push("homegrown_calories_per_dollar = $7");
    params.push(ingredient.homegrown_calories_per_dollar);
  }
  
  if (updates.length > 0) {
    params.push(id);
    const query = `UPDATE ingredients SET ${updates.join(", ")} WHERE id = $${params.length}`;
    await db.execute(query, params);
  }
}

/**
 * Delete an ingredient
 */
export async function deleteIngredient(id: number): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM ingredients WHERE id = $1", [id]);
}

/**
 * Get ingredient purchases
 */
export async function getIngredientPurchases(ingredientId: number): Promise<Array<{
  id: number,
  date: string,
  price: number,
  amount_grams: number,
  store?: string
}>> {
  const db = await getDb();
  const rows = await db.select<{
    id: number,
    date: string,
    price: number,
    amount_grams: number,
    store?: string
  }[]>(
    "SELECT id, date, price, amount_grams, store FROM purchases WHERE ingredient_id = $1 ORDER BY date DESC",
    [ingredientId]
  );
  return rows;
}

/**
 * Log a new purchase
 */
export async function logPurchase(purchase: {
  ingredient_id: number,
  date: string,
  price: number,
  amount_grams: number,
  store?: string
}): Promise<number> {
  const db = await getDb();
  
  const result = await db.execute(
    "INSERT INTO purchases (ingredient_id, date, price, amount_grams, store) VALUES ($1, $2, $3, $4, $5)",
    [
      purchase.ingredient_id,
      purchase.date,
      purchase.price,
      purchase.amount_grams,
      purchase.store || null
    ]
  );
  
  return result.lastInsertId as number;
}

/**
 * Get calorie per dollar for an ingredient based on last purchase
 */
export async function getCaloriesPerDollarForIngredient(ingredientId: number): Promise<number | null> {
  const db = await getDb();
  
  // Get the last purchase for this ingredient
  const purchaseRows = await db.select<{
    price: number,
    amount_grams: number
  }[]>(
    "SELECT price, amount_grams FROM purchases WHERE ingredient_id = $1 ORDER BY date DESC LIMIT 1",
    [ingredientId]
  );
  
  if (purchaseRows.length > 0) {
    const purchase = purchaseRows[0];
    const caloriesPerGram = await getCaloriesPerGramForIngredient(ingredientId);
    
    if (caloriesPerGram && purchase.amount_grams > 0) {
      const caloriesPerDollar = (caloriesPerGram * purchase.amount_grams) / purchase.price;
      return caloriesPerDollar;
    }
  }
  
  return null;
}

/**
 * Get calories per gram for an ingredient
 */
export async function getCaloriesPerGramForIngredient(ingredientId: number): Promise<number | null> {
  const db = await getDb();
  
  // First try to get from nutrition data
  const ingredientRows = await db.select<{
    nutrition_json?: string
  }[]>(
    "SELECT nutrition_json FROM ingredients WHERE id = $1",
    [ingredientId]
  );
  
  if (ingredientRows.length > 0 && ingredientRows[0].nutrition_json) {
    try {
      const nutrition = JSON.parse(ingredientRows[0].nutrition_json);
      if (nutrition.calories) {
        // Assuming nutrition data has calories per 100g
        return nutrition.calories / 100;
      }
    } catch (e) {
      // Fall through to other methods
    }
  }
  
  // For homegrown ingredients, use their assigned value
  const homegrownRows = await db.select<{
    homegrown_calories_per_dollar?: number
  }[]>(
    "SELECT homegrown_calories_per_dollar FROM ingredients WHERE id = $1 AND homegrown_calories_per_dollar IS NOT NULL",
    [ingredientId]
  );
  
  if (homegrownRows.length > 0) {
    const value = homegrownRows[0].homegrown_calories_per_dollar;
    return value !== undefined ? value : null;
  }
  
  return null;
}

/**
 * Classify ingredient based on DTC
 */
export async function classifyIngredient(ingredientId: number): Promise<'ADTC' | 'Expense' | 'Homegrown'> {
  const db = await getDb();
  
  // Get ingredient info
  const ingredientRows = await db.select<{
    category: string,
    homegrown_calories_per_dollar?: number
  }[]>(
    "SELECT category, homegrown_calories_per_dollar FROM ingredients WHERE id = $1",
    [ingredientId]
  );
  
  if (ingredientRows.length === 0) {
    return 'Expense'; // Default fallback
  }
  
  const ingredient = ingredientRows[0];
  
  // Handle special categories
  if (ingredient.category === 'Homegrown') {
    return 'Homegrown';
  }
  
  if (ingredient.category === 'Low-cost flavorings') {
    return 'Expense'; // Flavorings are ignored in classification
  }
  
  // Get current DTC value
  const dtcValue = await getCurrentDtcValue();
  
  // For homegrown ingredients, calculate based on assigned calories per dollar
  if (ingredient.homegrown_calories_per_dollar !== undefined && ingredient.homegrown_calories_per_dollar !== null) {
    // This is a special case for homegrown items - they are classified differently
    return 'Homegrown';
  }
  
  // Get calories per dollar from last purchase
  const caloriesPerDollar = await getCaloriesPerDollarForIngredient(ingredientId);
  
  if (caloriesPerDollar !== null) {
    if (caloriesPerDollar >= dtcValue) {
      return 'ADTC';
    } else {
      return 'Expense';
    }
  }
  
  // Fallback
  return 'Expense';
}

/**
 * Get near DTC ingredients (within 25% below threshold)
 */
export async function getNearDtcIngredients(): Promise<Array<{
  id: number,
  name: string,
  category: string,
  is_flavoring: number,
  calories_per_dollar?: number,
  classification: string
}>> {
  const db = await getDb();
  
  const dtcValue = await getCurrentDtcValue();
  const threshold = dtcValue * 0.75; // Within 25% below
  
  // Get all ingredients that are in collection
  const rows = await db.select<{
    id: number,
    name: string,
    category: string,
    is_flavoring: number
  }[]>(
    "SELECT id, name, category, is_flavoring FROM ingredients WHERE in_collection = 1 ORDER BY name"
  );
  
  const results: Array<{
    id: number,
    name: string,
    category: string,
    is_flavoring: number,
    calories_per_dollar?: number,
    classification: string
  }> = [];
  
  for (const ingredient of rows) {
    const caloriesPerDollar = await getCaloriesPerDollarForIngredient(ingredient.id);
    const classification = await classifyIngredient(ingredient.id);
    
    // Include if it's near DTC or ADTC
    if (caloriesPerDollar !== null && caloriesPerDollar >= threshold) {
      results.push({
        id: ingredient.id,
        name: ingredient.name,
        category: ingredient.category,
        is_flavoring: ingredient.is_flavoring,
        calories_per_dollar: caloriesPerDollar ?? undefined,
        classification: classification
      });
    } else if (classification === 'ADTC') {
      // Even if we can't calculate calories per dollar, if it's ADTC, include it
      results.push({
        id: ingredient.id,
        name: ingredient.name,
        category: ingredient.category,
        is_flavoring: ingredient.is_flavoring,
        calories_per_dollar: caloriesPerDollar ?? undefined,
        classification: classification
      });
    }
  }
  
  return results;
}

/**
 * Get likely to use ingredients (added by user, not auto-populated)
 */
export async function getLikelyToUseIngredients(): Promise<Array<{
  id: number,
  name: string,
  category: string,
  is_flavoring: number,
  calories_per_dollar?: number,
  classification: string
}>> {
  // For now, this is the same as near DTC since we don't have a distinction between auto-populated vs user-added
  return await getNearDtcIngredients();
}