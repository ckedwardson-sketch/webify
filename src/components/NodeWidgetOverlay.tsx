// Floating "open this widget without leaving the web" overlay — used by
// a node card's widget bay (see NodeCardFields.tsx) for widget types
// that don't have their own dedicated page (Quick Photo, Image Dock,
// Cost Log, Calculator). Table/Journal/Board widgets skip this entirely
// and navigate straight to their existing page instead (see each Web
// page's onOpenWidget).
import { ProjectWidget } from "../types/project";
import { ImageDockWidget } from "./ImageDockWidget";
import { QuickPhotoWidget } from "./QuickPhotoWidget";
import { CostLogWidget } from "./CostLogWidget";
import { CalculatorWidget } from "./CalculatorWidget";
import { MasterCostLogWidget } from "./MasterCostLogWidget";
import "../components/ManagedListRow.css"; // .menu-backdrop
import "../overlay/DynamicOverlayPanel.css"; // .dyn-overlay-close
import "./NodeWidgetOverlay.css";

const WIDGET_TITLES: Partial<Record<ProjectWidget["widgetType"], string>> = {
  photo: "Quick Photo",
  dock: "Image Dock",
  costlog: "Cost Log",
  calculator: "Calculator",
  mastercostlog: "Master Cost Log",
};

function renderWidgetBody(widget: ProjectWidget) {
  switch (widget.widgetType) {
    case "photo":
      return <QuickPhotoWidget widgetId={widget.id} />;
    case "costlog":
      return <CostLogWidget widgetId={widget.id} />;
    case "calculator":
      return <CalculatorWidget widgetId={widget.id} />;
    case "mastercostlog":
      return <MasterCostLogWidget widgetId={widget.id} />;
    case "dock":
    default:
      return <ImageDockWidget widgetId={widget.id} embedded />;
  }
}

export function NodeWidgetOverlay({ widget, onClose }: { widget: ProjectWidget; onClose: () => void }) {
  return (
    <>
      <div className="menu-backdrop" onClick={onClose} />
      <div className="node-widget-overlay" onClick={(e) => e.stopPropagation()}>
        <div className="node-widget-overlay-header">
          <span className="node-widget-overlay-title">
            {widget.title || WIDGET_TITLES[widget.widgetType] || "Widget"}
          </span>
          <button type="button" className="dyn-overlay-close" onClick={onClose} title="Close">
            ✕
          </button>
        </div>
        <div className="node-widget-overlay-body">{renderWidgetBody(widget)}</div>
      </div>
    </>
  );
}
