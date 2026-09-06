// src/components/GraphNodes.tsx
import React from "react";
import { Handle, Position, useViewport } from "@xyflow/react";
import { Icon } from "../icons/Icon";
import { useTheme } from "../theme/ThemeContext";
import { clipPathFor, contentInsetFor } from "../theme/nodeShapes";

const CARD_SHADOWS: Record<string, string> = {
  none: "none",
  soft: "0 4px 10px rgba(0,0,0,0.3)",
  strong: "0 8px 22px rgba(0,0,0,0.55)",
};

// Text is rendered in canvas-space, so its on-screen size is
// fontSize * zoom no matter how big the card's own box is — category
// sizing alone can't keep cards legible once React Flow's fitView
// zooms out to show every category at once. This claws some of that
// back the same way DreamGraphNodes.zoomCompensation does: the card
// grows visually (around its own center, via the anchor/visual split
// below) as the view zooms out, capped so it doesn't dominate the
// canvas or swallow neighboring cards. Capped lower than Dream's 1.6x
// since Recipe Web cards sit much closer together (column grids, not
// free-floating).
export function recipeZoomCompensation(zoom: number): number {
  return Math.min(1.35, Math.max(1, 1 / Math.pow(Math.max(zoom, 0.15), 0.45)));
}

export function CategoryNode({ data }: { data: { label: string } }) {
  const { theme } = useTheme();
  return (
    <div
      style={{
        padding: "10px 16px",
        borderRadius: "8px",
        background: theme.webCategoryNodeBackground,
        color: "#ffffff",
        fontWeight: "bold",
        fontSize: "14px",
        border: `2px solid ${theme.accent}`,
        textAlign: "center",
        boxShadow: "0 4px 12px rgba(0,0,0,0.25)",
      }}
    >
      <Handle type="target" position={Position.Bottom} style={{ opacity: 0 }} />
      {data.label}
      <Handle type="source" position={Position.Top} style={{ opacity: 0 }} />
    </div>
  );
}

