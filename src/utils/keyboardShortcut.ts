// Shared key-combo serialization for configurable shortcuts (currently
// just Dual-Pane Web Mode's toggle — see SettingsPanelMemoryPage.tsx's
// recorder row and App.tsx's global keydown listener, which must
// normalize identically or a recorded combo would never match.

const MODIFIER_KEYS = new Set(["Control", "Shift", "Alt", "Meta"]);

export const DEFAULT_DUAL_PANE_WEB_SHORTCUT = "ctrl+shift+d";

// Returns null for a bare modifier press (nothing useful to bind yet —
// the recorder should keep listening) or Escape (reserved elsewhere in
// the app for closing popovers/panels).
export function serializeKeyEvent(e: KeyboardEvent): string | null {
  if (MODIFIER_KEYS.has(e.key)) return null;
  if (e.key === "Escape") return null;

  const parts: string[] = [];
  if (e.ctrlKey) parts.push("ctrl");
  if (e.altKey) parts.push("alt");
  if (e.shiftKey) parts.push("shift");
  if (e.metaKey) parts.push("meta");
  parts.push(e.key.length === 1 ? e.key.toLowerCase() : e.key.toLowerCase());
  return parts.join("+");
}

// For displaying a stored combo back to the user, e.g. "ctrl+shift+d" -> "Ctrl+Shift+D".
export function formatShortcut(combo: string): string {
  return combo
    .split("+")
    .map((part) => (part.length === 1 ? part.toUpperCase() : part[0].toUpperCase() + part.slice(1)))
    .join("+");
}
