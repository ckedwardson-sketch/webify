// Floating "open this widget without leaving the web" overlay — used by
// a node card's widget bay (see NodeCardFields.tsx) for widget types
// that don't have their own dedicated page (Quick Photo, Image Dock).
// Table/Journal/Board widgets skip this entirely and navigate straight
// to their existing page instead (see each Web page's onOpenWidget).
import { ProjectWidget } from "../types/project";
import { ImageDockWidget } from "./ImageDockWidget";
import { QuickPhotoWidget } from "./QuickPhotoWidget";
import "../components/ManagedListRow.css"; // .menu-backdrop
import "../overlay/DynamicOverlayPanel.css"; // .dyn-overlay-close
import "./NodeWidgetOverlay.css";

export function NodeWidgetOverlay({ widget, onClose }: { widget: ProjectWidget; onClose: () => void }) {
  return (
    <>
      <div className="menu-backdrop" onClick={onClose} />
      <div className="node-widget-overlay" onClick={(e) => e.stopPropagation()}>
        <div className="node-widget-overlay-header">
          <span className="node-widget-overlay-title">{widget.title}</span>
          <button type="button" className="dyn-overlay-close" onClick={onClose} title="Close">
            ✕
          </button>
        </div>
        <div className="node-widget-overlay-body">
          {widget.widgetType === "photo" ? (
            <QuickPhotoWidget widgetId={widget.id} />
          ) : (
            <ImageDockWidget widgetId={widget.id} />
          )}
        </div>
      </div>
    </>
  );
}