export function RecipeCardNode({
  data,
}: {
  data: {
    label: string;
    imageData?: string;
    isFrozen?: boolean;
    isHomegrown?: boolean;
    isFavorite?: boolean;
    isProven?: boolean;
    isFutureSlot?: boolean;
    onIterationClick?: (e: React.MouseEvent) => void;
    width?: number;
    height?: number;
    fontScale?: number;
  };
}) {
  const isProven = data.isProven ?? false;
  const isFavorite = data.isFavorite ?? false;
  const isFutureSlot = data.isFutureSlot ?? false;
  const hasImage = !!data.imageData;
  const { theme } = useTheme();
  const { zoom } = useViewport();
  const isFill = theme.webCardImageStyle === "fill" && hasImage;
  const radius = `${theme.webCardRadius || 10}px`;
  const inset = contentInsetFor(theme.webCardShape);
  // Anchor size — the category-scale size, NOT zoom-compensated. React
  // Flow's Handles (and RecipesGraphPage's own column/gap layout math)
  // stay pinned to this so edges and card positions never drift as you
  // zoom; only the inner visual box below grows/shrinks around its
  // center on top of it.
  const anchorWidth = data.width ?? 210;
  const anchorHeight = data.height ?? 144;
  const comp = recipeZoomCompensation(zoom);
  const width = anchorWidth * comp;
  const height = anchorHeight * comp;
  const fontScale = (data.fontScale ?? 1) * comp;
  // Hard floors independent of any scale setting — text must stay
  // legible no matter how aggressively a category shrinks.
  const labelFontSize = Math.max(10, Math.round(13 * fontScale));
  const iconSize = Math.max(11, Math.round(14 * fontScale));
  const iterBtnSize = Math.max(18, Math.round(22 * fontScale));

  // Split in two: shapeBgStyle is the only thing clipped to a
  // non-rectangular silhouette (background/border/shadow, plus the photo
  // for the "fill" style — a cropped photo edge isn't lost information
  // the way clipped text or an icon would be). contentStyle holds every
  // bit of actual information (name, iteration button, status icons)
  // and is never clipped, just inset far enough to visually sit inside
  // the shape instead of overhanging past a cut corner.
  const shapeBgStyle: React.CSSProperties = {
    position: "absolute",
    inset: 0,
    borderRadius: radius,
    overflow: "hidden",
    backgroundColor: isFutureSlot
      ? "#3a1f5c"
      : isProven
      ? theme.webNodeProvenBackground
      : theme.webNodeUnprovenBackground,
    border: isFutureSlot
      ? "3px solid #c084fc" // future slot planning card — stands out from every other flag
      : isFavorite
      ? "3px solid #facc15" // Gold lining for favorite
      : `2px solid ${theme.webNodeOutlineColor}`,
    boxShadow: isFutureSlot
      ? "0 0 16px rgba(192, 132, 252, 0.65)"
      : isFavorite
      ? "0 0 12px rgba(250, 204, 21, 0.5)"
      : CARD_SHADOWS[theme.webCardShadow] ?? CARD_SHADOWS.soft,
    clipPath: clipPathFor(theme.webCardShape),
    pointerEvents: "none",
  };

  const contentStyle: React.CSSProperties = {
    position: "absolute",
    inset: `${inset.y}% ${inset.x}%`,
    display: "flex",
    flexDirection: "column",
    color: "#ffffff",
  };

  const iterationButton = (
    <button
      onClick={(e) => {
        e.stopPropagation();
        if (data.onIterationClick) data.onIterationClick(e);
      }}
      title="Toggle Iterations"
      style={{
        flexShrink: 0,
        width: `${iterBtnSize}px`,
        height: `${iterBtnSize}px`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(255,255,255,0.15)",
        border: "1px solid rgba(255,255,255,0.35)",
        borderRadius: "4px",
        color: "#fff",
        cursor: "pointer",
        fontSize: `${Math.round(12 * fontScale)}px`,
        padding: 0,
      }}
    >
      <Icon iconKey="iteration" size={Math.round(12 * fontScale)} />
    </button>
  );

  const statusIcons = (
    <>
      {data.isFrozen && (
        <span title="Frozen">
          <Icon iconKey="frozen" size={iconSize} />
        </span>
      )}
      {data.isHomegrown && (
        <span title="Homegrown">
          <Icon iconKey="homegrown" size={iconSize} />
        </span>
      )}
    </>
  );

  if (isFill) {
    return (
      <div style={{ width: `${anchorWidth}px`, height: `${anchorHeight}px`, position: "relative" }}>
        <Handle type="target" position={Position.Bottom} style={{ opacity: 0 }} />

        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            width: `${width}px`,
            height: `${height}px`,
            transform: "translate(-50%, -50%)",
          }}
        >
        <div style={shapeBgStyle}>
          <img
            src={data.imageData}
            alt=""
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
            }}
          />
          {/* Scrim so the header/status icons stay legible over an arbitrary photo */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.05) 40%, rgba(0,0,0,0.05) 70%, rgba(0,0,0,0.5) 100%)",
            }}
          />
        </div>

        <div style={contentStyle}>
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: "6px",
            }}
          >
            <span
              style={{
                fontWeight: "bold",
                fontSize: `${labelFontSize}px`,
                lineHeight: 1.2,
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
                textShadow: "0 1px 3px rgba(0,0,0,0.8)",
              }}
            >
              {data.label}
            </span>
            {iterationButton}
          </div>

          <div
            style={{
              marginTop: "auto",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              fontSize: `${iconSize}px`,
            }}
          >
            {statusIcons}
          </div>
        </div>
        </div>

        <Handle type="source" position={Position.Top} style={{ opacity: 0 }} />
      </div>
    );
  }

  return (
    <div style={{ width: `${anchorWidth}px`, height: `${anchorHeight}px`, position: "relative" }}>
      <Handle type="target" position={Position.Bottom} style={{ opacity: 0 }} />

      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          width: `${width}px`,
          height: `${height}px`,
          transform: "translate(-50%, -50%)",
        }}
      >
      <div style={shapeBgStyle} />

      <div style={contentStyle}>
        {/* Header row: recipe name left (wraps to 2 lines instead of
            truncating — this is the primary information on the card and
            should get the space it needs), iteration button top-right */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: "6px",
            flexShrink: 0,
          }}
        >
          <span
            style={{
              fontWeight: "bold",
              fontSize: `${labelFontSize}px`,
              lineHeight: 1.2,
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {data.label}
          </span>
          {iterationButton}
        </div>

        {/* Body row: frozen/homegrown icon sidebar left, image box right */}
        <div
          style={{
            display: "flex",
            flex: 1,
            paddingTop: "4px",
            gap: "6px",
            minHeight: 0,
          }}
        >
          <div
            style={{
              width: `${iterBtnSize}px`,
              flexShrink: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "6px",
              fontSize: `${iconSize}px`,
            }}
          >
            {statusIcons}
          </div>

          <div
            style={{
              flex: 1,
              borderRadius: "var(--radius-sm)",
              border: "1px solid rgba(255,255,255,0.3)",
              overflow: "hidden",
              backgroundColor: "rgba(0,0,0,0.2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {hasImage ? (
              <img
                src={data.imageData}
                alt=""
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            ) : (
              <span style={{ fontSize: `${Math.round(10 * fontScale)}px`, color: "rgba(255,255,255,0.6)" }}>
                Image
              </span>
            )}
          </div>
        </div>
      </div>
      </div>

      <Handle type="source" position={Position.Top} style={{ opacity: 0 }} />
    </div>
  );
}

export function IterationNode({ data }: { data: { label: string; difference: string } }) {
  const { theme } = useTheme();
  return (
    <div
      style={{
        width: "144px",
        minHeight: "68px",
        boxSizing: "border-box",
        padding: "8px 10px",
        borderRadius: "6px",
        background: theme.webIterationNodeBackground,
        color: "#ffffff",
        fontSize: "11px",
        border: `1px dashed ${theme.accent}`,
        boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
      }}
    >
      <Handle type="target" position={Position.Bottom} style={{ opacity: 0 }} />
      <div
        style={{
          fontWeight: "bold",
          marginBottom: "4px",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {data.label}
      </div>
      <div
        style={{
          fontStyle: "italic",
          opacity: 0.9,
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}
      >
        {data.difference || "Iteration diff"}
      </div>
    </div>
  );
}
