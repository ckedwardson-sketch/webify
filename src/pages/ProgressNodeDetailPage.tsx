// src/pages/ProgressNodeDetailPage.tsx
import { useEffect, useRef, useState } from "react";
import {
  fetchProgressNode,
  updateProgressField,
  setProgressCategories,
  setProgressImage,
  setProgressComplete,
  setProgressCost,
  markProgressRead,
  deleteProgressNode,
} from "../db/progress";
import { fetchProject } from "../db/projects";
import { fetchOutputsForTask, addOutput, Output } from "../db/outputs";
import { OutputEditorModal } from "../components/OutputEditorModal";
import {
  fetchFieldLayout,
  addBuiltinField,
  removeField,
  reorderFields,
  updateFieldLayoutLabel,
  updateFieldLayoutHeight,
  updateFieldColumn,
  updateFieldStyle,
  availableFieldsToAdd as computeAvailableFieldsToAdd,
  FieldLayoutRow,
  FieldStylePatch,
  FieldType,
  REMOVABLE_FIELD_TYPES,
} from "../db/fieldLayout";
import { ProgressNode, ProgressCategory, ProgressDifficulty } from "../types/models";
import { View } from "../types/nav";
import { Breadcrumb } from "../components/Breadcrumb";
import { CATEGORY_LABELS, DIFFICULTY_LABELS, categoryBackgroundFor } from "../components/ProgressGraphNodes";
import { useTheme } from "../theme/ThemeContext";
import { useRearrangeMode, FieldClipboard } from "../rearrange/RearrangeModeContext";
import { useFieldStyleRegistry } from "../rearrange/FieldStyleRegistryContext";
import { RearrangeableField, FieldGap } from "../rearrange/RearrangeableField";
import { contentStyle, headerStyle, mergeFieldStylePatch } from "../rearrange/fieldStyle";
import { RichTextField } from "../editor/RichTextField";
import { FieldHeader } from "../components/FieldHeader";
import { withFieldUndo } from "../rearrange/fieldUndo";
import "./Page.css";
import "./ProgressNodeDetailPage.css";

const CATEGORIES = Object.keys(CATEGORY_LABELS) as ProgressCategory[];
const DIFFICULTIES = Object.keys(DIFFICULTY_LABELS) as ProgressDifficulty[];
const COPIABLE_FIELD_TYPES: FieldType[] = ["task_description", "task_reason", "task_instructions"];

function gapOrderBefore(fields: FieldLayoutRow[], index: number): number {
  const current = fields[index].sortOrder;
  if (index === 0) return current - 1;
  return (fields[index - 1].sortOrder + current) / 2;
}

function gapOrderAfterLast(fields: FieldLayoutRow[]): number {
  return fields.length === 0 ? 0 : fields[fields.length - 1].sortOrder + 1;
}

// SQLite CURRENT_TIMESTAMP strings are UTC without a "Z" suffix — append
// one so both dates parse as the same instant they were stored as,
// rather than being misread as local time.
function asUtc(sqliteTimestamp: string): Date {
  return new Date(sqliteTimestamp.endsWith("Z") ? sqliteTimestamp : `${sqliteTimestamp}Z`);
}

