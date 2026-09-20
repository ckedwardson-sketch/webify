import { useState } from "react";
import "./ManagedListRow.css"; // .menu-backdrop
import "./NodeWidgetOverlay.css";

// Shown whenever a task is sent to the Task Archive, from anywhere
// (bank, board, or Uncompleted) — always asks why, so the archive stays
// a readable record instead of a silent dumping ground.
export function TaskArchiveReasonModal({
  title,
  onSubmit,
  onClose,
}: {
  title: string;
  onSubmit: (reason: string) => void;
  onClose: () => void;
}) {
  const [reason, setReason] = useState("");
  const canSubmit = reason.trim().length > 0;

  return (
    <>
      <div className="menu-backdrop" onClick={onClose} />
      <div className="node-widget-overlay" onClick={(e) => e.stopPropagation()}>
        <div className="node-widget-overlay-header">
          <span className="node-widget-overlay-title">{title}</span>
          <button type="button" className="dyn-overlay-close" onClick={onClose} title="Close">
            ✕
          </button>
        </div>
        <textarea
          className="instructions-textarea"
          placeholder="Why are you archiving this?"
          rows={3}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          autoFocus
        />
        <div className="save-row">
          <button
            type="button"
            className="add-button"
            disabled={!canSubmit}
            onClick={() => canSubmit && onSubmit(reason.trim())}
          >
            Archive
          </button>
        </div>
      </div>
    </>
  );
}
