// Surface treatment presets — how every raised panel (buttons, cards,
// sidebar items, settings rows) renders its edge and depth. A single
// named knob fans out to border width, shadow, and (for "glass")
// backdrop blur + translucency, rather than theming each surface's
// border/shadow independently.
export interface SurfaceScale {
  borderWidth: string;
  shadow: string;
  backdropFilter: string;
  // Percentage string consumed by color-mix() to blend a surface's
  // background color toward transparent — "100%" is fully opaque.
  bgOpacity: string;
}

export const SURFACE_PRESETS: Record<string, SurfaceScale> = {
  bordered: { borderWidth: "1px", shadow: "none", backdropFilter: "none", bgOpacity: "100%" },
  flat: { borderWidth: "0px", shadow: "none", backdropFilter: "none", bgOpacity: "100%" },
  elevated: {
    borderWidth: "1px",
    shadow: "0 2px 10px rgba(0, 0, 0, 0.14)",
    backdropFilter: "none",
    bgOpacity: "100%",
  },
  glass: {
    borderWidth: "1px",
    shadow: "0 8px 24px rgba(0, 0, 0, 0.18)",
    backdropFilter: "blur(14px)",
    bgOpacity: "70%",
  },
};

export const DEFAULT_SURFACE_STYLE = "bordered";

export function surfaceFor(key: string): SurfaceScale {
  return SURFACE_PRESETS[key] ?? SURFACE_PRESETS[DEFAULT_SURFACE_STYLE];
}
