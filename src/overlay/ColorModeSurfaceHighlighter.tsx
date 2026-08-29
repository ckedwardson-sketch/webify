import { useEffect } from "react";
import { useDynamicOverlay } from "./DynamicOverlayContext";
import { useColorModeSurfaceInteraction } from "./useColorModeSurfaceInteraction";
import { ColorModeHoverPopover } from "./ColorModeHoverPopover";
import "./ColorModeSurfaceHighlighter.css";

// Mounts the ctrl+hover-to-color interaction (see
// useColorModeSurfaceInteraction) and the body class that lights up
// data-color-surface elements while Color Mode is open — same pairing
// OverlayTargetHighlighter does for the Dynamic Search overlay's own
// data-overlay-target elements.
export function ColorModeSurfaceHighlighter() {
  const { colorModeOpen } = useDynamicOverlay();
  const { open, close } = useColorModeSurfaceInteraction(colorModeOpen);

  useEffect(() => {
    document.body.classList.toggle("color-mode-active", colorModeOpen);
    return () => document.body.classList.remove("color-mode-active");
  }, [colorModeOpen]);

  if (!open) return null;
  return <ColorModeHoverPopover surfaceKey={open.key} rect={open.rect} onClose={close} />;
}
