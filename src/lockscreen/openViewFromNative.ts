import { View } from "../types/nav";
import { FIRST_LEVEL_DESTINATIONS } from "./lockScreenSettings";
import { getNative } from "./nativeBridge";

// Maps a first-level destination key (tile tap / future home-button
// style shortcuts) to the View App.tsx already navigates to from the
// sidebar. Unknown keys return null so a stale extra is ignored.
export function viewFromDestinationKey(key: string): View | null {
  if (!FIRST_LEVEL_DESTINATIONS.some((d) => d.key === key)) return null;
  switch (key) {
    case "home":
      return { type: "home" };
    case "checklist-home":
      return { type: "checklist-home" };
    case "tasks-home":
      return { type: "tasks-home" };
    case "goals-home":
      return { type: "goals-home" };
    case "projects-home":
      return { type: "projects-home" };
    case "dreams-web":
      return { type: "dreams-web" };
    case "responsibilities-home":
      return { type: "responsibilities-home" };
    case "recipes-home":
      return { type: "recipes-home" };
    case "notes":
      return { type: "notes" };
    case "skills-home":
      return { type: "skills-home" };
    case "quick-apps-home":
      return { type: "quick-apps-home" };
    case "settings-home":
      return { type: "settings-home" };
    default:
      return null;
  }
}

/**
 * If the Quick Settings tile (or another native entry point) asked to
 * open a first-level page, return that View and clear the pending flag.
 * Safe to call on every app start / resume; returns null when nothing
 * is pending or when not running on Android.
 */
export function consumeNativeOpenView(): View | null {
  const native = getNative();
  if (!native?.consumeOpenView) return null;
  try {
    const key = native.consumeOpenView();
    if (!key) return null;
    return viewFromDestinationKey(key);
  } catch {
    return null;
  }
}
