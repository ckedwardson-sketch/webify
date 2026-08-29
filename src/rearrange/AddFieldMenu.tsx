import { ProjectWidgetType } from "../types/project";
import { FieldType } from "../db/fieldLayout";
import { RearrangeTarget } from "./RearrangeModeContext";

export const WIDGET_TYPE_LABELS: Record<ProjectWidgetType, string> = {
  journal: "Journal",
  linkboard: "Link / Image Board",
  table: "Table",
  photo: "Quick Photo",
  dock: "Image Dock",
};

// The categorized "what can I add here" list — shared by the toolbar's
// own popover (RearrangeToolbar.tsx, appends at the end), each
// FieldGap's inline popover (RearrangeableField.tsx, inserts exactly
// there), and FieldPairBar's popover (pairs to the right of one field).
// A category that has nothing to offer just doesn't render its heading.
export function AddFieldMenu({
  target,
  onPickWidget,
  onPickField,
  // Suppresses the per-widget-type "Widgets" section — used by
  // FieldPairBar, where "add a widget to the grid" doesn't correspond to
  // "pair a new field next to this one" (the grid *field* itself is
  // still offered normally, via availableFieldsToAdd's "Other" group,
  // when it's not already present).
  hideWidgetSection,
}: {
  target: RearrangeTarget;
  onPickWidget: (type: ProjectWidgetType) => void;
  onPickField: (type: FieldType) => void;
  hideWidgetSection?: boolean;
}) {
  const fields = target.availableFieldsToAdd;
  const textFields = fields.filter((f) => f.group === "text");
  const dateFields = fields.filter((f) => f.group === "dates");
  const otherFields = fields.filter((f) => f.group === "other" || f.group === "widgets");

  return (
    <>
      {!hideWidgetSection && target.supportedWidgetTypes.length > 0 && target.hasWidgetsField && (
        <>
          <div className="rearrange-add-menu-title">Widgets</div>
          {target.supportedWidgetTypes.map((type) => (
            <button key={type} className="dropdown-item" onClick={() => onPickWidget(type)}>
              {WIDGET_TYPE_LABELS[type]}
            </button>
          ))}
        </>
      )}

      {textFields.length > 0 && (
        <>
          <div className="rearrange-add-menu-title">Text</div>
          {textFields.map((f) => (
            <button key={f.type} className="dropdown-item" onClick={() => onPickField(f.type)}>
              {f.label}
            </button>
          ))}
        </>
      )}

      {dateFields.length > 0 && (
        <>
          <div className="rearrange-add-menu-title">Dates</div>
          {dateFields.map((f) => (
            <button key={f.type} className="dropdown-item" onClick={() => onPickField(f.type)}>
              {f.label}
            </button>
          ))}
        </>
      )}

      {otherFields.length > 0 && (
        <>
          <div className="rearrange-add-menu-title">Other</div>
          {otherFields.map((f) => (
            <button key={f.type} className="dropdown-item" onClick={() => onPickField(f.type)}>
              {f.label}
            </button>
          ))}
        </>
      )}
    </>
  );
}
