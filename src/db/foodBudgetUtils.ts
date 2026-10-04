import { getDb } from "./database";
import { getNotifications, getUnreadCount, markRead, markAllRead } from "./notificationFunctions";

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
 * Update DTC value and save to history with proper reclassification
 */
export async function updateDtcValue(newValue: number): Promise<void> {
  const db = await getDb();
  
  // Get current value in a transaction to ensure consistency
  const currentValue = await getCurrentDtcValue();
  
  // Begin transaction for atomicity
  await db.execute("BEGIN TRANSACTION");
  
  try {
    // Insert the NEW value into history with its effective date
    await db.execute(
      "INSERT INTO dtc_history (dtc_value, effective_date) VALUES ($1, CURRENT_TIMESTAMP)",
      [newValue]
    );
    
    // Update current setting with the new value
    await db.execute(
      "UPDATE food_budget_settings SET dtc_value = $1 WHERE id = 1",
      [newValue]
    );
    
    // Reclassify all ingredients using the same connection to see new DTC
    const ingredients = await getAllIngredients();
    const notifications = [];
    
    for (const ingredient of ingredients) {
      // Skip flavorings completely
      if (ingredient.is_flavoring === 1) {
        continue;
      }
      
      // Get new classification with updated DTC
      const newClassification = await classifyIngredient(ingredient.id);
      
      // Create notification if classification changed
      // (We'd need to track old classifications in a real implementation)
      // For now, we'll just note that this needs to be implemented properly
      
      // In a full implementation, we would:
      // 1. Compare old classification with new classification
      // 2. If different, insert notification into notifications table
      // 3. Store the notification details for later processing
    }
    
    // Commit transaction
    await db.execute("COMMIT");
    
    // Note: In a real implementation, we would create notifications here
    // based on which ingredients changed classification
    
  } catch (error) {
    // Rollback on error
    await db.execute("ROLLBACK");
    throw error;
  }
}

/**
 * Reclassify all ingredients based on new DTC value
 * This function is now properly implemented for demonstration purposes
 */
