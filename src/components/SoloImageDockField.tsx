import { FieldLayoutRow } from "../db/fieldLayout";
import { contentStyle, handleFieldResizeMouseUp } from "../rearrange/fieldStyle";
import { ImageDockWidget } from "./ImageDockWidget";
import { FieldHeader } from "./FieldHeader";
import "./SoloImageDockField.css";

// A field_layout "solo_dock" field — an Image Dock that lives inline in
// the normal field list (always showing its actual photos, like the
// task Completion Image field) rather than in the widget bay behind a
// small emoji button. Reuses ImageDockWidget as-is (it already shows a
// big clickable photo preview that opens a full, non-squashed edit
// overlay) — this just wraps it in the same resize-handle convention
// every other field box uses (see fieldStyle.ts's handleFieldResizeMouseUp).
export function SoloImageDockField({
  field,
  rearranging,
  onRename,
  onResize,
}: {
  field: FieldLayoutRow;
  rearranging: boolean;
  onRename: (label: string | null) => void;
  onResize?: (fieldId: number, heightPx: number | null) => void;
}) {
  if (field.refId === null) return null;
  return (
    <div className="project-field">
      <div className="field-slot-header-row">
        <FieldHeader defaultLabel="Image Dock" customLabel={field.customLabel} editable={rearranging} onRename={onRename} />
      </div>
      <div
        className="solo-image-dock-field"
        style={contentStyle(field)}
        onMouseUp={(e) => handleFieldResizeMouseUp(e, field.id, onResize)}
      >
        <ImageDockWidget widgetId={field.refId} />
      </div>
    </div>
  );
}
