import { ColorWheel } from "./ColorWheel";

// The body of one Color Mode target — a color wheel plus an optional
// tiled image — shared by the Color Mode panel's own expandable list
// (ColorModePanel.tsx) and the ctrl+hover floating popover
// (overlay/ColorModeHoverPopover.tsx), so picking a color reads and
// behaves identically no matter which entry point opened it.
export interface ColorSurfaceControlsProps {
  color: string;
  onColorChange: (hex: string) => void;
  image: string;
  onImagePick: () => void;
  onImageRemove: () => void;
  tile: boolean;
  onTileChange: (tiled: boolean) => void;
  scale: string;
  onScaleChange: (scale: string) => void;
  hasOverride: boolean;
  onReset: () => void;
}

export function ColorSurfaceControls({
  color,
  onColorChange,
  image,
  onImagePick,
  onImageRemove,
  tile,
  onTileChange,
  scale,
  onScaleChange,
  hasOverride,
  onReset,
}: ColorSurfaceControlsProps) {
  return (
    <div className="color-mode-target-body">
      <ColorWheel value={color} onChange={onColorChange} />
      <div className="color-mode-image-row">
        <button type="button" className="add-button secondary" onClick={onImagePick}>
          {image ? "Change image" : "Import image"}
        </button>
        {image && (
          <button type="button" className="add-button danger" onClick={onImageRemove}>
            Remove image
          </button>
        )}
      </div>
      {image && (
        <div className="color-mode-tile-row">
          <label className="color-mode-tile-toggle">
            <input type="checkbox" checked={tile} onChange={(e) => onTileChange(e.target.checked)} />
            Tile image
          </label>
          {tile && (
            <label className="color-mode-scale-row">
              Tile size (px)
              <input
                type="number"
                min={20}
                max={600}
                step={10}
                value={scale}
                onChange={(e) => onScaleChange(e.target.value)}
              />
            </label>
          )}
        </div>
      )}
      {hasOverride && (
        <button type="button" className="add-button danger color-mode-reset" onClick={onReset}>
          Reset to default
        </button>
      )}
    </div>
  );
}
