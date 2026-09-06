// src/components/GoalGraphNodes.tsx
//
// Card node types shared by GoalWebPage (one goal's own web) and
// DreamWebPage's "full" view (which renders the same cards, once per
// visible goal, via webGraph/goalCluster.ts) — hoisted out of
// GoalWebPage.tsx so both pages render byte-identical cards instead of
// two copies drifting apart.
import { useTheme } from "../theme/ThemeContext";
import { NodeCardFields } from "./NodeCardFields";
import { NodeCardTextItem } from "../theme/nodeCardFields";
import { ProjectWidget } from "../types/project";
import { CardAngleRing } from "./DreamGraphNodes";
import "../pages/GoalWebPage.css";

// A ring of 32 grab points around a card's whole rectangular boundary —
// drag from anywhere on the edge to link this node to another (see
// GoalWebPage.tsx's onConnect/goal_web_links), same "grab from anywhere
// on the edge" convention Dream Web's own links use (CardAngleRing,
// see DreamGraphNodes.tsx), rather than two fixed dots.
export const GoalWebLinkHandles = CardAngleRing;

export interface GoalSummaryNodeData {
  webFields: NodeCardTextItem[];
  widgets: ProjectWidget[];
  onOpenWidget: (widget: ProjectWidget) => void;
}

export function GoalSummaryNode({ data }: { data: GoalSummaryNodeData }) {
  const { theme } = useTheme();
  const hasExtras = data.webFields.length > 0 || data.widgets.length > 0;
  const growToFit = theme.nodeCardGrowToFit === "1";
  return (
    <div
      style={{
        width: "180px",
        minHeight: "90px",
        borderRadius: "14px",
        border: `2px dashed ${theme.accent}`,
        background: "rgba(0,0,0,0.35)",
        color: "#ffffff",
        padding: "10px 12px",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        gap: "4px",
        cursor: "pointer",
        position: "relative",
      }}
      title="Goal's own goals — click to edit on the goal page"
    >
      <GoalWebLinkHandles />
      <span style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.04em", color: theme.accent }}>
        🎯 GOAL
      </span>
      {hasExtras ? (
        <NodeCardFields
          items={data.webFields}
          widgets={data.widgets}
          onOpenWidget={data.onOpenWidget}
          fullText={growToFit}
          capHeightPx={growToFit ? undefined : 70}
        />
      ) : (
        <span style={{ fontSize: "11px", opacity: 0.7 }}>
          Nothing shown yet — pick fields to show on the web via 🎨 on the goal page.
        </span>
      )}
    </div>
  );
}

export interface ProjectCardNodeData {
  name: string;
  onUnlink: () => void;
  onAddTask: () => void;
  webFields: NodeCardTextItem[];
  widgets: ProjectWidget[];
  onOpenWidget: (widget: ProjectWidget) => void;
}

