import { useEffect, useState } from "react";
import { fetchAllGoals } from "../db/goals";
import { fetchAllProjects } from "../db/projects";
import { Goal, Project } from "../types/project";
import "./ManagedListRow.css"; // .menu-backdrop
import "./NodeWidgetOverlay.css";

type Owner = { goalId: number } | { projectId: number };

// Completed section's "Add to a Web" action — picks which project/goal
// Web gets a new task node (header, description, reason, completion
// date only — see db/tasksBoard.ts's linkCompletedTaskToWeb). A
// one-time snapshot, not a live link back to this task.
export function TaskLinkToWebModal({
  onLink,
  onClose,
}: {
  onLink: (owner: Owner) => void;
  onClose: () => void;
}) {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [choice, setChoice] = useState("");

  useEffect(() => {
    Promise.all([fetchAllGoals(), fetchAllProjects()]).then(([g, p]) => {
      setGoals(g);
      setProjects(p);
    });
  }, []);

  const canSubmit = choice.startsWith("goal:") || choice.startsWith("project:");

  const handleSubmit = () => {
    if (choice.startsWith("goal:")) onLink({ goalId: Number(choice.slice(5)) });
    else if (choice.startsWith("project:")) onLink({ projectId: Number(choice.slice(8)) });
  };

  return (
    <>
      <div className="menu-backdrop" onClick={onClose} />
      <div className="node-widget-overlay" onClick={(e) => e.stopPropagation()}>
        <div className="node-widget-overlay-header">
          <span className="node-widget-overlay-title">Add this task to a Web</span>
          <button type="button" className="dyn-overlay-close" onClick={onClose} title="Close">
            ✕
          </button>
        </div>
        <label className="page-text">
          Project or goal
          <select className="inline-add-input" value={choice} onChange={(e) => setChoice(e.target.value)}>
            <option value="">Choose one…</option>
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
            Add to Web
          </button>
        </div>
      </div>
    </>
  );
}
