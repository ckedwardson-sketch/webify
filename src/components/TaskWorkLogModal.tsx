import { useState } from "react";
import "./ManagedListRow.css"; // .menu-backdrop
import "./NodeWidgetOverlay.css";

// Hold-to-complete on a skill-linked task shows this instead of the
// usual completion-image step (see TasksPage's handleHoldComplete) —
// time spent + an optional note, exactly what db/skills.ts's logWork
// needs, so it lands on the Skill Tree the same way any other logged
// session does.
export function TaskWorkLogModal({
  title,
  onSubmit,
  onClose,
}: {
  title: string;
  onSubmit: (minutes: number, note: string | null) => void;
  onClose: () => void;
}) {
  const [minutes, setMinutes] = useState("15");
  const [note, setNote] = useState("");
  const canSubmit = Number(minutes) > 0;

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
        <label className="page-text">
          Minutes spent
          <input
            className="inline-add-input"
            type="number"
            min={1}
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
            autoFocus
          />
        </label>
        <textarea
          className="instructions-textarea"
          placeholder="Note (optional)"
          rows={2}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <div className="save-row">
          <button
            type="button"
            className="add-button"
            disabled={!canSubmit}
            onClick={() => onSubmit(Number(minutes), note.trim() || null)}
          >
            Log & complete
          </button>
        </div>
      </div>
    </>
  );
}
