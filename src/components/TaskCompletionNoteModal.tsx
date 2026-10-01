import { useState } from "react";
import "./ManagedListRow.css"; // .menu-backdrop

export function TaskCompletionNoteModal({ 
  onAddNote, 
  onClose 
}: { 
  onAddNote: (note: string) => void; 
  onClose: () => void; 
}) {
  const [note, setNote] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (note.trim()) {
      onAddNote(note.trim());
    }
    onClose();
  };

  return (
    <>
      <div className="menu-backdrop" onClick={onClose} />
      <div className="node-widget-overlay" onClick={(e) => e.stopPropagation()}>
        <div className="node-widget-overlay-header">
          <span className="node-widget-overlay-title">Add Completion Note</span>
          <button type="button" className="dyn-overlay-close" onClick={onClose} title="Close">
            ✕
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <textarea
            className="instructions-textarea"
            placeholder="Enter your completion note..."
            rows={4}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            autoFocus
          />
          <div className="node-widget-overlay-actions">
            <button type="button" className="add-button secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="add-button" disabled={!note.trim()}>
              Add Note
            </button>
          </div>
        </form>
      </div>
    </>
  );
}