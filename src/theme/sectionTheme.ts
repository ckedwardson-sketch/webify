import { CSS_VAR_MAP, GeneralThemeSettings } from "./themeDefaults";

// Parses a per-section override blob (see AdvancedThemeSettings's
// *ThemeOverrides fields) into a safe Partial<GeneralThemeSettings> —
// invalid JSON or unknown/non-string keys are silently dropped rather
// than thrown, since this comes from a free-text settings field a
// person can mistype without wanting the whole section to break.
export function parseSectionOverrides(json: string): Partial<GeneralThemeSettings> {
  if (!json || !json.trim()) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return {};
  }
  if (!parsed || typeof parsed !== "object") return {};

  const result: Partial<GeneralThemeSettings> = {};
  for (const key of Object.keys(CSS_VAR_MAP) as (keyof GeneralThemeSettings)[]) {
    const value = (parsed as Record<string, unknown>)[key];
    if (typeof value === "string" && value) result[key] = value;
  }
  return result;
}
