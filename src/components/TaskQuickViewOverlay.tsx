import { useState } from "react";
import { ProgressNode } from "../types/models";
import { updateProgressField } from "../db/progress";
import "./ManagedListRow.css"; // .menu-backdrop
import "./NodeWidgetOverlay.css";

// Clicking a standalone (daily/random) task's header has nowhere real
// to navigate to — it has no owning project/goal detail page, and the
// full progress-node editor's category/difficulty/instructions fields
// don't apply to a quick task. This is that quick task's whole "detail
// page": header/description/reason, editable in place, nothing else.
// A project/goal task's header instead navigates straight to
// progress-node-detail (see TasksPage's onOpenDetail).
export function TaskQuickViewOverlay({ task, onClose, onChanged }: { task: ProgressNode; onClose: () => void; onChanged: () => void }) {
  const [header, setHeader] = useState(task.shortDescription);
  const [description, setDescription] = useState(task.description);
  const [reason, setReason] = useState(task.reason);

  const save = async (field: "shortDescription" | "description" | "reason", value: string) => {
    await updateProgressField(task.id, field, value);
    onChanged();
  };

  return (
    <>
      <div className="menu-backdrop" onClick={onClose} />
      <div className="node-widget-overlay" onClick={(e) => e.stopPropagation()}>
        <div className="node-widget-overlay-header">
          <span className="node-widget-overlay-title">Quick task</span>
          <button type="button" className="dyn-overlay-close" onClick={onClose} title="Close">
            ✕
          </button>
        </div>
        <input
          className="inline-add-input"
          value={header}
          onChange={(e) => setHeader(e.target.value)}
          onBlur={() => save("shortDescription", header)}
        />
        <textarea
          className="instructions-textarea"
          placeholder="Description"
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onBlur={() => save("description", description)}
        />
        <textarea
          className="instructions-textarea"
          placeholder="Reason"
          rows={2}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          onBlur={() => save("reason", reason)}
        />
        {task.taskGoalDays != null && (
          <p className="page-text">Time goal: {task.taskGoalDays} day{task.taskGoalDays === 1 ? "" : "s"}</p>
        )}
      </div>
    </>
  );
}
