// Typed access to the Android-only `WebifyNative` object that
// MainActivity.kt attaches to the WebView (see LockScreenBridge.kt).
// It doesn't exist on desktop or in a plain browser, so everything
// here goes through getNative() and callers handle null.
export interface WebifyNativeApi {
  // Saves the payload and redraws the lock screen if the current frame
  // changed. Returns "ok", "ok (unchanged)", "disabled" or "error: ...".
  push(json: string): string;
  // Takes a data: URL (JPEG), stores it on the phone as the background.
  setBackground(dataUrl: string): string;
  clearBackground(): string;
  hasBackground(): boolean;
  // Small JPEG data: URL of the stored background, or "" if none.
  getBackgroundPreview(): string;
  // Writes the remaining-checklist count + tile destination into the
  // SharedPreferences ChecklistTileService reads, then asks the system
  // to refresh the tile. count < 0 means "don't show a number".
  // Returns "ok" or "error: ...".
  updateQuickTile(count: number, destination: string, enabled: boolean): string;
  // One-shot deep-link target left by a tile tap (or ""). Cleared as
  // soon as JS reads it so a later resume doesn't re-navigate.
  consumeOpenView(): string;
}

declare global {
  interface Window {
    WebifyNative?: WebifyNativeApi;
  }
}

export function getNative(): WebifyNativeApi | null {
  return typeof window !== "undefined" && window.WebifyNative ? window.WebifyNative : null;
}
