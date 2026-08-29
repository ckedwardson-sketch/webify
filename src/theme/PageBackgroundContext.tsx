import React, { createContext, useContext, useEffect, useState } from "react";
import { View } from "../types/nav";
import {
  fetchPageBackgrounds,
  setPageBackground,
  clearPageBackground,
  PageSurfaceOverride,
} from "../db/pageBackgrounds";
import { scopeKeyForView } from "./pageScope";

interface PageBackgroundContextValue {
  // Null when the current view has no per-page surface at all (e.g.
  // Home, Settings) — callers should treat every setter as a no-op and
  // skip tagging data-color-surface in that case.
  scopeKey: string | null;
  overrides: Record<string, PageSurfaceOverride>;
  setSurfaceColor: (surfaceKey: string, hex: string) => void;
  setSurfaceImage: (surfaceKey: string, dataUrl: string) => void;
  setSurfaceTile: (surfaceKey: string, tiled: boolean) => void;
  setSurfaceScale: (surfaceKey: string, scale: string) => void;
  resetSurface: (surfaceKey: string) => void;
}

const PageBackgroundContext = createContext<PageBackgroundContextValue | null>(null);

export function PageBackgroundProvider({ view, children }: { view: View; children: React.ReactNode }) {
  const scopeKey = scopeKeyForView(view);
  const [overrides, setOverrides] = useState<Record<string, PageSurfaceOverride>>({});

  useEffect(() => {
    if (!scopeKey) {
      setOverrides({});
      return;
    }
    let cancelled = false;
    fetchPageBackgrounds(scopeKey)
      .then((rows) => {
        if (!cancelled) setOverrides(rows);
      })
      .catch((err) => console.warn("Failed to load page background overrides:", err));
    return () => {
      cancelled = true;
    };
  }, [scopeKey]);

  const patch = (surfaceKey: string, value: PageSurfaceOverride) => {
    if (!scopeKey) return;
    setOverrides((prev) => ({ ...prev, [surfaceKey]: { ...prev[surfaceKey], ...value } }));
    setPageBackground(scopeKey, surfaceKey, value).catch((err) =>
      console.warn("Failed to save page background override:", err)
    );
  };

  const resetSurface = (surfaceKey: string) => {
    if (!scopeKey) return;
    setOverrides((prev) => {
      const next = { ...prev };
      delete next[surfaceKey];
      return next;
    });
    clearPageBackground(scopeKey, surfaceKey).catch((err) =>
      console.warn("Failed to reset page background override:", err)
    );
  };

  return (
    <PageBackgroundContext.Provider
      value={{
        scopeKey,
        overrides,
        setSurfaceColor: (surfaceKey, hex) => patch(surfaceKey, { color: hex }),
        setSurfaceImage: (surfaceKey, dataUrl) => patch(surfaceKey, { imageData: dataUrl }),
        setSurfaceTile: (surfaceKey, tiled) => patch(surfaceKey, { tile: tiled ? "1" : "0" }),
        setSurfaceScale: (surfaceKey, scale) => patch(surfaceKey, { scale }),
        resetSurface,
      }}
    >
      {children}
    </PageBackgroundContext.Provider>
  );
}

export function usePageBackground(): PageBackgroundContextValue {
  const ctx = useContext(PageBackgroundContext);
  if (!ctx) throw new Error("usePageBackground must be used inside a PageBackgroundProvider");
  return ctx;
}

// Style for a page-scoped surface — merges its override (if any) into
// plain inline CSS, same cover/tile convention as the global Color Mode
// backgrounds (see ThemeContext's applyTileVars), just via inline style
// instead of a CSS custom property since this only ever applies to one
// page's own root element.
export function pageSurfaceStyle(override: PageSurfaceOverride | undefined): React.CSSProperties {
  if (!override) return {};
  const style: React.CSSProperties = {};
  if (override.color) style.backgroundColor = override.color;
  if (override.imageData) {
    style.backgroundImage = `url("${override.imageData}")`;
    if (override.tile === "1") {
      const scale = override.scale || "128";
      style.backgroundRepeat = "repeat";
      style.backgroundSize = `${scale}px ${scale}px`;
    } else {
      style.backgroundRepeat = "no-repeat";
      style.backgroundSize = "cover";
      style.backgroundPosition = "center";
    }
  }
  return style;
}
