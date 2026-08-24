import { useEffect, useState } from "react";
import { View } from "../types/nav";
import { Project } from "../types/project";
import { fetchAllProjects } from "../db/projects";
import { fetchDreamGraphData } from "../db/dreams";
import "./Page.css";

export function ProjectsHomePage({ onNavigate }: { onNavigate: (view: View) => void }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [dreamNames, setDreamNames] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([fetchAllProjects(), fetchDreamGraphData()]).then(([p, { dreams }]) => {
      setProjects(p);
      setDreamNames(Object.fromEntries(dreams.map((d) => [d.id, d.name])));
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="page">
        <p className="page-text">Loading…</p>
      </div>
    );
  }

  return (
    <div className="page">
      <h1 className="page-title">Projects</h1>
      {projects.length === 0 ? (
        <p className="page-text">
          No projects yet — open the Dream Web, click a dream's ⋯ menu, and choose "Add Project".
        </p>
      ) : (
        <ul className="list">
          {projects.map((p) => (
            <li key={p.id}>
              <button
                className="list-item"
                onClick={() => onNavigate({ type: "project-detail", projectId: p.id })}
              >
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <span>{p.name}</span>
                  <span style={{ fontSize: "0.75rem", color: "#999" }}>
                    {dreamNames[p.dreamId] ? `Dream: ${dreamNames[p.dreamId]}` : ""}
                  </span>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
