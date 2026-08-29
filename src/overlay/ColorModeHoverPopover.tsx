import { useRef } from "react";
import { COLOR_MODE_TARGETS, ColorModeTarget, useGlobalColorModeTarget } from "./ColorModePanel";
import { ColorSurfaceControls } from "../theme/ColorSurfaceControls";
import { usePageBackground } from "../theme/PageBackgroundContext";
import "./ColorModeHoverPopover.css";
import "./DynamicOverlayPanel.css"; // reusing .dyn-overlay-close
import "../components/ManagedListRow.css"; // reusing .menu-backdrop

const PAGE_SURFACE_LABELS: Record<string, string> = {
  "page-bg": "This page's background",
};

function useFileImagePicker(onPick: (dataUrl: string) => void) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => onPick(reader.result as string);
    reader.readAsDataURL(file);
  };
  return { fileInputRef, handleFileSelected, open: () => fileInputRef.current?.click() };
}

function GlobalSurfaceBody({ target }: { target: ColorModeTarget }) {
  const binding = useGlobalColorModeTarget(target);
  const picker = useFileImagePicker(binding.setImage);

  return (
    <>
      <input ref={picker.fileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={picker.handleFileSelected} />
      <ColorSurfaceControls
        color={binding.color}
        onColorChange={binding.setColor}
        image={binding.image}
        onImagePick={picker.open}
        onImageRemove={() => binding.setImage("")}
        tile={binding.tile}
        onTileChange={binding.setTile}
        scale={binding.scale}
        onScaleChange={binding.setScale}
        hasOverride={binding.hasOverride}
        onReset={binding.reset}
      />
    </>
  );
}

function PageSurfaceBody({ surfaceKey }: { surfaceKey: string }) {
  const { overrides, setSurfaceColor, setSurfaceImage, setSurfaceTile, setSurfaceScale, resetSurface } = usePageBackground();
  const override = overrides[surfaceKey];
  const color = override?.color || "#1a1a1a";
  const image = override?.imageData || "";
  const tile = override?.tile === "1";
  const scale = override?.scale || "128";
  const hasOverride = !!override?.color || !!override?.imageData;
  const picker = useFileImagePicker((dataUrl) => setSurfaceImage(surfaceKey, dataUrl));

  return (
    <>
      <input ref={picker.fileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={picker.handleFileSelected} />
      <ColorSurfaceControls
        color={color}
        onColorChange={(hex) => setSurfaceColor(surfaceKey, hex)}
        image={image}
        onImagePick={picker.open}
        onImageRemove={() => setSurfaceImage(surfaceKey, "")}
        tile={tile}
        onTileChange={(tiled) => setSurfaceTile(surfaceKey, tiled)}
        scale={scale}
        onScaleChange={(s) => setSurfaceScale(surfaceKey, s)}
        hasOverride={hasOverride}
        onReset={() => resetSurface(surfaceKey)}
      />
    </>
  );
}

// Clamps a popover anchored under `rect` so it never renders off-screen
// — the popover's own size isn't known until it paints, so this uses a
// generous fixed estimate rather than measuring, same tradeoff
// OverlayQuickEdit-style floating panels elsewhere in the app accept.
function popoverPosition(rect: DOMRect): { top: number; left: number } {
  const width = 280;
  const height = 380;
  let left = rect.left;
  let top = rect.bottom + 8;
  if (left + width > window.innerWidth - 8) left = window.innerWidth - width - 8;
  if (left < 8) left = 8;
  if (top + height > window.innerHeight - 8) top = Math.max(8, rect.top - height - 8);
  return { top, left };
}

export function ColorModeHoverPopover({
  surfaceKey,
  rect,
  onClose,
}: {
  surfaceKey: string;
  rect: DOMRect;
  onClose: () => void;
}) {
  const globalTarget = COLOR_MODE_TARGETS.find((t) => t.key === surfaceKey);
  const label = globalTarget?.label ?? PAGE_SURFACE_LABELS[surfaceKey] ?? surfaceKey;
  const { top, left } = popoverPosition(rect);

  return (
    <>
      <div className="menu-backdrop" onClick={onClose} />
      <div className="color-hover-popover" style={{ top, left }}>
        <div className="color-hover-popover-header">
          <span>{label}</span>
          <button className="dyn-overlay-close" onClick={onClose} aria-label="Close color editor">
            ✕
          </button>
        </div>
        {globalTarget ? <GlobalSurfaceBody target={globalTarget} /> : <PageSurfaceBody surfaceKey={surfaceKey} />}
      </div>
    </>
  );
}
