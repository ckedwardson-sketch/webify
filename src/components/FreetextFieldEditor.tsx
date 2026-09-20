import { useEffect, useState } from "react";
import { FieldLayoutRow, updateFreetextField } from "../db/fieldLayout";
import { contentStyle, headerStyle } from "../rearrange/fieldStyle";
import { RichTextField } from "../editor/RichTextField";

// A generic label+textarea "area" — the one genuinely new field kind
// the generalized rearrange system adds (see db/fieldLayout.ts), for
// whatever the built-in structured fields don't cover. Autosaves on
// blur, same convention as every other text field in this app.
export function FreetextFieldEditor({
  refId,
  label,
  content,
  field,
  onResize,
}: {
  refId: number;
  label: string;
  content: string;
  field: FieldLayoutRow;
  onResize?: (fieldId: number, heightPx: number | null) => void;
}) {
  const [labelDraft, setLabelDraft] = useState(label);
  const [contentDraft, setContentDraft] = useState(content);

  useEffect(() => {
    setLabelDraft(label);
    setContentDraft(content);
  }, [refId, label, content]);

  return (
    <div className="project-field">
      <div className="field-slot-header-row">
        <input
          className="project-field-label freetext-field-label-input"
          style={headerStyle(field)}
          value={labelDraft}
          onChange={(e) => setLabelDraft(e.target.value)}
          onBlur={() => updateFreetextField(refId, { label: labelDraft })}
        />
      </div>
      <RichTextField
        className="instructions-textarea"
        style={contentStyle(field)}
        value={contentDraft}
        onChange={setContentDraft}
        onBlur={() => updateFreetextField(refId, { content: contentDraft })}
        fieldId={field.id}
        onResizeField={onResize}
      />
    </div>
  );
}
