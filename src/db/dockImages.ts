import { getDb } from "./database";
import { DockImage } from "../types/project";

export async function fetchDockImages(widgetId: number): Promise<DockImage[]> {
  const db = await getDb();
  return db.select<DockImage[]>(
    `SELECT id, widget_id as widgetId, image_data as imageData, x, y, width, height, z_index as zIndex
     FROM dock_images WHERE widget_id = $1 ORDER BY z_index, id`,
    [widgetId]
  );
}

export async function addDockImage(widgetId: number, imageData: string): Promise<number> {
  const db = await getDb();
  const existing = await db.select<{ maxZ: number | null }[]>(
    "SELECT MAX(z_index) as maxZ FROM dock_images WHERE widget_id = $1",
    [widgetId]
  );
  const nextZ = (existing[0].maxZ ?? -1) + 1;
  const result = await db.execute(
    "INSERT INTO dock_images (widget_id, image_data, z_index) VALUES ($1, $2, $3)",
    [widgetId, imageData, nextZ]
  );
  return result.lastInsertId as number;
}

export async function updateDockImageLayout(
  id: number,
  x: number,
  y: number,
  width: number,
  height: number
): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE dock_images SET x = $1, y = $2, width = $3, height = $4 WHERE id = $5", [
    x,
    y,
    width,
    height,
    id,
  ]);
}

export async function bringDockImageToFront(id: number, widgetId: number): Promise<void> {
  const db = await getDb();
  const existing = await db.select<{ maxZ: number | null }[]>(
    "SELECT MAX(z_index) as maxZ FROM dock_images WHERE widget_id = $1",
    [widgetId]
  );
  await db.execute("UPDATE dock_images SET z_index = $1 WHERE id = $2", [(existing[0].maxZ ?? 0) + 1, id]);
}

export async function deleteDockImage(id: number): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM dock_images WHERE id = $1", [id]);
}
