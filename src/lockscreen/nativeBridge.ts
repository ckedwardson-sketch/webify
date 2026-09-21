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
}

declare global {
  interface Window {
    WebifyNative?: WebifyNativeApi;
  }
}

export function getNative(): WebifyNativeApi | null {
  return typeof window !== "undefined" && window.WebifyNative ? window.WebifyNative : null;
}
