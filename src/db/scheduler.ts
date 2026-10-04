/**
 * Scheduler for food budget notifications
 */

import { getFoodBudgetSettings, getIngredients } from "./foodBudgetUtils";
import { createNotification } from "./notifications";

/**
 * Run the scheduler to check for warnings and create notifications
 */
export async function runScheduler(): Promise<void> {
  try {
    // Get current settings
    const settings = await getFoodBudgetSettings();
    
    // Get all ingredients
    const ingredients = await getIngredients();
    
    // Check each ingredient for warnings
    for (const ingredient of ingredients) {
      // Calculate warning dates based on settings
      const warningDate = new Date();
      warningDate.setDate(warningDate.getDate() - settings.warning_days);
      
      // Check if ingredient is approaching expiration
      // This is a simplified check - in reality, this would depend on 
      // ingredient-specific expiration data
      if (ingredient.in_collection === 1) {
        // Create warning notification if needed
        await createNotification({
          type: "warning",
          ingredient_id: ingredient.id,
          message: `${ingredient.name} is approaching expiration date.`,
          warning_stage: "expiring_soon"
        });
      }
    }
  } catch (error) {
    console.error("Scheduler error:", error);
    throw error;
  }
}

/**
 * Schedule the daily check
 */
export function scheduleDailyCheck(): void {
  // Run immediately on startup
  runScheduler().catch(err => console.error("Scheduler error on startup:", err));
  
  // Set up daily recurring check (every 24 hours)
  setInterval(() => {
    runScheduler().catch(err => console.error("Scheduler error:", err));
  }, 24 * 60 * 60 * 1000); // 24 hours in milliseconds
}