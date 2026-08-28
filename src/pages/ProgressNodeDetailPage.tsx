// src/pages/ProgressNodeDetailPage.tsx
import { useEffect, useRef, useState } from "react";
import {
  fetchProgressNode,
  updateProgressField,
  setProgressImage,
  setProgressComplete,
  markProgressRead,
  deleteProgressNode,
} from "../db/progress";
import { fetchProject } from "../db/projects";
import { ProgressNode, ProgressCategory, ProgressDifficulty } from "../types/models";
import { View } from "../types/nav";
import { Breadcrumb } from "../components/Breadcrumb";
import { CATEGORY_LABELS, DIFFICULTY_LABELS, categoryColorFor } from "../components/ProgressGraphNodes";
import { useTheme } from "../theme/ThemeContext";
import "./Page.css";
import "./ProgressNodeDetailPage.css";

const CATEGORIES = Object.keys(CATEGORY_LABELS) as ProgressCategory[];
const DIFFICULTIES = Object.keys(DIFFICULTY_LABELS) as ProgressDifficulty[];

// A task belongs to exactly one of projectId/goalId (see ProgressNode's
// dual-ownership comment in types/models.ts). Its "back to the web" and
// "delete" destinations both need to resolve to a Goal Web — if the
// task hangs off a project instead of a goal directly, that means
// looking up which goal (if any) that project belongs to.
export function ProgressNodeDetailPage({
  nodeId,
  projectId,
  goalId,
  onNavigate,
}: {
  nodeId: number;
  projectId?: number;
  goalId?: number;
  onNavigate: (view: View) => void;
}) {
  const { theme } = useTheme();
  const [node, setNode] = useState<ProgressNode | null>(null);
  const [loading, setLoading] = useState(true);
  const [backView, setBackView] = useState<View | null>(null);
  const [shortDescDraft, setShortDescDraft] = useState("");
  const [descriptionDraft, setDescriptionDraft] = useState("");
  const [reasonDraft, setReasonDraft] = useState("");
  const [instructionsDraft, setInstructionsDraft] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLoading(true);
    const resolveBackView = async (): Promise<View> => {
      if (goalId !== undefined) return { type: "goal-web", goalId };
      if (projectId !== undefined) {
        const project = await fetchProject(projectId);
        return project?.goalId != null
          ? { type: "goal-web", goalId: project.goalId }
          : { type: "project-detail", projectId };
      }
      return { type: "goals-home" };
    };

    Promise.all([fetchProgressNode(nodeId), resolveBackView()]).then(([n, back]) => {
      setNode(n);
      setBackView(back);
      setShortDescDraft(n?.shortDescription ?? "");
      setDescriptionDraft(n?.description ?? "");
      setReasonDraft(n?.reason ?? "");
      setInstructionsDraft(n?.instructions ?? "");
      setLoading(false);
      if (n && !n.isRead) markProgressRead(nodeId);
    });
  }, [nodeId, projectId, goalId]);

  const saveShortDesc = async () => {
    if (!node || shortDescDraft === node.shortDescription) return;
    await updateProgressField(node.id, "shortDescription", shortDescDraft);
    setNode((prev) => (prev ? { ...prev, shortDescription: shortDescDraft, isRead: true } : prev));
  };

  const saveDescription = async () => {
    if (!node || descriptionDraft === node.description) return;
    await updateProgressField(node.id, "description", descriptionDraft);
    setNode((prev) => (prev ? { ...prev, description: descriptionDraft, isRead: true } : prev));
  };

  const saveReason = async () => {
    if (!node || reasonDraft === node.reason) return;
    await updateProgressField(node.id, "reason", reasonDraft);
    setNode((prev) => (prev ? { ...prev, reason: reasonDraft, isRead: true } : prev));
  };

  const saveInstructions = async () => {
    if (!node || instructionsDraft === node.instructions) return;
    await updateProgressField(node.id, "instructions", instructionsDraft);
    setNode((prev) => (prev ? { ...prev, instructions: instructionsDraft, isRead: true } : prev));
  };

  const handleCategoryChange = async (category: ProgressCategory) => {
    if (!node) return;
    await updateProgressField(node.id, "category", category);
    setNode((prev) => (prev ? { ...prev, category, isRead: true } : prev));
  };

  const handleDifficultyChange = async (difficulty: ProgressDifficulty) => {
    if (!node) return;
    await updateProgressField(node.id, "difficulty", difficulty);
    setNode((prev) => (prev ? { ...prev, difficulty, isRead: true } : prev));
  };

  const handleToggleComplete = async () => {
    if (!node) return;
    const next = !node.isComplete;
    await setProgressComplete(node.id, next);
    setNode((prev) => (prev ? { ...prev, isComplete: next } : prev));
  };

  const handleImageSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !node) return;
    const reader = new FileReader();
    reader.onload = () => {
      const data = reader.result as string;
      setProgressImage(node.id, data);
      setNode((prev) => (prev ? { ...prev, imageData: data, isRead: true } : prev));
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleRemoveImage = async () => {
    if (!node) return;
    await setProgressImage(node.id, null);
    setNode((prev) => (prev ? { ...prev, imageData: undefined } : prev));
  };

  const handleDelete = async () => {
    if (!node) return;
    if (!confirm(`Delete "${node.shortDescription || "this task"}"?`)) return;
    await deleteProgressNode(node.id);
    onNavigate(backView ?? { type: "goals-home" });
  };

  if (loading) {
    return (
      <div className="page">
        <p className="page-text">Loading…</p>
      </div>
    );
  }

  if (!node) {
    return (
      <div className="page">
        <p className="page-text">Task not found.</p>
      </div>
    );
  }

  const color = categoryColorFor(theme, node.category);

  return (
    <div className="page">
      <Breadcrumb
        crumbs={[
          { label: "Goal Web", onClick: () => onNavigate(backView ?? { type: "goals-home" }) },
          { label: node.shortDescription || "Untitled" },
        ]}
      />

      <div className="page-header">
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span className="progress-detail-swatch" style={{ background: color }} />
          <input
            className="title-rename-input"
            value={shortDescDraft}
            onChange={(e) => setShortDescDraft(e.target.value)}
            onBlur={saveShortDesc}
            placeholder="Short description (shown on the web)"
          />
        </div>
        <button className="add-button danger" onClick={handleDelete}>
          Delete
        </button>
      </div>

      <div className="progress-detail-toggle-row">
        <button
          className={`add-button ${node.isComplete ? "" : "secondary"}`}
          onClick={handleToggleComplete}
        >
          {node.isComplete ? "✓ Complete" : "Mark complete"}
        </button>
      </div>

      <div className="progress-field-grid">
        <label className="progress-field">
          <span className="progress-field-label">Labor type</span>
          <select
            className="inline-add-input"
            value={node.category}
            onChange={(e) => handleCategoryChange(e.target.value as ProgressCategory)}
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>
        </label>

        <label className="progress-field">
          <span className="progress-field-label">Difficulty — also sets its size on the web</span>
          <select
            className="inline-add-input"
            value={node.difficulty}
            onChange={(e) => handleDifficultyChange(e.target.value as ProgressDifficulty)}
          >
            {DIFFICULTIES.map((d) => (
              <option key={d} value={d}>
                {DIFFICULTY_LABELS[d]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="progress-field">
        <label className="progress-field-label">Description</label>
        <textarea
          className="instructions-textarea"
          rows={4}
          value={descriptionDraft}
          onChange={(e) => setDescriptionDraft(e.target.value)}
          onBlur={saveDescription}
          placeholder="What actually needs to happen here?"
        />
      </div>

      <div className="progress-field">
        <label className="progress-field-label">Reason</label>
        <textarea
          className="instructions-textarea"
          rows={3}
          value={reasonDraft}
          onChange={(e) => setReasonDraft(e.target.value)}
          onBlur={saveReason}
          placeholder="Why does this need doing?"
        />
      </div>

      <div className="progress-field">
        <label className="progress-field-label">Instructions</label>
        <textarea
          className="instructions-textarea"
          rows={4}
          value={instructionsDraft}
          onChange={(e) => setInstructionsDraft(e.target.value)}
          onBlur={saveInstructions}
          placeholder="How to actually do it — steps, references, gotchas…"
        />
      </div>

      <div className="progress-field">
        <label className="progress-field-label">Completion image</label>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={handleImageSelected}
        />
        {node.imageData ? (
          <div className="progress-detail-image-wrapper">
            <img src={node.imageData} alt="" className="progress-detail-image" />
            <div className="progress-detail-image-actions">
              <button className="add-button secondary" onClick={() => fileInputRef.current?.click()}>
                Replace
              </button>
              <button className="add-button danger" onClick={handleRemoveImage}>
                Remove
              </button>
            </div>
          </div>
        ) : (
          <button
            className="cover-image-placeholder"
            onClick={() => fileInputRef.current?.click()}
          >
            Add an image once this is done
          </button>
        )}
      </div>
    </div>
  );
}
