import React from "react";
import { useTheme } from "./ThemeContext";
import { CSS_VAR_MAP, GeneralThemeSettings, IMAGE_GENERAL_KEYS } from "./themeDefaults";
import { parseSectionOverrides } from "./sectionTheme";

const IMAGE_KEYS = new Set(IMAGE_GENERAL_KEYS);

export type ThemeSection = "recipe" | "dream" | "responsibility";

const OVERRIDE_KEY: Record<ThemeSection, keyof Pick<
  ReturnType<typeof useTheme>["theme"],
  "recipeThemeOverrides" | "dreamThemeOverrides" | "responsibilityThemeOverrides"
>> = {
  recipe: "recipeThemeOverrides",
  dream: "dreamThemeOverrides",
  responsibility: "responsibilityThemeOverrides",
};

// Layers a section's palette on top of the global theme by setting CSS
// custom properties on a wrapping element — every descendant reading
// var(--color-*) picks up the override through normal CSS inheritance,
// and any key left out of the override just falls through to whatever
// value is already on <html> (the global theme). display: "contents"
// keeps this wrapper invisible to layout — it exists only to carry
// custom properties, never affecting flex/height chains a page (e.g.
// Dream Web's full-height canvas) depends on from its real parent.
export function SectionThemeScope({
  section,
  children,
}: {
  section: ThemeSection;
  children: React.ReactNode;
}) {
  const { theme } = useTheme();
  const overrides = parseSectionOverrides(theme[OVERRIDE_KEY[section]]);
  const keys = Object.keys(overrides) as (keyof GeneralThemeSettings)[];

  if (keys.length === 0) return <>{children}</>;

  const style: React.CSSProperties = { display: "contents" };
  for (const key of keys) {
    const cssVar = CSS_VAR_MAP[key];
    if (!cssVar) continue;
    const value = overrides[key]!;
    (style as Record<string, string>)[cssVar] = IMAGE_KEYS.has(key) ? `url("${value}")` : value;
  }

  return <div style={style}>{children}</div>;
}
