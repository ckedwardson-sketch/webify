import { getDb } from "./database";

// Per-page Color Mode overrides — see database.ts's
// create_page_background_overrides_table for why this is scoped by
// (scopeKey, surfaceKey) instead of living in the flat global
// theme_settings table: the whole point is that two pages of the same
// type (e.g. two different projects) can carry different backgrounds.
export interface PageSurfaceOverride {
  color?: string;
  imageData?: string;
  tile?: string; // "0" | "1"
  scale?: string; // px, numeric string
}

interface PageBackgroundRow {
  surface_key: string;
  color: string | null;
  image_data: string | null;
  tile: string | null;
  scale: string | null;
}

export async function fetchPageBackgrounds(
  scopeKey: string
): Promise<Record<string, PageSurfaceOverride>> {
  const db = await getDb();
  const rows = await db.select<PageBackgroundRow[]>(
    "SELECT surface_key, color, image_data, tile, scale FROM page_background_overrides WHERE scope_key = $1",
    [scopeKey]
  );
  const result: Record<string, PageSurfaceOverride> = {};
  for (const row of rows) {
    result[row.surface_key] = {
      color: row.color ?? undefined,
      imageData: row.image_data ?? undefined,
      tile: row.tile ?? undefined,
      scale: row.scale ?? undefined,
    };
  }
  return result;
}

// Merge-patches one surface's row — every field not present in `patch`
// keeps its current stored value, same convention as FieldStylePatch.
export async function setPageBackground(
  scopeKey: string,
  surfaceKey: string,
  patch: PageSurfaceOverride
): Promise<void> {
  const db = await getDb();
  const existing = await db.select<PageBackgroundRow[]>(
    "SELECT surface_key, color, image_data, tile, scale FROM page_background_overrides WHERE scope_key = $1 AND surface_key = $2",
    [scopeKey, surfaceKey]
  );
  const base = existing[0];
  const next = {
    color: patch.color !== undefined ? patch.color : base?.color ?? null,
    imageData: patch.imageData !== undefined ? patch.imageData : base?.image_data ?? null,
    tile: patch.tile !== undefined ? patch.tile : base?.tile ?? null,
    scale: patch.scale !== undefined ? patch.scale : base?.scale ?? null,
  };
  await db.execute(
    `INSERT INTO page_background_overrides (scope_key, surface_key, color, image_data, tile, scale)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT(scope_key, surface_key) DO UPDATE SET
       color = excluded.color,
       image_data = excluded.image_data,
       tile = excluded.tile,
       scale = excluded.scale`,
    [scopeKey, surfaceKey, next.color, next.imageData, next.tile, next.scale]
  );
}

export async function clearPageBackground(scopeKey: string, surfaceKey: string): Promise<void> {
  const db = await getDb();
  await db.execute(
    "DELETE FROM page_background_overrides WHERE scope_key = $1 AND surface_key = $2",
    [scopeKey, surfaceKey]
  );
}

// Only the "section:*" scope keys (Dreams/Goals/Projects/Recipes/
// Responsibilities/Skills/Notes home & web views — see
// theme/pageScope.ts's scopeKeyForView) are portable theme content —
// an entity-specific key like "project:5" is this install's own data
// (a numeric id nothing else can resolve), not something an AI-authored
// theme should ever set. These two functions back the Export to AI /
// Import Theme path (see ExportToAiModal.tsx, SettingsHomePage.tsx)
// and deliberately only ever touch "section:*" rows.
export async function fetchAllSectionPageBackgrounds(): Promise<Record<string, Record<string, PageSurfaceOverride>>> {
  const db = await getDb();
  const rows = await db.select<(PageBackgroundRow & { scope_key: string })[]>(
    "SELECT scope_key, surface_key, color, image_data, tile, scale FROM page_background_overrides WHERE scope_key LIKE 'section:%'"
  );
  const result: Record<string, Record<string, PageSurfaceOverride>> = {};
  for (const row of rows) {
    if (!result[row.scope_key]) result[row.scope_key] = {};
    result[row.scope_key][row.surface_key] = {
      color: row.color ?? undefined,
      imageData: row.image_data ?? undefined,
      tile: row.tile ?? undefined,
      scale: row.scale ?? undefined,
    };
  }
  return result;
}

// Full replace of every "section:*" background (entity-specific rows
// like "project:5" are left untouched), mirroring how theme import
// already fully replaces icons/textElements/buttonStyles/themeSettings.
export async function replaceSectionPageBackgrounds(
  data: Record<string, Record<string, PageSurfaceOverride>>
): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM page_background_overrides WHERE scope_key LIKE 'section:%'");
  for (const [scopeKey, surfaces] of Object.entries(data)) {
    if (!scopeKey.startsWith("section:")) continue;
    for (const [surfaceKey, override] of Object.entries(surfaces)) {
      await setPageBackground(scopeKey, surfaceKey, override);
    }
  }
}
