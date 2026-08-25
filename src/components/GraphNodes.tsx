// src/components/GraphNodes.tsx
import React from "react";
import { Handle, Position } from "@xyflow/react";
import { Icon } from "../icons/Icon";
import { useTheme } from "../theme/ThemeContext";
import { clipPathFor } from "../theme/nodeShapes";

const CARD_SHADOWS: Record<string, string> = {
  none: "none",
  soft: "0 4px 10px rgba(0,0,0,0.3)",
  strong: "0 8px 22px rgba(0,0,0,0.55)",
};

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
    onIterationClick?: (e: React.MouseEvent) => void;
  };
}) {
  const isProven = data.isProven ?? false;
  const isFavorite = data.isFavorite ?? false;
  const hasImage = !!data.imageData;
  const { theme } = useTheme();
  const isFill = theme.webCardImageStyle === "fill" && hasImage;
  const radius = `${theme.webCardRadius || 10}px`;

  const cardStyle: React.CSSProperties = {
    width: "210px",
    height: "144px",
    borderRadius: radius,
    overflow: "hidden",
    position: "relative",
    display: "flex",
    flexDirection: "column",
    backgroundColor: isProven ? theme.webNodeProvenBackground : theme.webNodeUnprovenBackground,
    border: isFavorite ? "3px solid #facc15" : `2px solid ${theme.webNodeOutlineColor}`, // Gold lining for favorite
    boxShadow: isFavorite
      ? "0 0 12px rgba(250, 204, 21, 0.5)"
      : CARD_SHADOWS[theme.webCardShadow] ?? CARD_SHADOWS.soft,
    color: "#ffffff",
    clipPath: clipPathFor(theme.webCardShape),
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
        width: "22px",
        height: "22px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(255,255,255,0.15)",
        border: "1px solid rgba(255,255,255,0.35)",
        borderRadius: "4px",
        color: "#fff",
        cursor: "pointer",
        fontSize: "12px",
        padding: 0,
      }}
    >
      <Icon iconKey="iteration" size={12} />
    </button>
  );

  const statusIcons = (
    <>
      {data.isFrozen && (
        <span title="Frozen">
          <Icon iconKey="frozen" size={14} />
        </span>
      )}
      {data.isHomegrown && (
        <span title="Homegrown">
          <Icon iconKey="homegrown" size={14} />
        </span>
      )}
    </>
  );

  if (isFill) {
    return (
      <div style={cardStyle}>
        <Handle type="target" position={Position.Bottom} style={{ opacity: 0 }} />

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

        <div
          style={{
            position: "relative",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "5px 6px",
            gap: "6px",
          }}
        >
          <span
            style={{
              fontWeight: "bold",
              fontSize: "12px",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              textShadow: "0 1px 3px rgba(0,0,0,0.8)",
            }}
          >
            {data.label}
          </span>
          {iterationButton}
        </div>

        <div
          style={{
            position: "relative",
            marginTop: "auto",
            display: "flex",
            alignItems: "center",
            gap: "6px",
            padding: "0 6px 6px",
            fontSize: "14px",
          }}
        >
          {statusIcons}
        </div>

        <Handle type="source" position={Position.Top} style={{ opacity: 0 }} />
      </div>
    );
  }

  return (
    <div style={cardStyle}>
      <Handle type="target" position={Position.Bottom} style={{ opacity: 0 }} />

      {/* Header row: recipe name left, iteration button top-right */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "5px 6px",
          gap: "6px",
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontWeight: "bold",
            fontSize: "12px",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
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
          padding: "0 6px 6px",
          gap: "6px",
          minHeight: 0,
        }}
      >
        <div
          style={{
            width: "22px",
            flexShrink: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "6px",
            paddingTop: "4px",
            fontSize: "14px",
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
            <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.6)" }}>Image</span>
          )}
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
