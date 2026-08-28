import { useEffect, useState } from "react";
import { updateFreetextField } from "../db/fieldLayout";

// A generic label+textarea "area" — the one genuinely new field kind
// the generalized rearrange system adds (see db/fieldLayout.ts), for
// whatever the built-in structured fields don't cover. Autosaves on
// blur, same convention as every other text field in this app.
export function FreetextFieldEditor({
  refId,
  label,
  content,
}: {
  refId: number;
  label: string;
  content: string;
}) {
  const [labelDraft, setLabelDraft] = useState(label);
  const [contentDraft, setContentDraft] = useState(content);

  useEffect(() => {
    setLabelDraft(label);
    setContentDraft(content);
  }, [refId, label, content]);

  return (
    <div className="project-field">
      <input
        className="project-field-label freetext-field-label-input"
        value={labelDraft}
        onChange={(e) => setLabelDraft(e.target.value)}
        onBlur={() => updateFreetextField(refId, { label: labelDraft })}
      />
      <textarea
        className="instructions-textarea"
        rows={3}
        value={contentDraft}
        onChange={(e) => setContentDraft(e.target.value)}
        onBlur={() => updateFreetextField(refId, { content: contentDraft })}
      />
    </div>
  );
}
