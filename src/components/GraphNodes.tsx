// src/components/GraphNodes.tsx
import React from "react";
import { Handle, Position } from "@xyflow/react";

export function CategoryNode({ data }: { data: { label: string } }) {
  return (
    <div
      style={{
        padding: "10px 16px",
        borderRadius: "8px",
        background: "#1e3a8a",
        color: "#ffffff",
        fontWeight: "bold",
        fontSize: "14px",
        border: "2px solid #3b82f6",
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
    isFrozen?: boolean;
    isHomegrown?: boolean;
    isFavorite?: boolean;
    isProven?: boolean;
    onIterationClick?: (e: React.MouseEvent) => void;
  };
}) {
  const isProven = data.isProven ?? true;
  const isFavorite = data.isFavorite ?? false;

  const cardStyle: React.CSSProperties = {
    position: "relative",
    width: "160px",
    height: "110px",
    borderRadius: "10px",
    backgroundColor: isProven ? "#15803d" : "#4b5563", // Green for proven, Gray for unproven
    border: isFavorite ? "3px solid #facc15" : "2px solid rgba(255,255,255,0.2)", // Gold lining for favorite
    boxShadow: isFavorite ? "0 0 12px rgba(250, 204, 21, 0.5)" : "0 4px 10px rgba(0,0,0,0.3)",
    padding: "8px",
    boxSizing: "border-box",
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    color: "#ffffff",
  };

  return (
    <div style={cardStyle}>
      <Handle type="target" position={Position.Bottom} style={{ opacity: 0 }} />

      {/* Top Header Row */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        {/* Top-Left Badges (Frozen / Homegrown) */}
        <div style={{ display: "flex", gap: "4px", fontSize: "14px" }}>
          {data.isFrozen && <span title="Frozen">❄️</span>}
          {data.isHomegrown && <span title="Homegrown">🌱</span>}
        </div>

        {/* Top-Right Iteration Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (data.onIterationClick) data.onIterationClick(e);
          }}
          title="Toggle Iterations"
          style={{
            background: "rgba(255, 255, 255, 0.2)",
            border: "none",
            borderRadius: "4px",
            color: "#fff",
            cursor: "pointer",
            fontSize: "11px",
            padding: "2px 5px",
          }}
        >
          🌱 Iter
        </button>
      </div>

      {/* Center Recipe Title */}
      <div style={{ fontWeight: "bold", fontSize: "13px", textAlign: "center", margin: "4px 0" }}>
        {data.label}
      </div>

      {/* Image Placeholder Box (Matching Sketch Layout) */}
      <div
        style={{
          width: "100%",
          height: "36px",
          backgroundColor: "rgba(0, 0, 0, 0.25)",
          borderRadius: "4px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "10px",
          color: "#d1d5db",
        }}
      >
        [ Image ]
      </div>

      <Handle type="source" position={Position.Top} style={{ opacity: 0 }} />
    </div>
  );
}

export function IterationNode({ data }: { data: { label: string; difference: string } }) {
  return (
    <div
      style={{
        padding: "8px 12px",
        borderRadius: "6px",
        background: "#0284c7",
        color: "#ffffff",
        fontSize: "11px",
        maxWidth: "140px",
        border: "1px dashed #38bdf8",
        boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
      }}
    >
      <Handle type="target" position={Position.Bottom} style={{ opacity: 0 }} />
      <div style={{ fontWeight: "bold", marginBottom: "2px" }}>{data.label}</div>
      <div style={{ fontStyle: "italic", opacity: 0.9 }}>{data.difference || "Iteration diff"}</div>
    </div>
  );
}