import { useEffect } from "react";
import { View } from "../types/nav";
import { useDynamicOverlay } from "./DynamicOverlayContext";
import { useOverlayTargetInteraction } from "./useOverlayTargetInteraction";
import "./OverlayTargetHighlighter.css";

// Mounts the reverse-jump interaction (click/hover+key on a live
// data-overlay-target element -> settings page/row) and toggles the
// body class that lights up tagged elements with a hover affordance
// while overlay mode is active. Kept as its own small component (rather
// than folding into DynamicOverlayPanel) since it has nothing to render
// — it only needs to be mounted once, same tier as DynamicOverlayPanel.
export function OverlayTargetHighlighter({ view }: { view: View }) {
  const { active } = useDynamicOverlay();
  useOverlayTargetInteraction(view);

  useEffect(() => {
    document.body.classList.toggle("dyn-overlay-active", active);
    return () => document.body.classList.remove("dyn-overlay-active");
  }, [active]);

  return null;
}
