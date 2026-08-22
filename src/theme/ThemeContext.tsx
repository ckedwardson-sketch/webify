import React, { createContext, useContext, useEffect, useState } from "react";
import { fetchThemeSettings, setThemeSetting, clearThemeSetting } from "../db/themeSettings";
import {
  CSS_VAR_MAP,
  DEFAULT_THEME,
  GeneralThemeSettings,
  IMAGE_GENERAL_KEYS,
  ThemeSettings,
} from "./themeDefaults";
import { fontStackFor } from "./fontPresets";
import { densityFor, radiusFor } from "./scalePresets";

interface ThemeContextValue {
  theme: ThemeSettings;
  overrides: Partial<ThemeSettings>;
  setThemeValue: (key: keyof ThemeSettings, value: string) => Promise<void>;
  resetThemeValue: (key: keyof ThemeSettings) => Promise<void>;
  replaceTheme: (overrides: Partial<ThemeSettings>) => Promise<void>;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const GENERAL_KEYS = Object.keys(CSS_VAR_MAP) as (keyof GeneralThemeSettings)[];
const IMAGE_KEYS = new Set(IMAGE_GENERAL_KEYS);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [overrides, setOverrides] = useState<Partial<ThemeSettings>>({});

  useEffect(() => {
    fetchThemeSettings()
      .then(setOverrides)
      .catch((err) => console.warn("Failed to load theme settings:", err));
  }, []);

  const theme: ThemeSettings = { ...DEFAULT_THEME, ...overrides };

  // The general light/dark mode picks which CSS preset applies (see
  // theme.css). Individual overrides are then applied as inline custom
  // properties, which always win over the preset regardless of mode.
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme.mode);
  }, [theme.mode]);

  useEffect(() => {
    const root = document.documentElement.style;
    for (const key of GENERAL_KEYS) {
      const cssVar = CSS_VAR_MAP[key];
      const override = overrides[key];
      if (override) {
        root.setProperty(cssVar, IMAGE_KEYS.has(key) ? `url("${override}")` : override);
      } else {
        root.removeProperty(cssVar);
      }
    }
  }, [overrides]);

  // Font/radius/density are named presets, not raw CSS values — each
  // resolves to one or more custom properties.
  useEffect(() => {
    const root = document.documentElement.style;
    if (overrides.fontFamily) root.setProperty("--font-body", fontStackFor(overrides.fontFamily));
    else root.removeProperty("--font-body");
  }, [overrides.fontFamily]);

  useEffect(() => {
    const root = document.documentElement.style;
    if (overrides.radiusScale) {
      const r = radiusFor(overrides.radiusScale);
      root.setProperty("--radius-sm", r.sm);
      root.setProperty("--radius-md", r.md);
      root.setProperty("--radius-lg", r.lg);
    } else {
      root.removeProperty("--radius-sm");
      root.removeProperty("--radius-md");
      root.removeProperty("--radius-lg");
    }
  }, [overrides.radiusScale]);

  useEffect(() => {
    const root = document.documentElement.style;
    if (overrides.density) {
      const d = densityFor(overrides.density);
      root.setProperty("--space-xs", d.xs);
      root.setProperty("--space-sm", d.sm);
      root.setProperty("--space-md", d.md);
      root.setProperty("--space-lg", d.lg);
      root.setProperty("--space-page-x", d.pageX);
      root.setProperty("--space-page-y", d.pageY);
    } else {
      root.removeProperty("--space-xs");
      root.removeProperty("--space-sm");
      root.removeProperty("--space-md");
      root.removeProperty("--space-lg");
      root.removeProperty("--space-page-x");
      root.removeProperty("--space-page-y");
    }
  }, [overrides.density]);

  const setThemeValue = async (key: keyof ThemeSettings, value: string) => {
    await setThemeSetting(key, value);
    setOverrides((prev) => ({ ...prev, [key]: value }));
  };

  const resetThemeValue = async (key: keyof ThemeSettings) => {
    await clearThemeSetting(key);
    setOverrides((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  // Full replace used by theme-preset apply/import: clears every
  // currently-set key not present in the new set, then writes the new
  // set. Used by both file import and the in-app preset library so
  // switching themes never leaves stale overrides behind.
  const replaceTheme = async (next: Partial<ThemeSettings>) => {
    for (const key of Object.keys(overrides) as (keyof ThemeSettings)[]) {
      if (!(key in next)) await clearThemeSetting(key);
    }
    for (const [key, value] of Object.entries(next)) {
      if (typeof value === "string") await setThemeSetting(key as keyof ThemeSettings, value);
    }
    setOverrides(next);
  };

  return (
    <ThemeContext.Provider
      value={{ theme, overrides, setThemeValue, resetThemeValue, replaceTheme }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside a ThemeProvider");
  return ctx;
}
