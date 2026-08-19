// src/db/recipes.ts
import { getDb } from "./database";
import { Recipe } from "../types/models";

export interface GraphData {
  categories: Array<{ id: number; name: string }>;
  recipes: Array<{ id: number; categoryId: number; name: string }>;
}

export async function fetchAllGraphData(): Promise<GraphData> {
  const db = await getDb();
  const categories = await db.select<Array<{ id: number; name: string }>>(
    "SELECT id, name FROM categories ORDER BY sort_order"
  );
  const recipes = await db.select<Array<{ id: number; categoryId: number; name: string }>>(
    "SELECT id, category_id as categoryId, name FROM recipes ORDER BY sort_order"
  );
  return { categories, recipes };
}

export async function fetchRecipes(categoryId: number): Promise<Recipe[]> {
  const db = await getDb();
  return db.select<Recipe[]>(
    "SELECT id, category_id as categoryId, name, instructions, sort_order as sortOrder FROM recipes WHERE category_id = $1 ORDER BY sort_order",
    [categoryId]
  );
}

export async function fetchRecipe(id: number): Promise<Recipe | null> {
  const db = await getDb();
  const rows = await db.select<Recipe[]>(
    "SELECT id, category_id as categoryId, name, instructions, sort_order as sortOrder FROM recipes WHERE id = $1",
    [id]
  );
  return rows[0] ?? null;
}

export async function addRecipe(categoryId: number, name: string): Promise<number> {
  const db = await getDb();
  const existing = await db.select<{ maxOrder: number | null }[]>(
    "SELECT MAX(sort_order) as maxOrder FROM recipes WHERE category_id = $1",
    [categoryId]
  );
  const nextOrder = (existing[0].maxOrder ?? -1) + 1;
  const result = await db.execute(
    "INSERT INTO recipes (category_id, name, instructions, sort_order) VALUES ($1, $2, '', $3)",
    [categoryId, name, nextOrder]
  );
  return result.lastInsertId as number;
}

export async function renameRecipe(id: number, name: string): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE recipes SET name = $1 WHERE id = $2", [name, id]);
}

export async function deleteRecipe(id: number): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM recipes WHERE id = $1", [id]);
}

export async function reorderRecipes(orderedIds: number[]): Promise<void> {
  const db = await getDb();
  for (let i = 0; i < orderedIds.length; i++) {
    await db.execute("UPDATE recipes SET sort_order = $1 WHERE id = $2", [
      i,
      orderedIds[i],
    ]);
  }
}

export async function updateRecipeInstructions(
  id: number,
  instructions: string
): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE recipes SET instructions = $1 WHERE id = $2", [
    instructions,
    id,
  ]);
}