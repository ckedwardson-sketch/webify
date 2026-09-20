import { useState } from "react";
import { ProgressNode } from "../types/models";
import "./ManagedListRow.css"; // .menu-backdrop
import "./NodeWidgetOverlay.css";
import "./TaskLinkPickerModal.css";

// Top-right "link tasks into task bank" on the Task Bank column — picks
// from ordinary project/goal tasks nobody's pulled into the Tasks
// system yet (see db/tasksBoard.ts's fetchLinkableTasks). Deliberately
// explicit/opt-in rather than auto-listing every task in the app.
export function TaskLinkPickerModal({
  candidates,
  onLink,
  onClose,
}: {
  candidates: ProgressNode[];
  onLink: (ids: number[]) => void;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const toggle = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <>
      <div className="menu-backdrop" onClick={onClose} />
      <div className="node-widget-overlay task-link-picker-modal" onClick={(e) => e.stopPropagation()}>
        <div className="node-widget-overlay-header">
          <span className="node-widget-overlay-title">Link tasks into the bank</span>
          <button type="button" className="dyn-overlay-close" onClick={onClose} title="Close">
            ✕
          </button>
        </div>
        {candidates.length === 0 ? (
          <p className="page-text">No unlinked project/goal tasks left to add.</p>
        ) : (
          <ul className="task-link-picker-list">
            {candidates.map((task) => (
              <li key={task.id}>
                <label className="task-link-picker-row">
                  <input type="checkbox" checked={selected.has(task.id)} onChange={() => toggle(task.id)} />
                  {task.shortDescription || "(untitled task)"}
                </label>
              </li>
            ))}
          </ul>
        )}
        <div className="save-row">
          <button
            type="button"
            className="add-button"
            disabled={selected.size === 0}
            onClick={() => onLink([...selected])}
          >
            Add {selected.size > 0 ? selected.size : ""} to bank
          </button>
        </div>
      </div>
    </>
  );
}