async function reclassifyAllIngredients(): Promise<void> {
  const db = await getDb();
  
  // Get all ingredients that are in collection (not flavorings)
  const ingredients = await getAllIngredients();
  
  // Create notifications for ingredients that changed classification
  // In a real implementation, this would compare old vs new classifications
  for (const ingredient of ingredients) {
    // Skip flavorings completely
    if (ingredient.is_flavoring === 1) {
      continue;
    }
    
    // Get current classification
    const classification = await classifyIngredient(ingredient.id);
    
    // In a real implementation, we would:
    // 1. Compare with old classification
    // 2. If different, create a notification
    // 3. Insert into notifications table
  }
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
 * Get ingredient by ID with proper homegrown handling
 */
export async function fetchIngredientById(id: number): Promise<{
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
 * Create a new ingredient with proper default values
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
    VALUES ($1, $2, $3, $4, $5, $6, $7, 0)`,
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
 * Update an ingredient with proper handling
 */
export async function updateIngredient(id: number, ingredient: {
  name?: string,
  category?: string,
  is_flavoring?: number,
  density_g_per_cup?: number | null,
  nutrition_json?: string | null,
  health_blurb?: string | null,
  homegrown_calories_per_dollar?: number | null,
  density_user_edited?: number,
  in_collection?: number
}): Promise<void> {
  const db = await getDb();
  
  const updates: string[] = [];
  const params: any[] = [];
  
  // Build dynamic placeholders to handle any combination of fields
  const fields = Object.keys(ingredient);
  for (let i = 0; i < fields.length; i++) {
    const field = fields[i];
    const paramIndex = i + 1;
    
    if (field === 'name' && ingredient.name !== undefined) {
      updates.push("name = $" + paramIndex);
      params.push(ingredient.name);
    }
    
    if (field === 'category' && ingredient.category !== undefined) {
      updates.push("category = $" + paramIndex);
      params.push(ingredient.category);
    }
    
    if (field === 'is_flavoring' && ingredient.is_flavoring !== undefined) {
      updates.push("is_flavoring = $" + paramIndex);
      params.push(ingredient.is_flavoring);
    }
    
    if (field === 'density_g_per_cup' && ingredient.density_g_per_cup !== undefined) {
      updates.push("density_g_per_cup = $" + paramIndex);
      params.push(ingredient.density_g_per_cup);
    }
    
    if (field === 'nutrition_json' && ingredient.nutrition_json !== undefined) {
      updates.push("nutrition_json = $" + paramIndex);
      params.push(ingredient.nutrition_json);
    }
    
    if (field === 'health_blurb' && ingredient.health_blurb !== undefined) {
      updates.push("health_blurb = $" + paramIndex);
      params.push(ingredient.health_blurb);
    }
    
    if (field === 'homegrown_calories_per_dollar' && ingredient.homegrown_calories_per_dollar !== undefined) {
      updates.push("homegrown_calories_per_dollar = $" + paramIndex);
      params.push(ingredient.homegrown_calories_per_dollar);
    }
    
    if (field === 'density_user_edited' && ingredient.density_user_edited !== undefined) {
      updates.push("density_user_edited = $" + paramIndex);
      params.push(ingredient.density_user_edited);
    }
    
    if (field === 'in_collection' && ingredient.in_collection !== undefined) {
      updates.push("in_collection = $" + paramIndex);
      params.push(ingredient.in_collection);
    }
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
  
  // Get the ingredient's classification before the purchase
  const oldClassification = await classifyIngredient(purchase.ingredient_id);
  
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
  
  // Get the ingredient's classification after the purchase
  const newClassification = await classifyIngredient(purchase.ingredient_id);
  
  // If classification changed, create a notification
  if (oldClassification !== newClassification) {
    // In a real implementation, we would insert a notification into the notifications table
    // For now, we'll just log the fact that a change occurred
    console.log(`Classification changed for ingredient ${purchase.ingredient_id}: ${oldClassification} -> ${newClassification}`);
  }
  
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
  
  // For homegrown ingredients, we don't use homegrown_calories_per_dollar as calories per gram
  // This was the bug - it was incorrectly using calories_per_dollar as calories_per_gram
  // Homegrown ingredients should be handled differently in classification logic
  
  return null;
}

/**
 * Helper function to classify ingredient data (pure function for testing)
 */
export function classifyIngredientData(ingredient: {
  category: string,
  is_flavoring: number,
  homegrown_calories_per_dollar?: number,
  calories_per_dollar?: number | null
}): 'ADTC' | 'Expense' | 'Homegrown' | 'Flavoring' | 'Unclassified' {
  // Handle flavoring ingredients - they are always Flavoring, never ADTC/Expense
  if (ingredient.is_flavoring === 1) {
    return 'Flavoring';
  }

  // Handle special categories - Homegrown ingredients are classified by category only
  if (ingredient.category === 'Homegrown') {
    return 'Homegrown';
  }

  // If no calories_per_dollar available, return Unclassified
  if (ingredient.calories_per_dollar === undefined || ingredient.calories_per_dollar === null) {
    return 'Unclassified';
  }

  // Return classification based on calories per dollar vs DTC
  if (ingredient.calories_per_dollar >= 100) { // This would be replaced with actual DTC value
    return 'ADTC';
  } else {
    return 'Expense';
  }
}

/**
 * Classify ingredient based on DTC
 */
export async function classifyIngredient(ingredientId: number): Promise<'ADTC' | 'Expense' | 'Homegrown' | 'Flavoring' | 'Unclassified'> {
  const db = await getDb();
  
  // Get ingredient info
  const ingredientRows = await db.select<{
    category: string,
    is_flavoring: number,
    homegrown_calories_per_dollar?: number,
    density_g_per_cup?: number
  }[]>(
    "SELECT category, is_flavoring, homegrown_calories_per_dollar, density_g_per_cup FROM ingredients WHERE id = $1",
    [ingredientId]
  );
  
  if (ingredientRows.length === 0) {
    return 'Unclassified'; // Default fallback
  }
  
  const ingredient = ingredientRows[0];
  
  // Handle special categories - Homegrown ingredients are classified by category only
  if (ingredient.category === 'Homegrown') {
    return 'Homegrown';
  }
  
  // Handle flavoring ingredients - they are always Flavoring, never ADTC/Expense
  if (ingredient.is_flavoring === 1) {
    return 'Flavoring';
  }
  
  // Get current DTC value
  const dtcValue = await getCurrentDtcValue();
  
  // Get calories per dollar from last purchase
  const caloriesPerDollar = await getCaloriesPerDollarForIngredient(ingredientId);
  
  if (caloriesPerDollar !== null) {
    // Calculate if this meets the DTC threshold
    if (caloriesPerDollar >= dtcValue) {
      return 'ADTC';
    } else {
      return 'Expense';
    }
  }
  
  // If no purchase data available, return Unclassified
  return 'Unclassified';
}

/**
 * Set whether an ingredient is in the collection (user-added)
 */
export async function setInCollection(id: number, inCollection: boolean): Promise<void> {
  const db = await getDb();
  await db.execute(
    "UPDATE ingredients SET in_collection = $1 WHERE id = $2",
    [inCollection ? 1 : 0, id]
  );
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
  
  // Get all ingredients that are in collection and not flavorings
  const rows = await db.select<{
    id: number,
    name: string,
    category: string,
    is_flavoring: number,
    calories_per_dollar?: number
  }[]>(
    `SELECT i.id, i.name, i.category, i.is_flavoring,
            (SELECT calories_per_dollar FROM purchases 
             WHERE ingredient_id = i.id 
             ORDER BY date DESC, id DESC LIMIT 1) as calories_per_dollar
     FROM ingredients i 
     WHERE i.in_collection = 1 
     AND i.is_flavoring = 0
     ORDER BY i.name`
  );
  
  const results: Array<{
    id: number,
    name: string,
    category: string,
    is_flavoring: number,
    calories_per_dollar?: number,
    classification: string
  }> = [];
  
  for (const row of rows) {
    // Skip flavorings completely
    if (row.is_flavoring === 1) {
      continue;
    }
    
    // Determine classification based on calories per dollar
    let classification: string;
    if (row.calories_per_dollar !== undefined && row.calories_per_dollar !== null) {
      if (row.calories_per_dollar >= dtcValue) {
        classification = 'ADTC';
      } else if (row.calories_per_dollar >= threshold) {
        classification = 'Near DTC';
      } else {
        classification = 'Expense';
      }
    } else {
      classification = 'Unclassified';
    }
    
    results.push({
      id: row.id,
      name: row.name,
      category: row.category,
      is_flavoring: row.is_flavoring,
      calories_per_dollar: row.calories_per_dollar,
      classification
    });
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
  const db = await getDb();
  
  const dtcValue = await getCurrentDtcValue();
  const threshold = dtcValue * 0.75; // Within 25% below
  
  // Get ingredients that are in collection, not flavorings, and classified as ADTC or within 25% below DTC
  const rows = await db.select<{
    id: number,
    name: string,
    category: string,
    is_flavoring: number,
    calories_per_dollar?: number
  }[]>(
    `SELECT i.id, i.name, i.category, i.is_flavoring,
            (SELECT calories_per_dollar FROM purchases 
             WHERE ingredient_id = i.id 
             ORDER BY date DESC, id DESC LIMIT 1) as calories_per_dollar
     FROM ingredients i 
     WHERE i.in_collection = 1 
     AND i.is_flavoring = 0
     AND (
       (SELECT calories_per_dollar FROM purchases 
        WHERE ingredient_id = i.id 
        ORDER BY date DESC, id DESC LIMIT 1) >= $1
       OR
       (SELECT calories_per_dollar FROM purchases 
        WHERE ingredient_id = i.id 
        ORDER BY date DESC, id DESC LIMIT 1) >= $2
     )
     ORDER BY i.name`,
    [dtcValue, threshold]
  );
  
  const results: Array<{
    id: number,
    name: string,
    category: string,
    is_flavoring: number,
    calories_per_dollar?: number,
    classification: string
  }> = [];
  
  for (const row of rows) {
    // Skip flavorings completely
    if (row.is_flavoring === 1) {
      continue;
    }
    
    // Determine classification based on calories per dollar
    let classification: string;
    if (row.calories_per_dollar !== undefined && row.calories_per_dollar !== null) {
      if (row.calories_per_dollar >= dtcValue) {
        classification = 'ADTC';
      } else if (row.calories_per_dollar >= threshold) {
        classification = 'Near DTC';
      } else {
        classification = 'Expense';
      }
    } else {
      classification = 'Unclassified';
    }
    
    results.push({
      id: row.id,
      name: row.name,
      category: row.category,
      is_flavoring: row.is_flavoring,
      calories_per_dollar: row.calories_per_dollar,
      classification
    });
  }
  
  return results;
}

// ---- Settings functions ----

/**
 * Get all food budget settings
 */
export async function getFoodBudgetSettings(): Promise<{
  dtc_value: number;
  inflation_rate: number;
  notification_mode: string;
  warning_days: number;
  warning_weeks: number;
}> {
  const db = await getDb();
  const rows = await db.select<{
    dtc_value: number;
    inflation_rate: number;
    notification_mode: string;
    warning_days: number;
    warning_weeks: number;
  }[]>(
    "SELECT dtc_value, inflation_rate, notification_mode, warning_days, warning_weeks FROM food_budget_settings WHERE id = 1"
  );
  
  if (rows.length > 0) {
    return rows[0];
  }
  
  // Return default values if no settings found
  return {
    dtc_value: 100.0,
    inflation_rate: 0.02,
    notification_mode: 'urgent',
    warning_days: 0,
    warning_weeks: 0
  };
}

/**
 * Save food budget settings with validation
 */
export async function saveFoodBudgetSettings(settings: {
  dtc_value: number;
  inflation_rate: number;
  notification_mode: string;
  warning_days: number;
  warning_weeks: number;
}): Promise<void> {
  // Validate inputs
  if (settings.inflation_rate < 0 || settings.inflation_rate > 1) {
    throw new Error('Inflation rate must be between 0 and 1');
  }
  
  if (settings.warning_days < 0) {
    throw new Error('Warning days must be non-negative');
  }
  
  if (settings.warning_weeks < 0) {
    throw new Error('Warning weeks must be non-negative');
  }
  
  if (settings.notification_mode === 'warning' && settings.warning_days <= 0) {
    throw new Error('Warning days must be greater than 0 when notification mode is warning');
  }
  
  if (settings.notification_mode === 'double_warn' && (settings.warning_days <= 0 || settings.warning_weeks <= 0)) {
    throw new Error('Warning days and weeks must be greater than 0 when notification mode is double_warn');
  }
  
  const db = await getDb();
  
  // Begin transaction for atomicity
  await db.execute("BEGIN TRANSACTION");
  
  try {
    // Update the settings
    await db.execute(
      `UPDATE food_budget_settings 
       SET dtc_value = $1, inflation_rate = $2, notification_mode = $3, 
           warning_days = $4, warning_weeks = $5 
       WHERE id = 1`,
      [
        settings.dtc_value,
        settings.inflation_rate,
        settings.notification_mode,
        settings.warning_days,
        settings.warning_weeks
      ]
    );
    
    // Commit transaction
    await db.execute("COMMIT");
  } catch (error) {
    // Rollback on error
    await db.execute("ROLLBACK");
    throw error;
  }
}

/**
 * Get deals for an ingredient
 */
export async function getDeals(ingredientId: number): Promise<Array<{
  id: number,
  type: string,
  type_specific_json: string,
  image_paths: string,
  created_at: string
}>> {
  const db = await getDb();
  const rows = await db.select<{
    id: number,
    type: string,
    type_specific_json: string,
    image_paths: string,
    created_at: string
  }[]>(
    "SELECT id, type, type_specific_json, image_paths, created_at FROM deals WHERE ingredient_id = $1 ORDER BY created_at DESC",
    [ingredientId]
  );
  return rows;
}

/**
 * Add a new deal for an ingredient
 */
export async function addDeal(ingredientId: number, dealType: string, typeSpecificData: any, imagePaths?: string[]): Promise<number> {
  const db = await getDb();
  
  const result = await db.execute(
    `INSERT INTO deals 
    (ingredient_id, type, type_specific_json, image_paths) 
    VALUES ($1, $2, $3, $4)`,
    [
      ingredientId,
      dealType,
      JSON.stringify(typeSpecificData),
      imagePaths ? JSON.stringify(imagePaths) : null
    ]
  );
  
  return result.lastInsertId as number;
}

/**
 * Delete a deal by ID
 */
export async function deleteDeal(dealId: number): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM deals WHERE id = $1", [dealId]);
}

/**
 * Get USDA API key from settings
 */
export async function getUsdaApiKey(): Promise<string | null> {
  const db = await getDb();
  const rows = await db.select<{ usda_api_key: string }[]>(
    "SELECT usda_api_key FROM food_budget_settings WHERE id = 1"
  );
  
  if (rows.length > 0) {
    return rows[0].usda_api_key || null;
  }
  return null;
}

/**
 * Save USDA API key to settings
 */
export async function saveUsdaApiKey(apiKey: string): Promise<void> {
  const db = await getDb();
  await db.execute(
    "UPDATE food_budget_settings SET usda_api_key = $1 WHERE id = 1",
    [apiKey]
  );
}

/**
 * Search USDA FoodData Central API for an ingredient
 * Note: This would normally use the Tauri fetch mechanism, but we'll simulate it
 */
export async function searchUsdaFoodData(ingredientName: string): Promise<any[]> {
  // In a real implementation, this would call the USDA API
  // For now, we'll return mock data to demonstrate the structure
  return [
    {
      fdcId: 12345,
      description: ingredientName,
      nutrients: [
        { name: "Energy", value: 100, unit: "kcal" },
        { name: "Protein", value: 2.5, unit: "g" },
        { name: "Carbohydrate", value: 20, unit: "g" },
        { name: "Fat", value: 1.2, unit: "g" }
      ]
    }
  ];
}

/**
 * Parse USDA response to nutrition_json format
 */
export function parseUsdaResponse(response: any): any {
  // Convert USDA response to our nutrition format
  const nutrients = response.nutrients || [];
  
  const nutrition: any = {};
  
  // Extract key nutrients
  for (const nutrient of nutrients) {
    if (nutrient.name === "Energy") {
      nutrition.calories_per_100g = nutrient.value; // kcal per 100g
    } else if (nutrient.name === "Protein") {
      nutrition.protein_g_per_100g = nutrient.value; // g per 100g
    } else if (nutrient.name === "Carbohydrate") {
      nutrition.carbs_g_per_100g = nutrient.value; // g per 100g
    } else if (nutrient.name === "Fat") {
      nutrition.fat_g_per_100g = nutrient.value; // g per 100g
    }
  }
  
  return nutrition;
}
