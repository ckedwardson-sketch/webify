import { useRef, useState } from "react";
import { useTheme } from "../theme/ThemeContext";
import { defaultsForMode, ThemeSettings } from "../theme/themeDefaults";
import { ColorSurfaceControls } from "../theme/ColorSurfaceControls";
import "./ColorModePanel.css";

export interface ColorModeTarget {
  key: string;
  label: string;
  colorKey: keyof ThemeSettings;
  imageKey: keyof ThemeSettings;
  tileKey: keyof ThemeSettings;
  scaleKey: keyof ThemeSettings;
  // General-theme colors (bg/sidebarBg/inputBg) fall back to the
  // light/dark mode preset when unset — Web/Dream/Goal colors don't
  // have a light/dark split, so theme[colorKey] alone is already
  // correct for them (see ThemeQuickEdit in OverlayQuickEdit.tsx for
  // the same distinction).
  isGeneral: boolean;
}

// Exported so the ctrl+hover popover (ColorModeHoverPopover.tsx) can
// resolve a live element's data-color-surface key back to the same
// target definition this panel lists, instead of duplicating the list.
export const COLOR_MODE_TARGETS: ColorModeTarget[] = [
  {
    key: "page",
    label: "Main page background",
    colorKey: "bg",
    imageKey: "appBackgroundImage",
    tileKey: "appBackgroundTile",
    scaleKey: "appBackgroundScale",
    isGeneral: true,
  },
  {
    key: "sidebar",
    label: "Sidebar background",
    colorKey: "sidebarBg",
    imageKey: "sidebarBgImage",
    tileKey: "sidebarBgTile",
    scaleKey: "sidebarBgScale",
    isGeneral: true,
  },
  {
    key: "field",
    label: "Field background",
    colorKey: "inputBg",
    imageKey: "inputBgImage",
    tileKey: "inputBgTile",
    scaleKey: "inputBgScale",
    isGeneral: true,
  },
  {
    key: "recipe-web",
    label: "Recipe Web background",
    colorKey: "webBackground",
    imageKey: "webBackgroundImage",
    tileKey: "webBackgroundTile",
    scaleKey: "webBackgroundScale",
    isGeneral: false,
  },
  {
    key: "dream-web",
    label: "Dream Web background",
    colorKey: "dreamWebBackground",
    imageKey: "dreamWebBackgroundImage",
    tileKey: "dreamWebBackgroundTile",
    scaleKey: "dreamWebBackgroundScale",
    isGeneral: false,
  },
  {
    key: "goal-web",
    label: "Goal Web background",
    colorKey: "goalWebBackground",
    imageKey: "goalWebBackgroundImage",
    tileKey: "goalWebBackgroundTile",
    scaleKey: "goalWebBackgroundScale",
    isGeneral: false,
  },
];

// Binds one ColorModeTarget to the live ThemeContext — shared by this
// panel's own list and the ctrl+hover popover so both read/write
// through the exact same path.
export function useGlobalColorModeTarget(target: ColorModeTarget) {
  const { theme, overrides, setThemeValue, resetThemeValue } = useTheme();
  const modeDefaults = defaultsForMode(theme.mode);

  const color = (() => {
    if (target.isGeneral) {
      const ov = overrides[target.colorKey] as string | undefined;
      if (ov) return ov;
      if (target.colorKey in modeDefaults) {
        return (modeDefaults as unknown as Record<string, string>)[target.colorKey as string];
      }
    }
    return theme[target.colorKey] as string;
  })();
  const image = (theme[target.imageKey] as string) || "";
  const tile = theme[target.tileKey] === "1";
  const scale = (theme[target.scaleKey] as string) || "128";
  const hasOverride =
    !!overrides[target.colorKey] || !!overrides[target.imageKey] || !!overrides[target.tileKey] || !!overrides[target.scaleKey];

  return {
    color,
    image,
    tile,
    scale,
    hasOverride,
    setColor: (hex: string) => setThemeValue(target.colorKey, hex),
    setImage: (dataUrl: string) => setThemeValue(target.imageKey, dataUrl),
    setTile: (tiled: boolean) => setThemeValue(target.tileKey, tiled ? "1" : "0"),
    setScale: (scale: string) => setThemeValue(target.scaleKey, scale),
    reset: () => {
      resetThemeValue(target.colorKey);
      resetThemeValue(target.imageKey);
      resetThemeValue(target.tileKey);
      resetThemeValue(target.scaleKey);
    },
  };
}

function ColorModeTargetRow({ target, open, onToggle }: { target: ColorModeTarget; open: boolean; onToggle: () => void }) {
  const binding = useGlobalColorModeTarget(target);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => binding.setImage(reader.result as string);
    reader.readAsDataURL(file);
  };

  return (
    <div className="color-mode-target">
      <button type="button" className="color-mode-target-header" onClick={onToggle}>
        <span
          className="color-mode-target-swatch"
          style={
            binding.image
              ? { backgroundImage: `url("${binding.image}")`, backgroundSize: "cover", backgroundPosition: "center" }
              : { background: binding.color }
          }
        />
        <span className="color-mode-target-label">{target.label}</span>
        <span className="color-mode-target-caret">{open ? "▾" : "▸"}</span>
      </button>
      {open && (
        <>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={handleFileSelected}
          />
          <ColorSurfaceControls
            color={binding.color}
            onColorChange={binding.setColor}
            image={binding.image}
            onImagePick={() => fileInputRef.current?.click()}
            onImageRemove={() => binding.setImage("")}
            tile={binding.tile}
            onTileChange={binding.setTile}
            scale={binding.scale}
            onScaleChange={binding.setScale}
            hasOverride={binding.hasOverride}
            onReset={binding.reset}
          />
        </>
      )}
    </div>
  );
}

// The Color Mode entry point — every major background surface in the
// app, listed once, each expandable into a real color wheel + palette +
// hex input (ColorWheel.tsx) plus an image upload with tiling/scale.
// Deliberately excludes Progress Web: progressWebBackground exists as a
// theme field but has no page that actually renders it yet, so exposing
// it here would be a picker with no visible effect.
//
// This same picking flow is also reachable by ctrl+hovering the live
// surface itself while Color Mode is on (see ColorModeHoverPopover.tsx)
// — this panel and that popover share useGlobalColorModeTarget/
// ColorSurfaceControls so they stay in sync automatically.
export function ColorModePanel() {
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  return (
    <div className="color-mode-panel">
      <p className="color-mode-hint">
        Pick a surface to customize — a solid color, or an uploaded image, optionally tiled. Or,
        out in the app, ctrl+hover any highlighted surface (page backgrounds, sidebar, fields —
        even a specific project/goal/dream/recipe page) to edit it right there.
      </p>
      <div className="color-mode-target-list">
        {COLOR_MODE_TARGETS.map((t) => (
          <ColorModeTargetRow
            key={t.key}
            target={t}
            open={expandedKey === t.key}
            onToggle={() => setExpandedKey((k) => (k === t.key ? null : t.key))}
          />
        ))}
      </div>
    </div>
  );
}
