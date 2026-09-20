import { useEffect, useState } from "react";
import { fetchAllGoals } from "../db/goals";
import { fetchAllProjects } from "../db/projects";
import { Goal, Project } from "../types/project";
import "./ManagedListRow.css"; // .menu-backdrop
import "./NodeWidgetOverlay.css";

const STANDALONE = "standalone";

type OwnerChoice = { goalId: number } | { projectId: number } | undefined;

// Top-right "+ Daily/Random Task" on the Tasks board — a quick task
// creator that skips categories/difficulty/instructions entirely so
// jotting one down stays fast. Defaults to a standalone "free time"
// errand (unrelated to any project/goal, and not the same as a
// recurring Responsibility), but the owner dropdown lets it attach
// straight to an existing goal/passion project instead — same
// fast-path, just landing on that Web too.
export function TaskQuickAddModal({
  onAdd,
  onClose,
}: {
  onAdd: (header: string, description: string, reason: string, days: number, owner: OwnerChoice) => void;
  onClose: () => void;
}) {
  const [header, setHeader] = useState("");
  const [description, setDescription] = useState("");
  const [reason, setReason] = useState("");
  const [days, setDays] = useState("3");
  const [ownerChoice, setOwnerChoice] = useState(STANDALONE);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);

  useEffect(() => {
    Promise.all([fetchAllGoals(), fetchAllProjects()]).then(([g, p]) => {
      setGoals(g);
      setProjects(p);
    });
  }, []);

  const canSubmit = header.trim().length > 0 && Number(days) > 0;

  const handleSubmit = () => {
    if (!canSubmit) return;
    let owner: OwnerChoice;
    if (ownerChoice.startsWith("goal:")) owner = { goalId: Number(ownerChoice.slice(5)) };
    else if (ownerChoice.startsWith("project:")) owner = { projectId: Number(ownerChoice.slice(8)) };
    onAdd(header.trim(), description.trim(), reason.trim(), Number(days), owner);
  };

  return (
    <>
      <div className="menu-backdrop" onClick={onClose} />
      <div className="node-widget-overlay" onClick={(e) => e.stopPropagation()}>
        <div className="node-widget-overlay-header">
          <span className="node-widget-overlay-title">Add a daily/random task</span>
          <button type="button" className="dyn-overlay-close" onClick={onClose} title="Close">
            ✕
          </button>
        </div>
        <input
          className="inline-add-input"
          placeholder="Header (e.g. Clean the gutters)"
          value={header}
          onChange={(e) => setHeader(e.target.value)}
          autoFocus
        />
        <textarea
          className="instructions-textarea"
          placeholder="Description (optional)"
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <textarea
          className="instructions-textarea"
          placeholder="Reason (optional)"
          rows={2}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
        <label className="page-text">
          Days until it should be complete
          <input
            className="inline-add-input"
            type="number"
            min={1}
            value={days}
            onChange={(e) => setDays(e.target.value)}
          />
        </label>
        <label className="page-text">
          Attach to an existing goal/project (optional)
          <select className="inline-add-input" value={ownerChoice} onChange={(e) => setOwnerChoice(e.target.value)}>
            <option value={STANDALONE}>None — just a free-time task</option>
            {goals.length > 0 && (
              <optgroup label="Goals">
                {goals.map((g) => (
                  <option key={`goal:${g.id}`} value={`goal:${g.id}`}>
                    {g.name}
                  </option>
                ))}
              </optgroup>
            )}
            {projects.length > 0 && (
              <optgroup label="Projects">
                {projects.map((p) => (
                  <option key={`project:${p.id}`} value={`project:${p.id}`}>
                    {p.name}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        </label>
        <div className="save-row">
          <button type="button" className="add-button" disabled={!canSubmit} onClick={handleSubmit}>
            Add to board
          </button>
        </div>
      </div>
    </>
  );
}
