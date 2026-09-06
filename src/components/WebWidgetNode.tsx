// src/components/WebWidgetNode.tsx
//
// A project_widgets row (see types/project.ts's ProjectWidget) rendered
// as a free-floating, independently positioned/sized React Flow node on
// a Goal Web or Dream Web canvas, instead of living in a project's/
// goal's detail-page widget grid. Renders the exact same widget content
// components GoalDetailPage.tsx's widget grid uses — see its
// `w.widgetType === "dock" ? (` switch — so a Journal/Board/Table/Photo/
// Dock/Cost Log/Calculator widget looks and behaves identically whether
// it's in a grid or floating on a canvas.
import { NodeResizer } from "@xyflow/react";
import { ProjectWidget } from "../types/project";
import { Icon } from "../icons/Icon";
import { GoalWebLinkHandles } from "./GoalGraphNodes";
import { ImageDockWidget } from "./ImageDockWidget";
import { QuickPhotoWidget } from "./QuickPhotoWidget";
import { CostLogWidget } from "./CostLogWidget";
import { CalculatorWidget } from "./CalculatorWidget";
import { TableWidgetPreview } from "./TableWidgetPreview";
import "./WebWidgetNode.css";

export const WEB_WIDGET_DEFAULT_WIDTH = 280;
export const WEB_WIDGET_DEFAULT_HEIGHT = 220;

const WIDGET_ICON_KEY: Record<ProjectWidget["widgetType"], string> = {
  journal: "widget-journal",
  linkboard: "widget-linkboard",
  table: "widget-table",
  photo: "widget-photo",
  dock: "widget-dock",
  costlog: "widget-costlog",
  calculator: "widget-calculator",
};

export interface WebWidgetNodeData {
  widget: ProjectWidget;
  onDelete: () => void;
  onResize: (width: number, height: number) => void;
  // Journal/linkboard have no dedicated inline render (see
  // GoalDetailPage.tsx's grid) — clicking their "Open" button navigates
  // to their existing page instead, same as the grid does.
  onOpen: () => void;
}

export function WebWidgetNode({ data, selected }: { data: WebWidgetNodeData; selected?: boolean }) {
  const { widget, onDelete, onResize, onOpen } = data;
  const width = widget.width ?? WEB_WIDGET_DEFAULT_WIDTH;
  const height = widget.height ?? WEB_WIDGET_DEFAULT_HEIGHT;

  return (
    <div className="web-widget-node" style={{ width, height }}>
      <NodeResizer
        isVisible={selected}
        minWidth={180}
        minHeight={120}
        onResizeEnd={(_, params) => onResize(params.width, params.height)}
      />
      <GoalWebLinkHandles />
      <div className="web-widget-node-header">
        <span className="web-widget-node-icon">
          <Icon iconKey={WIDGET_ICON_KEY[widget.widgetType]} size={14} />
        </span>
        <span className="web-widget-node-title">{widget.title || "Widget"}</span>
        <button
          className="web-widget-node-delete"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          title="Delete widget"
        >
          ✕
        </button>
      </div>
      <div className="web-widget-node-body nodrag nowheel">
        {widget.widgetType === "dock" ? (
          <ImageDockWidget widgetId={widget.id} />
        ) : widget.widgetType === "photo" ? (
          <QuickPhotoWidget widgetId={widget.id} />
        ) : widget.widgetType === "costlog" ? (
          <CostLogWidget widgetId={widget.id} />
        ) : widget.widgetType === "calculator" ? (
          <CalculatorWidget widgetId={widget.id} />
        ) : widget.widgetType === "table" ? (
          <TableWidgetPreview widgetId={widget.id} onOpen={onOpen} />
        ) : (
          <button className="web-widget-node-open" onClick={onOpen}>
            <span className="web-widget-node-open-icon">
              {widget.widgetType === "journal" ? "📓" : "🧷"}
            </span>
            <span>{widget.widgetType === "journal" ? "Open journal" : "Open board"}</span>
          </button>
        )}
      </div>
    </div>
  );
}
