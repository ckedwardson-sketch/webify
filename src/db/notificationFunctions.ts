/**
 * Notification functions for food budget
 */

import { getDb } from "./database";

/**
 * Get all notifications
 */
export async function getNotifications(): Promise<Array<{
  id: number;
  type: string;
  ingredient_id: number | null;
  message: string;
  read_flag: number;
  created_at: string;
  warning_stage: string | null;
}>> {
  const db = await getDb();
  const rows = await db.select<{
    id: number;
    type: string;
    ingredient_id: number | null;
    message: string;
    read_flag: number;
    created_at: string;
    warning_stage: string | null;
  }[]>(
    "SELECT id, type, ingredient_id, message, read_flag, created_at, warning_stage FROM notifications ORDER BY created_at DESC"
  );
  return rows;
}

/**
 * Get unread notification count
 */
export async function getUnreadCount(): Promise<number> {
  const db = await getDb();
  const rows = await db.select<{ count: number }[]>(
    "SELECT COUNT(*) as count FROM notifications WHERE read_flag = 0"
  );
  return rows[0]?.count || 0;
}

/**
 * Mark a notification as read
 */
export async function markRead(id: number): Promise<void> {
  const db = await getDb();
  await db.execute(
    "UPDATE notifications SET read_flag = 1 WHERE id = $1",
    [id]
  );
}

/**
 * Mark all notifications as read
 */
export async function markAllRead(): Promise<void> {
  const db = await getDb();
  await db.execute(
    "UPDATE notifications SET read_flag = 1 WHERE read_flag = 0"
  );
}