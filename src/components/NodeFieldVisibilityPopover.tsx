// Ctrl+click a Dream/Goal/Project node on its Web canvas (see
// DreamWebPage.tsx / GoalWebPage.tsx's onNodeClick) to open this — a
// convenient checklist of that owner's fields, each with a switch for
// "show on web" and (except the widget bay) a small extra checkbox for
// "show its header too" — same underlying show_on_web/web_header columns
// FieldStyleFields edits, just presented as one list instead of jumping
// into each field individually. Also carries the global "fit to size"
// switch (theme.nodeCardGrowToFit) since it's the other half of "what
// does this web card actually show."
import { FieldLayoutRow, FieldStylePatch, FIELD_TYPE_LABELS, isWebDisplayable, webFieldKind } from "../db/fieldLayout";
import { useTheme } from "../theme/ThemeContext";
import "./ManagedListRow.css"; // .menu-backdrop
import "../overlay/DynamicOverlayPanel.css"; // .dyn-overlay-close
import "./NodeWidgetOverlay.css";
import "./NodeFieldVisibilityPopover.css";

export function NodeFieldVisibilityPopover({
  title,
  fields,
  onUpdate,
  onClose,
}: {
  title: string;
  fields: FieldLayoutRow[];
  onUpdate: (fieldId: number, patch: FieldStylePatch) => void;
  onClose: () => void;
}) {
  const { theme, setThemeValue } = useTheme();
  const displayable = fields.filter((f) => isWebDisplayable(f.fieldType));
  const growToFit = theme.nodeCardGrowToFit === "1";

  return (
    <>
      <div className="menu-backdrop" onClick={onClose} />
      <div className="node-widget-overlay node-field-visibility-popover" onClick={(e) => e.stopPropagation()}>
        <div className="node-widget-overlay-header">
          <span className="node-widget-overlay-title">Show on web — {title}</span>
          <button type="button" className="dyn-overlay-close" onClick={onClose} title="Close">
            ✕
          </button>
        </div>

        {displayable.length === 0 ? (
          <p className="page-text">This page has no fields that can show on the web.</p>
        ) : (
          <div className="node-field-visibility-list">
            {displayable.map((f) => {
              const label = f.customLabel ?? FIELD_TYPE_LABELS[f.fieldType];
              const kind = webFieldKind(f.fieldType);
              return (
                <div key={f.id} className="node-field-visibility-row">
                  <label className="node-field-visibility-switch">
                    <input
                      type="checkbox"
                      checked={f.showOnWeb}
                      onChange={(e) => onUpdate(f.id, { showOnWeb: e.target.checked })}
                    />
                    <span>{label}</span>
                  </label>
                  {kind !== "widgets" && (
                    <label className="node-field-visibility-header-check">
                      <input
                        type="checkbox"
                        checked={f.webHeader}
                        disabled={!f.showOnWeb}
                        onChange={(e) => onUpdate(f.id, { webHeader: e.target.checked })}
                      />
                      header
                    </label>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div className="node-field-visibility-divider" />

        <label className="node-field-visibility-switch">
          <input
            type="checkbox"
            checked={growToFit}
            onChange={(e) => setThemeValue("nodeCardGrowToFit", e.target.checked ? "1" : "0")}
          />
          <span>Fit to size — cards grow to show everything</span>
        </label>
      </div>
    </>
  );
}
