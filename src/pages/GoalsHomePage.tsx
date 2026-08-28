import { useEffect, useState } from "react";
import { View } from "../types/nav";
import { Goal } from "../types/project";
import { Dream } from "../types/models";
import { fetchAllGoals, addGoal } from "../db/goals";
import { fetchDreamGraphData } from "../db/dreams";
import "./Page.css";
import "./ProjectsHomePage.css";

const NO_DREAM = "none";

// Formatted the same way as ProjectsHomePage — a goal is one layer
// above a project (a bigger aim a handful of projects might serve),
// same optional dream link, same "just add it" flow.
export function GoalsHomePage({ onNavigate }: { onNavigate: (view: View) => void }) {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [dreams, setDreams] = useState<Dream[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDreamId, setNewDreamId] = useState<string>(NO_DREAM);
  const [creating, setCreating] = useState(false);

  const load = () => {
    Promise.all([fetchAllGoals(), fetchDreamGraphData()]).then(([g, { dreams }]) => {
      setGoals(g);
      setDreams(dreams);
      setLoading(false);
    });
  };

  useEffect(load, []);

  const dreamNames = Object.fromEntries(dreams.map((d) => [d.id, d.name]));

  const startAdd = () => {
    setNewName("");
    setNewDreamId(NO_DREAM);
    setAdding(true);
  };

  const cancelAdd = () => {
    setAdding(false);
    setNewName("");
  };

  const confirmAdd = async () => {
    const name = newName.trim();
    if (!name) return;
    setCreating(true);
    try {
      const dreamId = newDreamId === NO_DREAM ? null : Number(newDreamId);
      const id = await addGoal(dreamId, name);
      setAdding(false);
      setNewName("");
      onNavigate({ type: "goal-detail", goalId: id });
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <div className="page">
        <p className="page-text">Loading…</p>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Goals</h1>
        <button className="add-button" onClick={startAdd}>
          + Goal
        </button>
      </div>

      {adding && (
        <div className="projects-add-form">
          <input
            className="inline-add-input"
            autoFocus
            placeholder="New goal name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") confirmAdd();
              if (e.key === "Escape") cancelAdd();
            }}
          />
          {dreams.length > 0 && (
            <select
              className="inline-add-input"
              value={newDreamId}
              onChange={(e) => setNewDreamId(e.target.value)}
            >
              <option value={NO_DREAM}>No dream (optional)</option>
              {dreams.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          )}
          <div className="projects-add-actions">
            <button className="add-button secondary" onClick={cancelAdd}>
              Cancel
            </button>
            <button className="add-button" onClick={confirmAdd} disabled={!newName.trim() || creating}>
              {creating ? "Adding…" : "Add"}
            </button>
          </div>
        </div>
      )}

      {goals.length === 0 ? (
        <p className="page-text">No goals yet.</p>
      ) : (
        <ul className="list">
          {goals.map((g) => (
            <li key={g.id}>
              <div className="projects-list-row">
                <button
                  className="projects-list-item"
                  onClick={() => onNavigate({ type: "goal-detail", goalId: g.id })}
                >
                  <span className="projects-list-item-name">{g.name}</span>
                  {g.dreamId !== null && dreamNames[g.dreamId] && (
                    <span className="projects-list-item-dream">Dream: {dreamNames[g.dreamId]}</span>
                  )}
                </button>
                <button
                  className="add-button secondary projects-list-enter-web"
                  onClick={() => onNavigate({ type: "goal-web", goalId: g.id })}
                >
                  Enter Web
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
