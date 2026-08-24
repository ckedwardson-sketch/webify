import { useEffect, useState } from "react";
import { View } from "../types/nav";
import { Project, ProjectWidget, ProjectWidgetType } from "../types/project";
import {
  fetchProject,
  updateProjectField,
  updateProjectExpectedDate,
  fetchWidgetsForProject,
  addWidget,
  deleteWidget,
  deleteProject,
} from "../db/projects";
import { fetchDream } from "../db/dreams";
import { Breadcrumb } from "../components/Breadcrumb";
import { DreamDateRangeField } from "../components/DreamDateRangeField";
import "./Page.css";
import "./ProjectDetailPage.css";

export function ProjectDetailPage({
  projectId,
  onNavigate,
}: {
  projectId: number;
  onNavigate: (view: View) => void;
}) {
  const [project, setProject] = useState<Project | null>(null);
  const [dreamName, setDreamName] = useState("");
  const [widgets, setWidgets] = useState<ProjectWidget[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [goalsDraft, setGoalsDraft] = useState("");
  const [reasoningDraft, setReasoningDraft] = useState("");
  const [needsDoingDraft, setNeedsDoingDraft] = useState("");
  const [dateResetToken, setDateResetToken] = useState(0);
  const [showAddWidget, setShowAddWidget] = useState(false);

  const load = async () => {
    const p = await fetchProject(projectId);
    if (p) {
      setProject(p);
      setGoalsDraft(p.goals);
      setReasoningDraft(p.reasoning);
      setNeedsDoingDraft(p.needsDoing);
      const dream = await fetchDream(p.dreamId);
      setDreamName(dream?.name ?? "");
    }
    setWidgets(await fetchWidgetsForProject(projectId));
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const startRename = () => {
    setNameDraft(project?.name ?? "");
    setEditingName(true);
  };

  const confirmRename = async () => {
    const trimmed = nameDraft.trim();
    setEditingName(false);
    if (project && trimmed && trimmed !== project.name) {
      await updateProjectField(project.id, "name", trimmed);
      setProject((prev) => (prev ? { ...prev, name: trimmed } : prev));
    }
  };

  const saveGoals = async () => {
    if (project) await updateProjectField(project.id, "goals", goalsDraft);
  };
  const saveReasoning = async () => {
    if (project) await updateProjectField(project.id, "reasoning", reasoningDraft);
  };
  const saveNeedsDoing = async () => {
    if (project) await updateProjectField(project.id, "needsDoing", needsDoingDraft);
  };

  const handleSaveDate = async (start: string | null, end: string | null) => {
    if (!project) return;
    await updateProjectExpectedDate(project.id, start, end);
    setProject((prev) =>
      prev ? { ...prev, expectedDateStart: start ?? undefined, expectedDateEnd: end ?? undefined } : prev
    );
    setDateResetToken((t) => t + 1);
  };

  const handleAddWidget = async (type: ProjectWidgetType) => {
    if (!project) return;
    const title = type === "journal" ? "Journal" : "Board";
    await addWidget(project.id, type, title);
    setShowAddWidget(false);
    await load();
  };

  const handleDeleteWidget = async (widgetId: number) => {
    if (!confirm("Delete this widget and everything in it?")) return;
    await deleteWidget(widgetId);
    await load();
  };

  const handleDeleteProject = async () => {
    if (!project) return;
    if (!confirm(`Delete "${project.name}"? This also removes its widgets and everything in them.`)) return;
    await deleteProject(project.id);
    onNavigate({ type: "dream-detail", dreamId: project.dreamId });
  };

  if (loading) {
    return (
      <div className="page">
        <p className="page-text">Loading…</p>
      </div>
    );
  }
  if (!project) {
    return (
      <div className="page">
        <p className="page-text">Project not found.</p>
      </div>
    );
  }

  return (
    <div className="page">
      <Breadcrumb
        crumbs={[
          { label: "Dream Web", onClick: () => onNavigate({ type: "dreams-web" }) },
          { label: dreamName, onClick: () => onNavigate({ type: "dream-detail", dreamId: project.dreamId }) },
          { label: project.name },
        ]}
      />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        {editingName ? (
          <input
            className="title-rename-input"
            autoFocus
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") confirmRename();
              if (e.key === "Escape") setEditingName(false);
            }}
            onBlur={confirmRename}
          />
        ) : (
          <h1 className="page-title" onDoubleClick={startRename} title="Double-click to rename">
            {project.name}
          </h1>
        )}
        <button className="add-button danger" onClick={handleDeleteProject}>
          Delete Project
        </button>
      </div>

      <div className="project-field">
        <label className="project-field-label">Goals</label>
        <textarea
          className="instructions-textarea"
          rows={3}
          value={goalsDraft}
          onChange={(e) => setGoalsDraft(e.target.value)}
          onBlur={saveGoals}
          placeholder="What is this project trying to achieve?"
        />
      </div>

      <div className="project-field">
        <label className="project-field-label">Reasoning</label>
        <textarea
          className="instructions-textarea"
          rows={3}
          value={reasoningDraft}
          onChange={(e) => setReasoningDraft(e.target.value)}
          onBlur={saveReasoning}
          placeholder="Why does this project matter?"
        />
      </div>

      <div className="project-field">
        <label className="project-field-label">What needs doing</label>
        <textarea
          className="instructions-textarea"
          rows={3}
          value={needsDoingDraft}
          onChange={(e) => setNeedsDoingDraft(e.target.value)}
          onBlur={saveNeedsDoing}
          placeholder="What actually has to happen?"
        />
      </div>

      <div className="project-field">
        <label className="project-field-label">When it should be done</label>
        <DreamDateRangeField
          start={project.expectedDateStart}
          end={project.expectedDateEnd}
          resetToken={dateResetToken}
          onSave={handleSaveDate}
        />
      </div>

      <div className="project-widgets-section">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 className="project-field-label" style={{ margin: 0 }}>
            Widgets
          </h2>
          <button className="icon-button" onClick={() => setShowAddWidget((v) => !v)} title="Add widget">
            +
          </button>
        </div>

        {showAddWidget && (
          <div className="project-add-widget-menu">
            <button className="add-button secondary" onClick={() => handleAddWidget("journal")}>
              Journal
            </button>
            <button className="add-button secondary" onClick={() => handleAddWidget("linkboard")}>
              Link / Image Board
            </button>
          </div>
        )}

        {widgets.length === 0 ? (
          <p className="page-text">No widgets yet.</p>
        ) : (
          <div className="project-widget-grid">
            {widgets.map((w) => (
              <div key={w.id} className="project-widget-card">
                <button
                  className="project-widget-card-open"
                  onClick={() =>
                    onNavigate(
                      w.widgetType === "journal"
                        ? { type: "project-journal", widgetId: w.id, projectId: project.id }
                        : { type: "project-board", widgetId: w.id, projectId: project.id }
                    )
                  }
                >
                  <span className="project-widget-card-icon">
                    {w.widgetType === "journal" ? "📓" : "🧷"}
                  </span>
                  <span className="project-widget-card-title">{w.title}</span>
                </button>
                <button
                  className="project-widget-card-delete"
                  onClick={() => handleDeleteWidget(w.id)}
                  title="Delete widget"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
