import { Handle, Position } from "@xyflow/react";

export interface ProjectNodeData {
  name: string;
}

export const PROJECT_NODE_WIDTH = 110;
export const PROJECT_NODE_HEIGHT = 52;
const PROJECT_COLOR = "#f59e0b";

export function ProjectNode({ data }: { data: ProjectNodeData }) {
  return (
    <div
      style={{
        width: `${PROJECT_NODE_WIDTH}px`,
        height: `${PROJECT_NODE_HEIGHT}px`,
        borderRadius: "8px",
        border: `2px solid ${PROJECT_COLOR}`,
        background: "rgba(245, 158, 11, 0.18)",
        color: "#ffffff",
        boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
        padding: "6px 8px",
        boxSizing: "border-box",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        position: "relative",
      }}
    >
      <Handle type="target" position={Position.Left} style={{ opacity: 0 }} />
      <span
        style={{
          fontSize: "11px",
          fontWeight: 600,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          maxWidth: "100%",
        }}
      >
        {data.name}
      </span>
    </div>
  );
}
