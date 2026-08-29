import { useEffect, useRef, useState } from "react";

export interface OpenColorSurface {
  key: string;
  rect: DOMRect;
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
}

// Reverse direction of ColorModePanel's own list, mirroring how
// useOverlayTargetInteraction relates to the Dynamic Search panel:
// while Color Mode is open, hovering a live element tagged
// data-color-surface="{key}" and pressing Ctrl opens a floating color
// editor for that exact surface, in place, instead of hunting for it in
// the panel's fixed target list.
export function useColorModeSurfaceInteraction(active: boolean) {
  const [open, setOpen] = useState<OpenColorSurface | null>(null);
  const hoveredEl = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!active) {
      setOpen(null);
      return;
    }

    const handleMouseOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      hoveredEl.current = target?.closest<HTMLElement>("[data-color-surface]") ?? null;
    };

    const handleMouseOut = (e: MouseEvent) => {
      const related = e.relatedTarget as HTMLElement | null;
      if (!related || !related.closest("[data-color-surface]")) {
        hoveredEl.current = null;
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return;
      // Same lone-non-repeating-Control convention as
      // useOverlayTargetInteraction, so this doesn't fire on Ctrl held
      // for an unrelated shortcut.
      if (e.key !== "Control" || e.repeat) return;
      const el = hoveredEl.current;
      if (!el) return;
      const key = el.getAttribute("data-color-surface");
      if (!key) return;
      e.preventDefault();
      setOpen({ key, rect: el.getBoundingClientRect() });
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

  return { open, close: () => setOpen(null) };
}
