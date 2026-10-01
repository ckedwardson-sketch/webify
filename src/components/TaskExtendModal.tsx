import { useState } from "react";
import "./ManagedListRow.css"; // .menu-backdrop

export function TaskExtendModal({ 
  task, 
  onExtend, 
  onClose 
}: { 
  task: any; // We'll define proper typing later
  onExtend: (days: number, note: string) => void; 
  onClose: () => void; 
}) {
  const [days, setDays] = useState(1);
  const [note, setNote] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onExtend(days, note.trim());
    onClose();
  };

  return (
    <>
      <div className="menu-backdrop" onClick={onClose} />
      <div className="node-widget-overlay" onClick={(e) => e.stopPropagation()}>
        <div className="node-widget-overlay-header">
          <span className="node-widget-overlay-title">Extend Task</span>
          <button type="button" className="dyn-overlay-close" onClick={onClose} title="Close">
            ✕
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="node-widget-overlay-row">
            <label>Extend by (days):</label>
            <input
              type="number"
              min="1"
              max="30"
              value={days}
              onChange={(e) => setDays(Math.max(1, parseInt(e.target.value) || 1))}
              className="inline-add-input"
            />
          </div>
          <div className="node-widget-overlay-row">
            <label>Note:</label>
            <textarea
              className="instructions-textarea"
              placeholder="Optional note about why you're extending..."
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
          <div className="node-widget-overlay-actions">
            <button type="button" className="add-button secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="add-button">
              Extend Task
            </button>
          </div>
        </form>
      </div>
    </>
  );
}