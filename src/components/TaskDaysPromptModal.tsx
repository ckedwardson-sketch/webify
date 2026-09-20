import { useState } from "react";
import "./ManagedListRow.css"; // .menu-backdrop
import "./NodeWidgetOverlay.css";

// Small reusable "how many days until you expect to complete this?"
// prompt — used both when sending a bank task to the board.
export function TaskDaysPromptModal({
  title,
  onSubmit,
  onClose,
}: {
  title: string;
  onSubmit: (days: number) => void;
  onClose: () => void;
}) {
  const [days, setDays] = useState("3");
  const canSubmit = Number(days) > 0;

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
          Days until you expect to complete it
          <input
            className="inline-add-input"
            type="number"
            min={1}
            value={days}
            onChange={(e) => setDays(e.target.value)}
            autoFocus
          />
        </label>
        <div className="save-row">
          <button
            type="button"
            className="add-button"
            disabled={!canSubmit}
            onClick={() => canSubmit && onSubmit(Number(days))}
          >
            Send to board
          </button>
        </div>
      </div>
    </>
  );
}
