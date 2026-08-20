// src/db/recipes.ts
import { getDb } from "./database";
import { Recipe } from "../types/models";

export interface GraphRecipeNode {
  id: number;
  categoryId: number;
  name: string;
  imageData?: string;
  isFrozen?: boolean;
  isHomegrown?: boolean;
  isFavorite?: boolean;
  isProven?: boolean;
  parentRecipeId?: number;
  iterationDifference?: string;
}

export interface GraphData {
  categories: Array<{ id: number; name: string }>;
  recipes: GraphRecipeNode[];
}

// SQLite has no real boolean type — flag columns come back as 0/1
// integers. This turns those into actual booleans so `{flag && <X/>}`
// in JSX doesn't render a stray "0" when the value is false.
function toBool(value: unknown): boolean {
  return !!value;
}

type RawRecipeRow = {
  id: number;
  categoryId: number;
  name: string;
  instructions?: string;
  sortOrder?: number;
  imageData?: string | null;
  isFrozen: number;
  isHomegrown: number;
  isFavorite: number;
  isProven: number;
  parentRecipeId?: number | null;
  iterationDifference?: string | null;
};

function mapRecipeRow(row: RawRecipeRow): Recipe {
  return {
    ...row,
    imageData: row.imageData ?? undefined,
    isFrozen: toBool(row.isFrozen),
    isHomegrown: toBool(row.isHomegrown),
    isFavorite: toBool(row.isFavorite),
    isProven: toBool(row.isProven),
    parentRecipeId: row.parentRecipeId ?? undefined,
    iterationDifference: row.iterationDifference ?? undefined,
  };
}

const RECIPE_COLUMNS = `
  id,
  category_id as categoryId,
  name,
  instructions,
  sort_order as sortOrder,
  image_data as imageData,
  is_frozen as isFrozen,
  is_homegrown as isHomegrown,
  is_favorite as isFavorite,
  is_proven as isProven,
  parent_recipe_id as parentRecipeId,
  iteration_difference as iterationDifference
`;

export async function fetchAllGraphData(): Promise<GraphData> {
  const db = await getDb();
  const categories = await db.select<Array<{ id: number; name: string }>>(
    "SELECT id, name FROM categories ORDER BY sort_order"
  );
  const rawRecipes = await db.select<RawRecipeRow[]>(
    `SELECT ${RECIPE_COLUMNS} FROM recipes ORDER BY sort_order`
  );
  return { categories, recipes: rawRecipes.map(mapRecipeRow) };
}

export async function fetchRecipes(categoryId: number): Promise<Recipe[]> {
  const db = await getDb();
  const rows = await db.select<RawRecipeRow[]>(
    `SELECT ${RECIPE_COLUMNS} FROM recipes WHERE category_id = $1 AND parent_recipe_id IS NULL ORDER BY sort_order`,
    [categoryId]
  );
  return rows.map(mapRecipeRow);
}

export async function fetchRecipe(id: number): Promise<Recipe | null> {
  const db = await getDb();
  const rows = await db.select<RawRecipeRow[]>(
    `SELECT ${RECIPE_COLUMNS} FROM recipes WHERE id = $1`,
    [id]
  );
  return rows[0] ? mapRecipeRow(rows[0]) : null;
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
  // Delete this recipe's iterations first. The parent_recipe_id column
  // has no FK cascade on databases that got it via migration rather
  // than a fresh CREATE TABLE, so this is handled explicitly instead.
  await db.execute("DELETE FROM recipes WHERE parent_recipe_id = $1", [id]);
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

// imageData is a base64 data URL (e.g. "data:image/png;base64,...") or
// null to remove the cover image.
export async function updateRecipeImage(
  id: number,
  imageData: string | null
): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE recipes SET image_data = $1 WHERE id = $2", [
    imageData,
    id,
  ]);
}

export interface RecipeLinkTarget {
  id: number;
  name: string;
  categoryId: number;
  categoryName: string;
}

// For the editor's "link to a recipe" picker — every recipe across
// every category, so you can link to anything, not just siblings in
// the current category.
export async function fetchAllRecipesFlat(): Promise<RecipeLinkTarget[]> {
  const db = await getDb();
  return db.select<RecipeLinkTarget[]>(`
    SELECT r.id, r.name, r.category_id as categoryId, c.name as categoryName
    FROM recipes r
    JOIN categories c ON c.id = r.category_id
    ORDER BY c.sort_order, r.sort_order
  `);
}

const FLAG_COLUMNS = {
  isFrozen: "is_frozen",
  isHomegrown: "is_homegrown",
  isFavorite: "is_favorite",
  isProven: "is_proven",
} as const;

export async function updateRecipeFlag(
  id: number,
  field: keyof typeof FLAG_COLUMNS,
  value: boolean
): Promise<void> {
  const db = await getDb();
  const column = FLAG_COLUMNS[field];
  await db.execute(`UPDATE recipes SET ${column} = $1 WHERE id = $2`, [
    value ? 1 : 0,
    id,
  ]);
}

// Duplicates a recipe — name, instructions, image, and all flags — as
// a new row linked back to it via parent_recipe_id. Returns the new
// recipe's id so the caller can navigate straight to it.
export async function createIteration(recipeId: number): Promise<number> {
  const db = await getDb();
  const source = await fetchRecipe(recipeId);
  if (!source) throw new Error("Recipe not found");

  const siblings = await db.select<{ count: number }[]>(
    "SELECT COUNT(*) as count FROM recipes WHERE parent_recipe_id = $1",
    [recipeId]
  );
  const iterationNumber = (siblings[0]?.count ?? 0) + 1;
  const newName = `${source.name} (Iteration ${iterationNumber})`;

  const existingOrder = await db.select<{ maxOrder: number | null }[]>(
    "SELECT MAX(sort_order) as maxOrder FROM recipes WHERE category_id = $1",
    [source.categoryId]
  );
  const nextOrder = (existingOrder[0].maxOrder ?? -1) + 1;

  const result = await db.execute(
    `INSERT INTO recipes
      (category_id, name, instructions, sort_order, image_data, is_frozen, is_homegrown, is_favorite, is_proven, parent_recipe_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      source.categoryId,
      newName,
      source.instructions ?? "",
      nextOrder,
      source.imageData ?? null,
      source.isFrozen ? 1 : 0,
      source.isHomegrown ? 1 : 0,
      source.isFavorite ? 1 : 0,
      source.isProven ? 1 : 0,
      recipeId,
    ]
  );
  return result.lastInsertId as number;
}

// The iterations that belong directly to this recipe (its children,
// not siblings or grandchildren).
export async function fetchIterations(recipeId: number): Promise<Recipe[]> {
  const db = await getDb();
  const rows = await db.select<RawRecipeRow[]>(
    `SELECT ${RECIPE_COLUMNS} FROM recipes WHERE parent_recipe_id = $1 ORDER BY id`,
    [recipeId]
  );
  return rows.map(mapRecipeRow);
}

export async function updateIterationDifference(
  id: number,
  text: string
): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE recipes SET iteration_difference = $1 WHERE id = $2", [
    text,
    id,
  ]);
}
