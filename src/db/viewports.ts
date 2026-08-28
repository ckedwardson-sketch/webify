import { getDb } from "./database";

export interface SavedViewport {
  x: number;
  y: number;
  zoom: number;
}

// One row per canvas scope ("dream-web", or "goal-web:<id>") — see
// database.ts's create_saved_viewports_table migration. Lets a web
// canvas reopen exactly where it was left, instead of always re-fitting.
export async function fetchViewport(scopeKey: string): Promise<SavedViewport | null> {
  const db = await getDb();
  const rows = await db.select<SavedViewport[]>(
    "SELECT x, y, zoom FROM saved_viewports WHERE scope_key = $1",
    [scopeKey]
  );
  return rows[0] ?? null;
}

export async function saveViewport(scopeKey: string, viewport: SavedViewport): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT INTO saved_viewports (scope_key, x, y, zoom) VALUES ($1, $2, $3, $4)
     ON CONFLICT(scope_key) DO UPDATE SET x = excluded.x, y = excluded.y, zoom = excluded.zoom`,
    [scopeKey, viewport.x, viewport.y, viewport.zoom]
  );
}
