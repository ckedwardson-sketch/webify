/**
 * Notification creation utilities
 */

import { getDb } from "./database";

export interface NotificationInput {
  type: string;
  ingredient_id: number | null;
  message: string;
  warning_stage?: string | null;
}

/**
 * Create a new notification
 */
export async function createNotification(input: NotificationInput): Promise<void> {
  const db = await getDb();
  
  // Insert notification into database
  await db.execute(
    `INSERT INTO notifications (type, ingredient_id, message, warning_stage, created_at) 
     VALUES ($1, $2, $3, $4, datetime('now'))`,
    [
      input.type,
      input.ingredient_id,
      input.message,
      input.warning_stage || null
    ]
  );
}