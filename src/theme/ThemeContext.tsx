import React, { createContext, useContext, useEffect, useState } from "react";
import { fetchThemeSettings, setThemeSetting, clearThemeSetting } from "../db/themeSettings";
import { CSS_VAR_MAP, DEFAULT_THEME, GeneralThemeSettings, ThemeSettings } from "./themeDefaults";

interface ThemeContextValue {
  theme: ThemeSettings;
  overrides: Partial<ThemeSettings>;
  setThemeValue: (key: keyof ThemeSettings, value: string) => Promise<void>;
  resetThemeValue: (key: keyof ThemeSettings) => Promise<void>;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const GENERAL_KEYS = Object.keys(CSS_VAR_MAP) as (keyof GeneralThemeSettings)[];

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
      if (override) root.setProperty(cssVar, override);
      else root.removeProperty(cssVar);
    }
  }, [overrides]);

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

  return (
    <ThemeContext.Provider value={{ theme, overrides, setThemeValue, resetThemeValue }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside a ThemeProvider");
  return ctx;
}
