import { useEffect, useRef } from "react";
import { View } from "../types/nav";
import { findSettingsItemByKey } from "../pages/settingsSearchIndex";
import { useDynamicOverlay } from "./DynamicOverlayContext";

// Reverse direction of the overlay panel: while overlay mode is active,
// hovering a live element tagged data-overlay-target="{key}" and pressing
// the jump key/modifier jumps to the settings row controlling it, instead
// of opening the overlay panel's own tree and hunting for it manually.
// Clicks on tagged elements are intentionally left alone (no interception)
// so the app stays fully usable while overlay mode is on. The jump always
// opens the setting as an inline quick-edit in the panel — never
// navigates to a real settings page — so hovering the Notes toolbar and
// pressing Ctrl edits it right there without leaving Notes.
const JUMP_KEY = "j";

function isKeyInDom(key: string): boolean {
  return !!document.querySelector(`[data-settings-key="${CSS.escape(key)}"]`);
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
}

export function useOverlayTargetInteraction(view: View) {
  const { active, addPin, requestFocus, requestQuickEdit } = useDynamicOverlay();
  const hoveredEl = useRef<HTMLElement | null>(null);

  // Keep latest view/addPin/requestFocus/requestQuickEdit available to
  // the listeners below without re-attaching them on every render.
  const latest = useRef({ view, addPin, requestFocus, requestQuickEdit });
  latest.current = { view, addPin, requestFocus, requestQuickEdit };

  useEffect(() => {
    if (!active) return;

    const jumpToKey = (key: string, pin: boolean) => {
      const item = findSettingsItemByKey(key);
      if (!item) return;
      const { view, addPin, requestFocus, requestQuickEdit } = latest.current;
      if (pin) {
        addPin({ key: item.key, label: item.label, pageType: item.view.type });
      }
      if (item.view.type === view.type && isKeyInDom(item.key)) {
        requestFocus(item.key);
      }
      requestQuickEdit(item);
    };

    const handleMouseOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      hoveredEl.current = target?.closest<HTMLElement>("[data-overlay-target]") ?? null;
    };

    const handleMouseOut = (e: MouseEvent) => {
      const related = e.relatedTarget as HTMLElement | null;
      if (!related || !related.closest("[data-overlay-target]")) {
        hoveredEl.current = null;
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return;
      const el = hoveredEl.current;
      if (!el) return;

      // Ctrl is commonly held for other shortcuts (copy/paste/etc), so
      // only treat a lone, non-repeating Control keydown as the trigger —
      // never e.ctrlKey on some other key, which would fire on Ctrl+C etc.
      const isCtrlTrigger = e.key === "Control" && !e.repeat;
      const isJTrigger = e.key.toLowerCase() === JUMP_KEY && !e.metaKey && !e.ctrlKey && !e.altKey;
      if (!isCtrlTrigger && !isJTrigger) return;

      const key = el.getAttribute("data-overlay-target");
      if (!key) return;
      e.preventDefault();
      jumpToKey(key, e.shiftKey);
    };

    document.addEventListener("mouseover", handleMouseOver);
    document.addEventListener("mouseout", handleMouseOut);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mouseover", handleMouseOver);
      document.removeEventListener("mouseout", handleMouseOut);
      document.removeEventListener("keydown", handleKeyDown);
      hoveredEl.current = null;
    };
  }, [active]);
}
