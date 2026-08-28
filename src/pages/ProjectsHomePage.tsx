import { useEffect, useState } from "react";
import { View } from "../types/nav";
import { Project, Goal, ProjectWidget } from "../types/project";
import { Dream } from "../types/models";
import { fetchAllProjects, addProject } from "../db/projects";
import { fetchDreamGraphData } from "../db/dreams";
import { fetchPassionProjects, addPassionProject, fetchWidgetsForGoal } from "../db/goals";
import { ImageDockWidget } from "../components/ImageDockWidget";
import "./Page.css";
import "./ProjectsHomePage.css";

const NO_DREAM = "none";
// Minimum number of project rows' worth of space kept between the
// Projects list and the Passion Projects header — even with 0 or 1
// projects, the gap looks like there were 8; past 8 real projects the
// section just moves down naturally as the list grows.
const PASSION_BUFFER_ROWS = 8;
const PROJECT_ROW_HEIGHT = 50;

export function ProjectsHomePage({ onNavigate }: { onNavigate: (view: View) => void }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [dreams, setDreams] = useState<Dream[]>([]);
  const [passionProjects, setPassionProjects] = useState<Goal[]>([]);
  const [passionDockWidgets, setPassionDockWidgets] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  // "" (NO_DREAM) is the default — a project doesn't need a dream to
  // exist, linking one is opt-in, never required.
  const [newDreamId, setNewDreamId] = useState<string>(NO_DREAM);
  const [creating, setCreating] = useState(false);
  const [addingPassion, setAddingPassion] = useState(false);
  const [newPassionName, setNewPassionName] = useState("");
  const [creatingPassion, setCreatingPassion] = useState(false);

  const load = () => {
    Promise.all([fetchAllProjects(), fetchDreamGraphData(), fetchPassionProjects()]).then(
      async ([p, { dreams }, passion]) => {
        setProjects(p);
        setDreams(dreams);
        setPassionProjects(passion);
        const widgetLists = await Promise.all(passion.map((g) => fetchWidgetsForGoal(g.id)));
        const dockMap: Record<number, number> = {};
        widgetLists.forEach((widgets: ProjectWidget[], i) => {
          const dock = widgets.find((w) => w.widgetType === "dock");
          if (dock) dockMap[passion[i].id] = dock.id;
        });
        setPassionDockWidgets(dockMap);
        setLoading(false);
      }
    );
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
      const id = await addProject(dreamId, name);
      setAdding(false);
      setNewName("");
      onNavigate({ type: "project-detail", projectId: id });
    } finally {
      setCreating(false);
    }
  };

  const confirmAddPassion = async () => {
    const name = newPassionName.trim();
    if (!name) return;
    setCreatingPassion(true);
    try {
      const id = await addPassionProject(name);
      setAddingPassion(false);
      setNewPassionName("");
      onNavigate({ type: "goal-detail", goalId: id });
    } finally {
      setCreatingPassion(false);
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
        <h1 className="page-title">Projects</h1>
        <button className="add-button" onClick={startAdd}>
          + Project
        </button>
      </div>

      {adding && (
        <div className="projects-add-form">
          <input
            className="inline-add-input"
            autoFocus
            placeholder="New project name"
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

      {/* min-height reserves PASSION_BUFFER_ROWS worth of space so the
          Passion Projects section below always starts at least that far
          down, regardless of how few real projects exist — see
          PASSION_BUFFER_ROWS's comment. */}
      <div style={{ minHeight: PASSION_BUFFER_ROWS * PROJECT_ROW_HEIGHT }}>
        {projects.length === 0 ? (
          <p className="page-text">No projects yet.</p>
        ) : (
          <ul className="list">
            {projects.map((p) => (
              <li key={p.id}>
                <div className="projects-list-row">
                  <button
                    className="projects-list-item"
                    onClick={() => onNavigate({ type: "project-detail", projectId: p.id })}
                  >
                    <span className="projects-list-item-name">{p.name}</span>
                    {p.dreamId !== null && dreamNames[p.dreamId] && (
                      <span className="projects-list-item-dream">Dream: {dreamNames[p.dreamId]}</span>
                    )}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="page-header" style={{ marginTop: 8 }}>
        <h2 className="page-title" style={{ fontSize: "1.15rem" }}>
          Passion Projects
        </h2>
        <button className="add-button secondary" onClick={() => setAddingPassion((v) => !v)}>
          + Passion Project
        </button>
      </div>
      <p className="page-text" style={{ marginTop: 0 }}>
        Small fun things — for recording and organizing while you're doing them, not big planning.
      </p>

      {addingPassion && (
        <div className="projects-add-form">
          <input
            className="inline-add-input"
            autoFocus
            placeholder="New passion project name"
            value={newPassionName}
            onChange={(e) => setNewPassionName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") confirmAddPassion();
              if (e.key === "Escape") setAddingPassion(false);
            }}
          />
          <div className="projects-add-actions">
            <button className="add-button secondary" onClick={() => setAddingPassion(false)}>
              Cancel
            </button>
            <button
              className="add-button"
              onClick={confirmAddPassion}
              disabled={!newPassionName.trim() || creatingPassion}
            >
              {creatingPassion ? "Adding…" : "Add"}
            </button>
          </div>
        </div>
      )}

      {passionProjects.length === 0 ? (
        <p className="page-text">No passion projects yet.</p>
      ) : (
        <div className="passion-project-grid">
          {passionProjects.map((g) => (
            <div key={g.id} className="passion-project-card">
              <div className="passion-project-card-header">
                <button className="passion-project-card-name" onClick={() => onNavigate({ type: "goal-detail", goalId: g.id })}>
                  {g.name}
                </button>
                <button
                  className="icon-button"
                  title="Enter Web"
                  onClick={() => onNavigate({ type: "goal-web", goalId: g.id })}
                >
                  🕸
                </button>
              </div>
              {passionDockWidgets[g.id] !== undefined && <ImageDockWidget widgetId={passionDockWidgets[g.id]} />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
