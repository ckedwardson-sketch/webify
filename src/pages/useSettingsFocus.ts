import { useEffect } from "react";

// Scrolls a row into view and briefly highlights it when arriving from
// a Settings search result. Rows opt in by carrying
// data-settings-key="{key}" matching the key passed here.
export function useSettingsFocus(focusKey?: string) {
  useEffect(() => {
    if (!focusKey) return;
    const el = document.querySelector(`[data-settings-key="${CSS.escape(focusKey)}"]`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("settings-highlight");
    const timer = setTimeout(() => el.classList.remove("settings-highlight"), 1600);
    return () => clearTimeout(timer);
  }, [focusKey]);
}
