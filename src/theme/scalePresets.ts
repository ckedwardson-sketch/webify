// Corner-radius and spacing/density presets. Each is a single named
// knob that cascades to several CSS custom properties, rather than
// dozens of individually-themeable radius/padding values.
export interface RadiusScale {
  sm: string;
  md: string;
  lg: string;
}

export const RADIUS_PRESETS: Record<string, RadiusScale> = {
  sharp: { sm: "2px", md: "4px", lg: "6px" },
  subtle: { sm: "4px", md: "6px", lg: "10px" },
  rounded: { sm: "8px", md: "14px", lg: "22px" },
};

export const DEFAULT_RADIUS_SCALE = "subtle";

export function radiusFor(key: string): RadiusScale {
  return RADIUS_PRESETS[key] ?? RADIUS_PRESETS[DEFAULT_RADIUS_SCALE];
}

export interface DensityScale {
  xs: string;
  sm: string;
  md: string;
  lg: string;
  pageX: string;
  pageY: string;
}

export const DENSITY_PRESETS: Record<string, DensityScale> = {
  compact: { xs: "2px", sm: "6px", md: "10px", lg: "16px", pageX: "28px", pageY: "24px" },
  comfortable: { xs: "4px", sm: "8px", md: "14px", lg: "24px", pageX: "48px", pageY: "40px" },
};

export const DEFAULT_DENSITY = "comfortable";

export function densityFor(key: string): DensityScale {
  return DENSITY_PRESETS[key] ?? DENSITY_PRESETS[DEFAULT_DENSITY];
}