export function ProjectCardNode({ data }: { data: ProjectCardNodeData }) {
  const { theme } = useTheme();
  const growToFit = theme.nodeCardGrowToFit === "1";
  return (
    <div
      style={{
        width: "180px",
        minHeight: "84px",
        borderRadius: "12px",
        border: `2px solid ${theme.goalProjectNodeOutlineColor}`,
        background: theme.goalProjectNodeBackground,
        color: "#ffffff",
        padding: "9px 11px",
        boxSizing: "border-box",
        cursor: "pointer",
        boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
        position: "relative",
      }}
    >
      <GoalWebLinkHandles />
      <button
        onClick={(e) => {
          e.stopPropagation();
          data.onAddTask();
        }}
        title="Add a task to this project"
        style={{
          position: "absolute",
          top: 4,
          left: 4,
          border: "none",
          background: "rgba(0,0,0,0.3)",
          color: "#fff",
          borderRadius: "4px",
          width: 16,
          height: 16,
          lineHeight: "16px",
          fontSize: "11px",
          cursor: "pointer",
          padding: 0,
        }}
      >
        +
      </button>
      <button
        onClick={(e) => {
          e.stopPropagation();
          data.onUnlink();
        }}
        title="Detach from this goal"
        style={{
          position: "absolute",
          top: 4,
          right: 4,
          border: "none",
          background: "rgba(0,0,0,0.3)",
          color: "#fff",
          borderRadius: "4px",
          width: 16,
          height: 16,
          lineHeight: "16px",
          fontSize: "10px",
          cursor: "pointer",
          padding: 0,
        }}
      >
        ✕
      </button>
      <div
        style={{
          fontWeight: 700,
          fontSize: "13px",
          marginBottom: "4px",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          paddingRight: "18px",
        }}
      >
        📁 {data.name}
      </div>
      {data.webFields.length > 0 || data.widgets.length > 0 ? (
        <NodeCardFields
          items={data.webFields}
          widgets={data.widgets}
          onOpenWidget={data.onOpenWidget}
          fullText={growToFit}
          capHeightPx={growToFit ? undefined : 60}
        />
      ) : (
        <div style={{ fontSize: "11px", opacity: 0.7 }}>No details shown — see 🎨 on the project page.</div>
      )}
    </div>
  );
}

export interface ResponsibilityCardData {
  name: string;
  description: string;
  consistencyPct: number | null; // null = not meaningful (yearly) — see responsibilities/scheduling.ts
  daysPerWeek: number | null;
  taskTimeHours?: number;
  onUnlink: () => void;
}

export function ResponsibilityCardNode({ data }: { data: ResponsibilityCardData }) {
  const stats: string[] = [];
  if (data.consistencyPct !== null) stats.push(`${data.consistencyPct}%`);
  if (data.daysPerWeek !== null) stats.push(`${data.daysPerWeek}d/wk`);
  if (data.taskTimeHours) stats.push(`${data.taskTimeHours}h`);

  return (
    <div
      style={{
        width: "170px",
        minHeight: "104px",
        borderRadius: "10px",
        border: "2px solid #f59e0b",
        background: "#78350f",
        color: "#ffffff",
        padding: "8px 10px",
        boxSizing: "border-box",
        cursor: "pointer",
        boxShadow: "0 3px 8px rgba(0,0,0,0.3)",
        position: "relative",
        display: "flex",
        flexDirection: "column",
        gap: "5px",
      }}
    >
      <GoalWebLinkHandles />
      <button
        onClick={(e) => {
          e.stopPropagation();
          data.onUnlink();
        }}
        title="Unlink from this goal"
        style={{
          position: "absolute",
          top: 4,
          right: 4,
          border: "none",
          background: "rgba(0,0,0,0.3)",
          color: "#fff",
          borderRadius: "4px",
          width: 16,
          height: 16,
          lineHeight: "16px",
          fontSize: "10px",
          cursor: "pointer",
          padding: 0,
        }}
      >
        ✕
      </button>

      <span
        style={{
          fontSize: "12px",
          fontWeight: 700,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          paddingRight: "18px",
        }}
      >
        📋 {data.name}
      </span>

      {data.consistencyPct !== null && (
        <div style={{ height: "4px", borderRadius: "2px", background: "rgba(0,0,0,0.3)", overflow: "hidden" }}>
          <div
            style={{
              height: "100%",
              width: `${data.consistencyPct}%`,
              background: data.consistencyPct >= 70 ? "#4ade80" : data.consistencyPct >= 40 ? "#facc15" : "#f87171",
            }}
            title={`${data.consistencyPct}% checked off in the last 30 days`}
          />
        </div>
      )}

      {stats.length > 0 && (
        <span style={{ fontSize: "10px", opacity: 0.85 }} title="Consistency · days/week · task duration">
          {stats.join(" · ")}
        </span>
      )}

      <span
        style={{
          fontSize: "10px",
          opacity: 0.75,
          overflow: "hidden",
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
        }}
      >
        {data.description || "No description yet."}
      </span>
    </div>
  );
}
