import React, { createContext, useContext, useEffect, useState } from "react";
import { fetchThemeSettings, setThemeSetting, clearThemeSetting } from "../db/themeSettings";
import { DEFAULT_THEME, ThemeSettings } from "./themeDefaults";

interface ThemeContextValue {
  theme: ThemeSettings;
  overrides: Partial<ThemeSettings>;
  setThemeValue: (key: keyof ThemeSettings, value: string) => Promise<void>;
  resetThemeValue: (key: keyof ThemeSettings) => Promise<void>;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [overrides, setOverrides] = useState<Partial<ThemeSettings>>({});

  useEffect(() => {
    fetchThemeSettings()
      .then(setOverrides)
      .catch((err) => console.warn("Failed to load theme settings:", err));
  }, []);

  const theme: ThemeSettings = { ...DEFAULT_THEME, ...overrides };

  // The general light/dark mode drives CSS variables defined in
  // theme.css, scoped via this attribute on <html>.
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme.mode);
  }, [theme.mode]);

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
