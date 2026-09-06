import { useEffect, useState } from "react";
import {
  Output,
  OutputDisplayVariant,
  updateOutputTitle,
  updateOutputContent,
  updateOutputDisplayVariant,
  deleteOutput,
} from "../db/outputs";
import { NoteContentEditor } from "../editor/NoteContentEditor";
import { View } from "../types/nav";
import "./OutputEditorModal.css";

const VARIANT_LABELS: Record<OutputDisplayVariant, string> = {
  card: "Card",
  "image-grid": "Image grid",
  "file-list": "File list",
};

// Reuses NoteContentEditor wholesale for the rich body — an Output's
// content is the same TipTap HTML blob a Note's is (see db/outputs.ts),
// so there's no separate output editor implementation to maintain.
export function OutputEditorModal({
  output,
  onNavigate,
  onClose,
  onDeleted,
}: {
  output: Output;
  onNavigate: (view: View) => void;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [titleDraft, setTitleDraft] = useState(output.title);
  const [variant, setVariant] = useState<OutputDisplayVariant>(output.displayVariant);

  useEffect(() => {
    setTitleDraft(output.title);
    setVariant(output.displayVariant);
  }, [output.id]);

  const saveTitle = () => {
    const trimmed = titleDraft.trim() || "Untitled output";
    if (trimmed !== output.title) updateOutputTitle(output.id, trimmed);
  };

  const handleVariantChange = (v: OutputDisplayVariant) => {
    setVariant(v);
    updateOutputDisplayVariant(output.id, v);
  };

  const handleDelete = () => {
    if (!confirm(`Delete "${output.title}"? This can't be undone.`)) return;
    deleteOutput(output.id);
    onDeleted();
  };

  return (
    <>
      <div className="output-editor-backdrop" onClick={onClose} />
      <div className="output-editor-modal">
        <div className="output-editor-header">
          <input
            className="output-editor-title-input"
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            onBlur={saveTitle}
          />
          <button className="output-editor-close" onClick={onClose} title="Close">
            ✕
          </button>
        </div>

        <div className="output-editor-variant-row">
          <span className="output-editor-variant-label">Display as</span>
          {(Object.keys(VARIANT_LABELS) as OutputDisplayVariant[]).map((v) => (
            <button
              key={v}
              className={`output-editor-variant-btn${variant === v ? " active" : ""}`}
              onClick={() => handleVariantChange(v)}
            >
              {VARIANT_LABELS[v]}
            </button>
          ))}
        </div>

        <div className="output-editor-body">
          <NoteContentEditor
            content={output.content}
            onChange={(html) => updateOutputContent(output.id, html)}
            onOpenNoteLink={(pageId) => onNavigate({ type: "notes", pageId })}
          />
        </div>

        <div className="output-editor-footer">
          <button className="add-button danger" onClick={handleDelete}>
            Delete output
          </button>
        </div>
      </div>
    </>
  );
}