function formatDuration(createdAt: string, completedAt: string): string {
  const ms = Math.max(0, asUtc(completedAt).getTime() - asUtc(createdAt).getTime());
  const minutes = Math.round(ms / 60000);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ${minutes % 60}m`;
  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h`;
}

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
  const [fields, setFields] = useState<FieldLayoutRow[]>([]);
  const [fieldDragOverId, setFieldDragOverId] = useState<number | null>(null);
  const [outputs, setOutputs] = useState<Output[]>([]);
  const [editingOutputId, setEditingOutputId] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    active: rearranging,
    deleteToolActive,
    copyToolActive,
    columnToolActive,
    copiedFieldId,
    copyField,
    insertAt,
    setInsertAt,
    registerTarget,
    pushUndo,
  } = useRearrangeMode();

  const detailColumnCount = Math.max(1, Math.min(3, Number(theme.detailColumnCount) || 1));
  const { registerFieldStyleTarget } = useFieldStyleRegistry();

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

    Promise.all([
      fetchProgressNode(nodeId),
      resolveBackView(),
      fetchFieldLayout("task", nodeId),
      fetchOutputsForTask(nodeId),
    ]).then(([n, back, fieldRows, outputRows]) => {
        setNode(n);
        setBackView(back);
        setFields(fieldRows);
        setOutputs(outputRows);
        setShortDescDraft(n?.shortDescription ?? "");
        setDescriptionDraft(n?.description ?? "");
        setReasonDraft(n?.reason ?? "");
        setInstructionsDraft(n?.instructions ?? "");
        setLoading(false);
        if (n && !n.isRead) markProgressRead(nodeId);
      }
    );
  }, [nodeId, projectId, goalId]);

  const load = async () => {
    setFields(await fetchFieldLayout("task", nodeId));
  };

  const loadOutputs = async () => {
    setOutputs(await fetchOutputsForTask(nodeId));
  };

  const handleAddOutput = async () => {
    const id = await addOutput(nodeId);
    await loadOutputs();
    setEditingOutputId(id);
  };

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

  const handleToggleCategory = async (category: ProgressCategory) => {
    if (!node) return;
    const isChecked = node.categories.includes(category);
    // Always leave at least one category checked — an empty checklist
    // has no sensible color/legend meaning.
    if (isChecked && node.categories.length === 1) return;
    const next = isChecked
      ? node.categories.filter((c) => c !== category)
      : [...node.categories, category];
    await setProgressCategories(node.id, next);
    setNode((prev) => (prev ? { ...prev, categories: next, isRead: true } : prev));
  };

  const handleDifficultyChange = async (difficulty: ProgressDifficulty) => {
    if (!node) return;
    await updateProgressField(node.id, "difficulty", difficulty);
    setNode((prev) => (prev ? { ...prev, difficulty, isRead: true } : prev));
  };

  const handleCostChange = async (raw: string) => {
    if (!node) return;
    const cost = raw.trim() === "" ? null : Number(raw);
    if (cost !== null && Number.isNaN(cost)) return;
    await setProgressCost(node.id, cost);
    setNode((prev) => (prev ? { ...prev, cost } : prev));
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

  const nextSortOrder = (): number => (insertAt !== null ? insertAt : gapOrderAfterLast(fields));

  const handleAddField = async (type: FieldType) => {
    const order = nextSortOrder();
    await withFieldUndo("task", nodeId, "Add field", () => addBuiltinField("task", nodeId, type, order), pushUndo, load);
    setInsertAt(null);
  };

  const handleDeleteField = async (row: FieldLayoutRow) => {
    if (!REMOVABLE_FIELD_TYPES.includes(row.fieldType)) return;
    await withFieldUndo("task", nodeId, "Delete field", () => removeField(row.id, row.fieldType, row.refId), pushUndo, load);
  };

  const contentFor = (f: FieldLayoutRow): FieldClipboard | null => {
    switch (f.fieldType) {
      case "task_description":
        return { label: "Description", content: descriptionDraft };
      case "task_reason":
        return { label: "Reason", content: reasonDraft };
      case "task_instructions":
        return { label: "Instructions", content: instructionsDraft };
      default:
        return null;
    }
  };

  const handleCopyField = (row: FieldLayoutRow) => {
    const content = contentFor(row);
    if (!content) return;
    copyField(row.id, content);
  };

  const handleFieldStyleRename = (fieldId: number, label: string | null) => {
    setFields((prev) => prev.map((f) => (f.id === fieldId ? { ...f, customLabel: label } : f)));
    updateFieldLayoutLabel(fieldId, label);
  };

  const handleFieldStyleSave = (row: FieldLayoutRow, patch: FieldStylePatch) => {
    setFields((prev) => prev.map((f) => (f.id === row.id ? mergeFieldStylePatch(f, patch) : f)));
    updateFieldStyle(row.id, patch);
  };

  const handleFieldResize = (fieldId: number, heightPx: number | null) => {
    setFields((prev) => prev.map((f) => (f.id === fieldId ? { ...f, heightPx } : f)));
    updateFieldLayoutHeight(fieldId, heightPx);
  };

  useEffect(() => {
    registerFieldStyleTarget({
      fields,
      onSave: (fieldId, patch) => {
        const row = fields.find((f) => f.id === fieldId);
        if (row) handleFieldStyleSave(row, patch);
      },
      onRename: handleFieldStyleRename,
    });
    return () => registerFieldStyleTarget(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fields]);

  const handleFieldDragStart = (e: React.DragEvent, id: number) => {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(id));
  };

  const handleFieldDragOver = (e: React.DragEvent, id: number) => {
    e.preventDefault();
    setFieldDragOverId(id);
  };

  const handleFieldDrop = async (e: React.DragEvent, targetId: number) => {
    e.preventDefault();
    setFieldDragOverId(null);
    const draggedId = Number(e.dataTransfer.getData("text/plain"));
    if (!draggedId || draggedId === targetId) return;
    const ids = fields.map((f) => f.id);
    const from = ids.indexOf(draggedId);
    const to = ids.indexOf(targetId);
    if (from === -1 || to === -1) return;
    ids.splice(from, 1);
    ids.splice(to, 0, draggedId);
    await withFieldUndo("task", nodeId, "Reorder fields", () => reorderFields(ids), pushUndo, load);
  };

  const availableFieldsToAdd = computeAvailableFieldsToAdd("task", fields).filter((o) => o.type !== "freetext");

  const handleCycleColumn = async (f: FieldLayoutRow) => {
    await updateFieldColumn(f.id, (f.column + 1) % detailColumnCount);
    load();
  };

  useEffect(() => {
    if (!node) return;
    registerTarget({
      category: "task",
      ownerId: nodeId,
      supportedWidgetTypes: [],
      hasWidgetsField: false,
      widgets: [],
      onAddWidget: async () => {},
      onDeleteWidget: async () => {},
      onDuplicateWidget: async () => {},
      onReorder: async () => {},
      onApplyLayout: async () => {},
      availableFieldsToAdd,
      onAddField: handleAddField,
      onPasteField: async () => {},
      columnCount: detailColumnCount > 1 ? detailColumnCount : undefined,
      onSetFieldColumn: (fieldId, column) => updateFieldColumn(fieldId, column).then(load),
    });
    return () => registerTarget(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node, fields, insertAt, detailColumnCount]);

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

  const background = categoryBackgroundFor(theme, node.categories);

  const renderField = (f: FieldLayoutRow) => {
    switch (f.fieldType) {
      case "task_labor_type":
        return (
          <div className="progress-field">
            <FieldHeader as="span" defaultLabel="Labor type — check all that apply" customLabel={f.customLabel} editable={rearranging} onRename={(label) => handleFieldStyleRename(f.id, label)} className="progress-field-label" style={headerStyle(f)} />
            <div className="progress-labor-type-checklist">
              {CATEGORIES.map((c) => (
                <label key={c} className="progress-labor-type-option">
                  <input
                    type="checkbox"
                    checked={node.categories.includes(c)}
                    onChange={() => handleToggleCategory(c)}
                  />
                  {CATEGORY_LABELS[c]}
                </label>
              ))}
            </div>
          </div>
        );
      case "task_difficulty":
        return (
          <label className="progress-field">
            <FieldHeader as="span" defaultLabel="Difficulty — also sets its size on the web" customLabel={f.customLabel} editable={rearranging} onRename={(label) => handleFieldStyleRename(f.id, label)} className="progress-field-label" style={headerStyle(f)} />
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
        );
      case "task_description":
        return (
          <div className="progress-field">
            <div className="field-slot-header-row">
              <FieldHeader defaultLabel="Description" customLabel={f.customLabel} editable={rearranging} onRename={(label) => handleFieldStyleRename(f.id, label)} className="progress-field-label" style={headerStyle(f)} />
            </div>
            <RichTextField
              className="instructions-textarea"
              style={contentStyle(f)}
              value={descriptionDraft}
              onChange={setDescriptionDraft}
              onBlur={saveDescription}
              fieldId={f.id}
              onResizeField={handleFieldResize}
              placeholder="What actually needs to happen here?"
            />
          </div>
        );
      case "task_reason":
        return (
          <div className="progress-field">
            <div className="field-slot-header-row">
              <FieldHeader defaultLabel="Reason" customLabel={f.customLabel} editable={rearranging} onRename={(label) => handleFieldStyleRename(f.id, label)} className="progress-field-label" style={headerStyle(f)} />
            </div>
            <RichTextField
              className="instructions-textarea"
              style={contentStyle(f)}
              value={reasonDraft}
              onChange={setReasonDraft}
              onBlur={saveReason}
              fieldId={f.id}
              onResizeField={handleFieldResize}
              placeholder="Why does this need doing?"
            />
          </div>
        );
      case "task_instructions":
        return (
          <div className="progress-field">
            <div className="field-slot-header-row">
              <FieldHeader defaultLabel="Instructions" customLabel={f.customLabel} editable={rearranging} onRename={(label) => handleFieldStyleRename(f.id, label)} className="progress-field-label" style={headerStyle(f)} />
            </div>
            <RichTextField
              className="instructions-textarea"
              style={contentStyle(f)}
              value={instructionsDraft}
              onChange={setInstructionsDraft}
              onBlur={saveInstructions}
              fieldId={f.id}
              onResizeField={handleFieldResize}
              placeholder="How to actually do it — steps, references, gotchas…"
            />
          </div>
        );
      case "task_cost":
        return (
          <label className="progress-field">
            <FieldHeader as="span" defaultLabel="Cost" customLabel={f.customLabel} editable={rearranging} onRename={(label) => handleFieldStyleRename(f.id, label)} className="progress-field-label" style={headerStyle(f)} />
            <input
              className="inline-add-input"
              type="number"
              step="0.01"
              min="0"
              value={node.cost ?? ""}
              onChange={(e) => handleCostChange(e.target.value)}
              placeholder="Not logged"
            />
          </label>
        );
      case "task_completion_image":
        return (
          <div className="progress-field">
            <div className="field-slot-header-row">
              <FieldHeader defaultLabel="Completion image" customLabel={f.customLabel} editable={rearranging} onRename={(label) => handleFieldStyleRename(f.id, label)} className="progress-field-label" style={headerStyle(f)} />
            </div>
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
              <button className="cover-image-placeholder" onClick={() => fileInputRef.current?.click()}>
                Add an image once this is done
              </button>
            )}
          </div>
        );
      default:
        return null;
    }
  };

  const renderFieldWithGap = (f: FieldLayoutRow, i: number): React.ReactNode[] => {
    const nodes: React.ReactNode[] = [];
    if (rearranging) {
      nodes.push(<FieldGap key={`gap-${f.id}`} order={gapOrderBefore(fields, i)} />);
    }
    nodes.push(
      <RearrangeableField
        key={f.id}
        id={f.id}
        rearranging={rearranging}
        deleteToolActive={deleteToolActive}
        copyToolActive={copyToolActive}
        removable={REMOVABLE_FIELD_TYPES.includes(f.fieldType)}
        copiable={COPIABLE_FIELD_TYPES.includes(f.fieldType)}
        copied={copiedFieldId === f.id}
        dragOverId={fieldDragOverId}
        onDragStart={handleFieldDragStart}
        onDragOver={handleFieldDragOver}
        onDragLeave={() => setFieldDragOverId((id) => (id === f.id ? null : id))}
        onDrop={handleFieldDrop}
        onDelete={() => handleDeleteField(f)}
        onCopy={() => handleCopyField(f)}
        columnToolActive={columnToolActive}
        column={detailColumnCount > 1 ? f.column % detailColumnCount : undefined}
        onCycleColumn={detailColumnCount > 1 ? () => handleCycleColumn(f) : undefined}
      >
        {renderField(f)}
      </RearrangeableField>
    );
    return nodes;
  };

  const columnBuckets: React.ReactNode[][] = Array.from({ length: detailColumnCount }, () => []);
  fields.forEach((f, i) => {
    const col = detailColumnCount > 1 ? f.column % detailColumnCount : 0;
    columnBuckets[col].push(...renderFieldWithGap(f, i));
  });
  if (rearranging) {
    columnBuckets[0].push(<FieldGap key="gap-end" order={gapOrderAfterLast(fields)} />);
  }

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
          <span className="progress-detail-swatch" style={{ background }} />
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
        {node.isComplete && node.completedAt && node.createdAt && (
          <span className="progress-detail-duration">
            Took {formatDuration(node.createdAt, node.completedAt)}
          </span>
        )}
      </div>

      <div className="detail-columns">
        {columnBuckets.map((bucket, i) => (
          <div className="detail-column" key={i}>
            {bucket}
          </div>
        ))}
      </div>

      <div className="progress-outputs-section">
        <div className="field-slot-header-row">
          <span className="progress-field-label">Outputs — what this task actually produced</span>
          <button className="add-button secondary" onClick={handleAddOutput}>
            + Add output
          </button>
        </div>
        {outputs.length === 0 ? (
          <p className="page-text">No outputs yet.</p>
        ) : (
          <div className="progress-outputs-grid">
            {outputs.map((o) => (
              <button key={o.id} className="progress-output-card" onClick={() => setEditingOutputId(o.id)}>
                <span className="progress-output-card-icon">📐</span>
                <span className="progress-output-card-title">{o.title}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {editingOutputId !== null && (
        <OutputEditorModal
          output={outputs.find((o) => o.id === editingOutputId)!}
          onNavigate={onNavigate}
          onClose={() => {
            setEditingOutputId(null);
            loadOutputs();
          }}
          onDeleted={() => {
            setEditingOutputId(null);
            loadOutputs();
          }}
        />
      )}
    </div>
  );
}
