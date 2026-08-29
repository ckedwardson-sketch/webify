// The small field summary + widget bay rendered inside a Dream/Goal/
// Project Web graph card (see theme/nodeCardFields.ts for how the items
// are computed from field_layout's "show on web" toggles). Lives inside
// a React Flow node that's often non-draggable but sometimes is (Dream
// nodes) — every interactive bit stops propagation so clicking it never
// also fires the node's own onClick/drag.
import { ProjectWidget, ProjectWidgetType } from "../types/project";
import { NodeCardTextItem } from "../theme/nodeCardFields";
import "./NodeCardFields.css";

const WIDGET_EMOJI: Record<ProjectWidgetType, string> = {
  journal: "📓",
  linkboard: "🧷",
  table: "📊",
  photo: "📷",
  dock: "🖼️",
};

export function NodeCardFields({
  items,
  widgets,
  onOpenWidget,
  fullText,
  capHeightPx,
}: {
  items: NodeCardTextItem[];
  widgets?: ProjectWidget[];
  onOpenWidget?: (widget: ProjectWidget) => void;
  // Grow-to-fit cards (see DreamGraphNodes.tsx's growToFit) render the
  // whole point of growing downward — the un-clamped text — instead of
  // the usual 2-line clip a fixed-size card needs.
  fullText?: boolean;
  // The "grow to fit" setting's off state (see themeFieldGroups.ts's
  // "Fields shown on web cards") — caps this block at a fixed height and
  // makes it scrollable instead of letting the card balloon.
  capHeightPx?: number;
}) {
  const showWidgets = widgets && widgets.length > 0;
  if (items.length === 0 && !showWidgets) return null;

  const textItems = items.map((item) => (
    <div key={item.id} className="node-card-field">
      {item.header && <span className="node-card-field-header">{item.header}</span>}
      <span className={fullText ? "node-card-field-text node-card-field-text-full" : "node-card-field-text"}>
        {item.text}
      </span>
    </div>
  ));

  return (
    <div className="node-card-fields nodrag nopan" onClick={(e) => e.stopPropagation()}>
      {capHeightPx ? (
        <div style={{ maxHeight: `${capHeightPx}px`, overflowY: "auto", overflowX: "hidden" }}>{textItems}</div>
      ) : (
        textItems
      )}
      {showWidgets && (
        <div className="node-card-widget-bay">
          {widgets!.map((w) => (
            <button
              key={w.id}
              type="button"
              className="node-card-widget-btn"
              title={w.title}
              onClick={(e) => {
                e.stopPropagation();
                onOpenWidget?.(w);
              }}
            >
              {WIDGET_EMOJI[w.widgetType]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
