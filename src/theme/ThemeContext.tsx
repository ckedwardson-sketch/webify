import React, { createContext, useContext, useEffect, useState } from "react";
import { fetchThemeSettings, setThemeSetting, clearThemeSetting } from "../db/themeSettings";
import {
  fetchCustomSliders,
  replaceCustomSliders as replaceCustomSlidersInDb,
  setCustomSliderValue as setCustomSliderValueInDb,
} from "../db/customSliders";
import {
  CSS_VAR_MAP,
  DEFAULT_THEME,
  GeneralThemeSettings,
  IMAGE_GENERAL_KEYS,
  ThemeSettings,
} from "./themeDefaults";
import { fontStackFor } from "./fontPresets";
import { densityFor, radiusFor } from "./scalePresets";
import { surfaceFor } from "./surfacePresets";
import { headingFor } from "./headingPresets";
import { backgroundPatternFor } from "./backgroundPresets";
import { motionFor } from "./motionPresets";
import { clampSliderValue, CustomSliderDef, CustomSliderState } from "./customSliders";
import { computeMobileLayout, computeMobileLandscape, MobileMode } from "./mobileLayout";

interface ThemeContextValue {
  theme: ThemeSettings;
  overrides: Partial<ThemeSettings>;
  setThemeValue: (key: keyof ThemeSettings, value: string) => Promise<void>;
  resetThemeValue: (key: keyof ThemeSettings) => Promise<void>;
  replaceTheme: (overrides: Partial<ThemeSettings>) => Promise<void>;
  // Designer-defined slider controls — see theme/customSliders.ts.
  customSliders: CustomSliderState[];
  setCustomSliderValue: (id: string, value: number) => Promise<void>;
  replaceCustomSliders: (defs: CustomSliderDef[]) => Promise<void>;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const GENERAL_KEYS = Object.keys(CSS_VAR_MAP) as (keyof GeneralThemeSettings)[];
const IMAGE_KEYS = new Set(IMAGE_GENERAL_KEYS);

// Shared by the three CSS-var-driven Color Mode tiling effects below —
// `prefix` is the image variable's own name (e.g. "--bg-image-app"),
// and this writes its "-size"/"-repeat" companions. Tiling on: a small
// repeating tile at `scale`px; off: today's cover/no-repeat behavior
// (theme.css's default for both companion vars), restored by simply
// removing the override.
function applyTileVars(prefix: string, tile?: string, scale?: string): void {
  const root = document.documentElement.style;
  if (tile === "1") {
    root.setProperty(`${prefix}-repeat`, "repeat");
    root.setProperty(`${prefix}-size`, `${scale || "128"}px ${scale || "128"}px`);
  } else {
    root.removeProperty(`${prefix}-repeat`);
    root.removeProperty(`${prefix}-size`);
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [overrides, setOverrides] = useState<Partial<ThemeSettings>>({});
  const [customSliders, setCustomSlidersState] = useState<CustomSliderState[]>([]);

  useEffect(() => {
    fetchThemeSettings()
      .then(setOverrides)
      .catch((err) => console.warn("Failed to load theme settings:", err));
    fetchCustomSliders()
      .then(setCustomSlidersState)
      .catch((err) => console.warn("Failed to load custom theme sliders:", err));
  }, []);

  const theme: ThemeSettings = { ...DEFAULT_THEME, ...overrides };

  // The general light/dark mode picks which CSS preset applies (see
  // theme.css). Individual overrides are then applied as inline custom
  // properties, which always win over the preset regardless of mode.
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme.mode);
  }, [theme.mode]);

  // Sidebar position is a structural layout change, not a value swap —
  // driven by a data attribute the same way data-theme picks light/dark,
  // so App.css/Sidebar.css can key real layout rules off it.
  useEffect(() => {
    document.documentElement.setAttribute("data-nav-layout", theme.navLayout);
  }, [theme.navLayout]);

  // Mobile layout: html.mobile-layout / html.mobile-landscape, kept live
  // against the actual window in "auto" mode and re-applied whenever the
  // Settings toggle changes — see theme/mobileLayout.ts for why this is a
  // class rather than a plain @media query.
  useEffect(() => {
    const mode = (theme.mobileMode as MobileMode) || "auto";
    const apply = () => {
      const mobile = computeMobileLayout(mode);
      const landscape = computeMobileLandscape(mobile);
      document.documentElement.classList.toggle("mobile-layout", mobile);
      document.documentElement.classList.toggle("mobile-landscape", landscape);
    };
    apply();
    window.addEventListener("resize", apply);
    window.addEventListener("orientationchange", apply);
    return () => {
      window.removeEventListener("resize", apply);
      window.removeEventListener("orientationchange", apply);
    };
  }, [theme.mobileMode]);

  useEffect(() => {
    const root = document.documentElement.style;
    for (const key of GENERAL_KEYS) {
      const cssVar = CSS_VAR_MAP[key];
      if (!cssVar) continue;
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

  // Three previously-hardcoded structural knobs — see
  // --page-max-width/--sidebar-width/--page-title-size in theme.css and
  // their fields in themeFieldGroups.ts. Each is a raw numeric string
  // with its own fixed unit (px/px/rem), unlike fontFamily/radiusScale/
  // density above, which are named preset keys.
  useEffect(() => {
    const root = document.documentElement.style;
    if (overrides.pageMaxWidth) root.setProperty("--page-max-width", `${overrides.pageMaxWidth}px`);
    else root.removeProperty("--page-max-width");
  }, [overrides.pageMaxWidth]);

  useEffect(() => {
    const root = document.documentElement.style;
    if (overrides.sidebarWidth) root.setProperty("--sidebar-width", `${overrides.sidebarWidth}px`);
    else root.removeProperty("--sidebar-width");
  }, [overrides.sidebarWidth]);

  useEffect(() => {
    const root = document.documentElement.style;
    if (overrides.pageTitleSize) root.setProperty("--page-title-size", `${overrides.pageTitleSize}rem`);
    else root.removeProperty("--page-title-size");
  }, [overrides.pageTitleSize]);

  useEffect(() => {
    const root = document.documentElement.style;
    if (overrides.sidebarItemGap) root.setProperty("--sidebar-item-gap", `${overrides.sidebarItemGap}px`);
    else root.removeProperty("--sidebar-item-gap");
  }, [overrides.sidebarItemGap]);

  useEffect(() => {
    const root = document.documentElement.style;
    if (overrides.fieldSpacing) root.setProperty("--field-spacing", `${overrides.fieldSpacing}px`);
    else root.removeProperty("--field-spacing");
  }, [overrides.fieldSpacing]);

  // Color Mode's tiling controls (see overlay/ColorModePanel.tsx) for
  // the three CSS-var-driven backgrounds — page, sidebar, field. Each
  // pair of custom properties defaults to "cover, no-repeat" in
  // theme.css, so this only needs to override them when tiling is
  // actually on; otherwise it reverts to that default (same
  // remove-when-absent convention as every other knob in this file).
  // Has no visible effect while the matching *Image field is empty,
  // since the background-image itself is still "none".
  useEffect(() => {
    applyTileVars("--bg-image-app", overrides.appBackgroundTile, overrides.appBackgroundScale);
  }, [overrides.appBackgroundTile, overrides.appBackgroundScale]);

  useEffect(() => {
    applyTileVars("--bg-image-sidebar", overrides.sidebarBgTile, overrides.sidebarBgScale);
  }, [overrides.sidebarBgTile, overrides.sidebarBgScale]);

  useEffect(() => {
    applyTileVars("--bg-image-input", overrides.inputBgTile, overrides.inputBgScale);
  }, [overrides.inputBgTile, overrides.inputBgScale]);

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

  // Surface/heading/background/motion are named presets, same pattern
  // as font/radius/density above — each fans out to several properties.
  useEffect(() => {
    const root = document.documentElement.style;
    if (overrides.surfaceStyle) {
      const s = surfaceFor(overrides.surfaceStyle);
      root.setProperty("--surface-border-width", s.borderWidth);
      root.setProperty("--surface-shadow", s.shadow);
      root.setProperty("--surface-backdrop-filter", s.backdropFilter);
      root.setProperty("--surface-bg-opacity", s.bgOpacity);
    } else {
      root.removeProperty("--surface-border-width");
      root.removeProperty("--surface-shadow");
      root.removeProperty("--surface-backdrop-filter");
      root.removeProperty("--surface-bg-opacity");
    }
  }, [overrides.surfaceStyle]);

  useEffect(() => {
    const root = document.documentElement.style;
    if (overrides.headingStyle) {
      const h = headingFor(overrides.headingStyle);
      root.setProperty("--heading-font", h.font);
      root.setProperty("--heading-weight", h.weight);
      root.setProperty("--heading-transform", h.transform);
      root.setProperty("--heading-tracking", h.tracking);
    } else {
      root.removeProperty("--heading-font");
      root.removeProperty("--heading-weight");
      root.removeProperty("--heading-transform");
      root.removeProperty("--heading-tracking");
    }
  }, [overrides.headingStyle]);

  useEffect(() => {
    const root = document.documentElement.style;
    if (overrides.backgroundStyle) {
      const b = backgroundPatternFor(overrides.backgroundStyle);
      root.setProperty("--bg-pattern", b.image);
      root.setProperty("--bg-pattern-size", b.size);
    } else {
      root.removeProperty("--bg-pattern");
      root.removeProperty("--bg-pattern-size");
    }
  }, [overrides.backgroundStyle]);

  useEffect(() => {
    const root = document.documentElement.style;
    if (overrides.motionStyle) {
      const m = motionFor(overrides.motionStyle);
      root.setProperty("--motion-speed", m.speed);
      root.setProperty("--motion-easing", m.easing);
      root.setProperty("--hover-lift", m.hoverLift);
      root.setProperty("--hover-scale", m.hoverScale);
    } else {
      root.removeProperty("--motion-speed");
      root.removeProperty("--motion-easing");
      root.removeProperty("--hover-lift");
      root.removeProperty("--hover-scale");
    }
  }, [overrides.motionStyle]);

  // Designer-defined sliders (see theme/customSliders.ts) — each just
  // writes its current numeric value + unit straight onto the matching
  // CSS custom property, same mechanism as every other theme knob here.
  // Runs whenever any slider's value changes (not just on mount), so
  // dragging a slider in SettingsHomePage updates the live page
  // immediately.
  useEffect(() => {
    const root = document.documentElement.style;
    for (const slider of customSliders) {
      root.setProperty(slider.cssVar, `${slider.value}${slider.unit}`);
    }
  }, [customSliders]);

  // The raw-CSS escape hatch. Kept as the last child of <body> — rather
  // than in <head>, and re-appended (which moves an existing node)
  // every time this runs — so it always sits after every other
  // stylesheet in document order and wins any same-specificity tie,
  // regardless of how many page-specific <style> tags Vite has injected
  // into <head> by the time this runs.
  useEffect(() => {
    let el = document.getElementById("theme-custom-css") as HTMLStyleElement | null;
    if (!el) {
      el = document.createElement("style");
      el.id = "theme-custom-css";
    }
    document.body.appendChild(el);
    el.textContent = theme.customCss;
  }, [theme.customCss]);

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

  const setCustomSliderValue = async (id: string, rawValue: number) => {
    const slider = customSliders.find((s) => s.id === id);
    if (!slider) return;
    const value = clampSliderValue(slider, rawValue);
    await setCustomSliderValueInDb(id, value);
    setCustomSlidersState((prev) => prev.map((s) => (s.id === id ? { ...s, value } : s)));
  };

  // Full replace, mirroring replaceTheme — used when a theme
  // export/preset/AI-designed theme is applied. Every slider resets to
  // its authored default value.
  const replaceCustomSliders = async (defs: CustomSliderDef[]) => {
    await replaceCustomSlidersInDb(defs);
    setCustomSlidersState(defs.map((d) => ({ ...d, value: d.default })));
  };

  return (
    <ThemeContext.Provider
      value={{
        theme,
        overrides,
        setThemeValue,
        resetThemeValue,
        replaceTheme,
        customSliders,
        setCustomSliderValue,
        replaceCustomSliders,
      }}
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
