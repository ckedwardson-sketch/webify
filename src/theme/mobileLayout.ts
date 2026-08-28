// Central "is the app currently rendering in mobile layout" computation
// — driven by Settings > Theme > Mobile layout (auto/on/off), see
// themeFieldGroups.ts. ThemeContext keeps html.mobile-layout /
// html.mobile-landscape in sync with this on mount and on every
// resize/orientation change, so CSS keys off those classes directly
// instead of a raw @media query — a class is the only way a forced
// on/off setting can actually change rendering. Also exported for the
// one bit of plain JS (Sidebar's auto-close after a mobile nav tap) that
// needs the same answer outside of CSS.
export type MobileMode = "auto" | "on" | "off";

const WIDTH_QUERY = "(max-width: 768px)";
// Catches a real phone/tablet held sideways — those are typically wider
// than 768px but short, so width alone would miss them.
const SHORT_LANDSCAPE_QUERY = "(orientation: landscape) and (max-height: 500px)";

function viewportLooksMobile(): boolean {
  return window.matchMedia(WIDTH_QUERY).matches || window.matchMedia(SHORT_LANDSCAPE_QUERY).matches;
}

export function computeMobileLayout(mode: MobileMode): boolean {
  if (mode === "on") return true;
  if (mode === "off") return false;
  return viewportLooksMobile();
}

// Orientation is tracked live even in a forced mode — forcing "on"
// pins the mobile layout on, but landscape vs. portrait still reflects
// the actual window shape.
export function computeMobileLandscape(isMobile: boolean): boolean {
  if (!isMobile) return false;
  return window.matchMedia("(orientation: landscape)").matches || window.innerWidth > window.innerHeight;
}

export function isMobileLayoutActive(): boolean {
  return document.documentElement.classList.contains("mobile-layout");
}
