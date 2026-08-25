// Motion presets — how every interactive surface (buttons, sidebar
// items, cards) transitions and responds to hover, app-wide. A
// dimension of theming distinct from color/shape/typography: the
// same palette feels completely different at "none" vs "lively".
export interface MotionScale {
  speed: string;
  easing: string;
  hoverLift: string; // translateY() on hover
  hoverScale: string; // scale() on hover
}

export const MOTION_PRESETS: Record<string, MotionScale> = {
  none: { speed: "0ms", easing: "linear", hoverLift: "0px", hoverScale: "1" },
  subtle: { speed: "150ms", easing: "ease", hoverLift: "-1px", hoverScale: "1.01" },
  lively: {
    speed: "220ms",
    easing: "cubic-bezier(0.34, 1.56, 0.64, 1)",
    hoverLift: "-3px",
    hoverScale: "1.03",
  },
};

export const DEFAULT_MOTION_STYLE = "subtle";

export function motionFor(key: string): MotionScale {
  return MOTION_PRESETS[key] ?? MOTION_PRESETS[DEFAULT_MOTION_STYLE];
}
