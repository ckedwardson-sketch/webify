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
// own popover (RearrangeToolbar.tsx, appends at the end) and each
// FieldGap's inline popover (RearrangeableField.tsx, inserts exactly
// there). A category that has nothing to offer (e.g. "Widgets" on
// Dream Detail, which has no widget grid at all) just doesn't render
// its heading.
export function AddFieldMenu({
  target,
  onPickWidget,
  onPickField,
}: {
  target: RearrangeTarget;
  onPickWidget: (type: ProjectWidgetType) => void;
  onPickField: (type: FieldType) => void;
}) {
  return (
    <>
      {target.supportedWidgetTypes.length > 0 && (
        <>
          <div className="rearrange-add-menu-title">Widgets</div>
          {target.supportedWidgetTypes.map((type) => (
            <button key={type} className="dropdown-item" onClick={() => onPickWidget(type)}>
              {WIDGET_TYPE_LABELS[type]}
            </button>
          ))}
        </>
      )}

      <div className="rearrange-add-menu-title">Text</div>
      <button className="dropdown-item" onClick={() => onPickField("freetext")}>
        Text field
      </button>

      {target.availableFieldsToAdd.length > 0 && (
        <>
          <div className="rearrange-add-menu-title">Dates</div>
          {target.availableFieldsToAdd.map((f) => (
            <button key={f.type} className="dropdown-item" onClick={() => onPickField(f.type)}>
              {f.label}
            </button>
          ))}
        </>
      )}
    </>
  );
}
