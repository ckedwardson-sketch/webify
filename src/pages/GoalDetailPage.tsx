import { useEffect, useState } from "react";
import { View } from "../types/nav";
import { Goal, ProjectWidget, ProjectWidgetType } from "../types/project";
import {
  fetchGoal,
  updateGoalField,
  updateGoalExpectedDate,
  updateGoalEstimatedStartDate,
  fetchWidgetsForGoal,
  addGoalWidget,
  deleteGoal,
} from "../db/goals";
import { deleteWidget, updateWidgetOrder, duplicateWidget } from "../db/projects";
import { fetchDream } from "../db/dreams";
import { applyWidgetContent, SavedLayout } from "../db/layouts";
import {
  fetchFieldLayout,
  reorderFields,
  addBuiltinField,
  addFreetextField,
  addFreetextFieldWithContent,
  removeField,
  fetchFreetextFields,
  availableFieldsToAdd as computeAvailableFieldsToAdd,
  updateFieldStyle,
  FieldLayoutRow,
  FieldStylePatch,
  FieldType,
  FreetextField,
  REMOVABLE_FIELD_TYPES,
} from "../db/fieldLayout";
import { Icon } from "../icons/Icon";
import { Breadcrumb } from "../components/Breadcrumb";
import { DreamDateRangeField } from "../components/DreamDateRangeField";
import { EstimatedStartDateField } from "../components/EstimatedStartDateField";
import { FreetextFieldEditor } from "../components/FreetextFieldEditor";
import { ImageDockWidget } from "../components/ImageDockWidget";
import { QuickPhotoWidget } from "../components/QuickPhotoWidget";
import { TableWidgetPreview } from "../components/TableWidgetPreview";
import { useRearrangeMode, AddableField, FieldClipboard } from "../rearrange/RearrangeModeContext";
import { useFieldStyleRegistry } from "../rearrange/FieldStyleRegistryContext";
import { RearrangeableField, FieldGap } from "../rearrange/RearrangeableField";
import { contentStyle, headerStyle, mergeFieldStylePatch } from "../rearrange/fieldStyle";
import { withFieldUndo } from "../rearrange/fieldUndo";
import { usePageBackground, pageSurfaceStyle } from "../theme/PageBackgroundContext";
import "../components/ManagedListRow.css"; // reusing .managed-row-dropdown / .dropdown-item / .menu-backdrop
import "./Page.css";
import "./ProjectDetailPage.css";

const ALL_WIDGET_TYPES: ProjectWidgetType[] = ["journal", "linkboard", "table", "photo", "dock"];
const COPIABLE_FIELD_TYPES: FieldType[] = ["goals_text", "reasoning_text", "needs_doing_text", "freetext"];

function gapOrderBefore(fields: FieldLayoutRow[], index: number): number {
  const current = fields[index].sortOrder;
  if (index === 0) return current - 1;
  return (fields[index - 1].sortOrder + current) / 2;
}

function gapOrderAfterLast(fields: FieldLayoutRow[]): number {
  return fields.length === 0 ? 0 : fields[fields.length - 1].sortOrder + 1;
}

// Formatted the same way as ProjectDetailPage — a goal is one layer
// above a project, same field shape, same widgets board.
export function GoalDetailPage({
  goalId,
  onNavigate,
}: {
  goalId: number;
  onNavigate: (view: View) => void;
}) {
  const { overrides: pageBgOverrides } = usePageBackground();
  const [goal, setGoal] = useState<Goal | null>(null);
  const [dreamName, setDreamName] = useState("");
  const [widgets, setWidgets] = useState<ProjectWidget[]>([]);
  const [fields, setFields] = useState<FieldLayoutRow[]>([]);
  const [freetextById, setFreetextById] = useState<Map<number, FreetextField>>(new Map());
  const [loading, setLoading] = useState(true);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [goalsDraft, setGoalsDraft] = useState("");
  const [reasoningDraft, setReasoningDraft] = useState("");
  const [needsDoingDraft, setNeedsDoingDraft] = useState("");
  const [dateResetToken, setDateResetToken] = useState(0);
  const [showAddWidget, setShowAddWidget] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [dragOverId, setDragOverId] = useState<number | null>(null);
  const [fieldDragOverId, setFieldDragOverId] = useState<number | null>(null);
  const {
    active: rearranging,
    deleteToolActive,
    copyToolActive,
    copiedFieldId,
    copyField,
    insertAt,
    setInsertAt,
    registerTarget,
    pushUndo,
  } = useRearrangeMode();
  const { registerFieldStyleTarget } = useFieldStyleRegistry();

  const load = async () => {
    const g = await fetchGoal(goalId);
    if (g) {
      setGoal(g);
      setGoalsDraft(g.goals);
      setReasoningDraft(g.reasoning);
      setNeedsDoingDraft(g.needsDoing);
      const dream = g.dreamId !== null ? await fetchDream(g.dreamId) : null;
      setDreamName(dream?.name ?? "");
    }
    setWidgets(await fetchWidgetsForGoal(goalId));
    const fieldRows = await fetchFieldLayout("goal", goalId);
    setFields(fieldRows);
    const freetextIds = fieldRows
      .filter((f) => f.fieldType === "freetext" && f.refId !== null)
      .map((f) => f.refId!);
    setFreetextById(await fetchFreetextFields(freetextIds));
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goalId]);

  const startRename = () => {
    setNameDraft(goal?.name ?? "");
    setEditingName(true);
  };

  const confirmRename = async () => {
    const trimmed = nameDraft.trim();
    setEditingName(false);
    if (goal && trimmed && trimmed !== goal.name) {
      await updateGoalField(goal.id, "name", trimmed);
      setGoal((prev) => (prev ? { ...prev, name: trimmed } : prev));
    }
  };

  const saveGoals = async () => {
    if (goal) await updateGoalField(goal.id, "goals", goalsDraft);
  };
  const saveReasoning = async () => {
    if (goal) await updateGoalField(goal.id, "reasoning", reasoningDraft);
  };
  const saveNeedsDoing = async () => {
    if (goal) await updateGoalField(goal.id, "needsDoing", needsDoingDraft);
  };

  const handleSaveDate = async (start: string | null, end: string | null) => {
    if (!goal) return;
    await updateGoalExpectedDate(goal.id, start, end);
    setGoal((prev) =>
      prev ? { ...prev, expectedDateStart: start ?? undefined, expectedDateEnd: end ?? undefined } : prev
    );
    setDateResetToken((t) => t + 1);
  };

  const handleSaveEstimatedStart = async (date: string | null) => {
    if (!goal) return;
    await updateGoalEstimatedStartDate(goal.id, date);
    setGoal((prev) => (prev ? { ...prev, estimatedStartDate: date ?? undefined } : prev));
  };

  const WIDGET_TITLES: Record<ProjectWidgetType, string> = {
    journal: "Journal",
    linkboard: "Board",
    table: "Table",
    photo: "Quick Photo",
    dock: "Image Dock",
  };

  const handleAddWidget = async (type: ProjectWidgetType) => {
    if (!goal) return;
    await addGoalWidget(goal.id, type, WIDGET_TITLES[type]);
    setShowAddWidget(false);
    await load();
  };

  const handleDeleteWidget = async (widgetId: number) => {
    if (!confirm("Delete this widget and everything in it?")) return;
    await deleteWidget(widgetId);
    await load();
  };

  const handleDuplicateWidget = async (widgetId: number) => {
    await duplicateWidget(widgetId);
    await load();
  };

  const handleReorderWidgets = async (orderedIds: number[]) => {
    await updateWidgetOrder(orderedIds);
    await load();
  };

  const handleApplyLayout = async (layout: SavedLayout) => {
    if (!goal) return;
    // See ProjectDetailPage.tsx's identical fix — a layout replaces the
    // widget grid rather than appending to it, or reloading the layout
    // you just saved from duplicates every widget on it.
    if (
      widgets.length > 0 &&
      !confirm(`Loading "${layout.name}" replaces the ${widgets.length} widget(s) already on this page. Continue?`)
    ) {
      return;
    }
    for (const w of widgets) await deleteWidget(w.id);
    for (const w of layout.widgets) {
      const newId = await addGoalWidget(goal.id, w.widgetType, w.title);
      await applyWidgetContent(newId, w.widgetType, w.content);
    }
    await load();
  };

  const nextSortOrder = (): number => (insertAt !== null ? insertAt : gapOrderAfterLast(fields));

  const handleAddField = async (type: FieldType) => {
    if (!goal) return;
    const order = nextSortOrder();
    await withFieldUndo(
      "goal",
      goal.id,
      "Add field",
      () =>
        type === "freetext"
          ? addFreetextField("goal", goal.id, order)
          : addBuiltinField("goal", goal.id, type, order),
      pushUndo,
      load
    );
    setInsertAt(null);
  };

  const handlePasteField = async (clip: FieldClipboard, order: number) => {
    if (!goal) return;
    await withFieldUndo(
      "goal",
      goal.id,
      "Paste field",
      () => addFreetextFieldWithContent("goal", goal.id, order, clip.label, clip.content),
      pushUndo,
      load
    );
  };

  const handleDeleteField = async (row: FieldLayoutRow) => {
    if (!REMOVABLE_FIELD_TYPES.includes(row.fieldType) || !goal) return;
    await withFieldUndo(
      "goal",
      goal.id,
      "Delete field",
      () => removeField(row.id, row.fieldType, row.refId),
      pushUndo,
      load
    );
  };

  const contentFor = (f: FieldLayoutRow): FieldClipboard | null => {
    switch (f.fieldType) {
      case "goals_text":
        return { label: "Goals", content: goalsDraft };
      case "reasoning_text":
        return { label: "Reasoning", content: reasoningDraft };
      case "needs_doing_text":
        return { label: "What needs doing", content: needsDoingDraft };
      case "freetext": {
        const ft = f.refId !== null ? freetextById.get(f.refId) : undefined;
        return ft ? { label: ft.label, content: ft.content } : null;
      }
      default:
        return null;
    }
  };

  const handleCopyField = (row: FieldLayoutRow) => {
    const content = contentFor(row);
    if (!content) return;
    copyField(row.id, content);
  };

  // See ProjectDetailPage.tsx's identical handler — optimistic local
  // merge (mergeFieldStylePatch) so the style popover updates instantly,
  // persistence runs in the background.
  const handleFieldStyleSave = (row: FieldLayoutRow, patch: FieldStylePatch) => {
    setFields((prev) => prev.map((f) => (f.id === row.id ? mergeFieldStylePatch(f, patch) : f)));
    updateFieldStyle(row.id, patch);
  };

  useEffect(() => {
    registerFieldStyleTarget({
      fields,
      onSave: (fieldId, patch) => {
        const row = fields.find((f) => f.id === fieldId);
        if (row) handleFieldStyleSave(row, patch);
      },
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
    if (!draggedId || draggedId === targetId || !goal) return;
    const ids = fields.map((f) => f.id);
    const from = ids.indexOf(draggedId);
    const to = ids.indexOf(targetId);
    if (from === -1 || to === -1) return;
    ids.splice(from, 1);
    ids.splice(to, 0, draggedId);
    await withFieldUndo("goal", goal.id, "Reorder fields", () => reorderFields(ids), pushUndo, load);
  };

  const availableFieldsToAdd: AddableField[] = computeAvailableFieldsToAdd("goal", fields);
  const hasWidgetsField = fields.some((f) => f.fieldType === "widgets");

  useEffect(() => {
    if (!goal) return;
    registerTarget({
      category: "goal",
      ownerId: goal.id,
      supportedWidgetTypes: ALL_WIDGET_TYPES,
      hasWidgetsField,
      widgets,
      onAddWidget: handleAddWidget,
      onDeleteWidget: handleDeleteWidget,
      onDuplicateWidget: handleDuplicateWidget,
      onReorder: handleReorderWidgets,
      onApplyLayout: handleApplyLayout,
      availableFieldsToAdd,
      onAddField: handleAddField,
      onPasteField: handlePasteField,
    });
    return () => registerTarget(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goal, widgets, fields, insertAt]);

  // Widget cards: only the small ⠿ handle is the native drag source —
  // NOT the whole card — this card sits nested inside the "widgets"
  // field's own draggable structure, and nested draggable ancestors are
  // a well-known way to break HTML5 drag-and-drop in Chromium/WebView2.
  const handleWidgetDragStart = (e: React.DragEvent, id: number) => {
    const card = (e.currentTarget as HTMLElement).closest(".project-widget-card") as HTMLElement | null;
    if (card) {
      const rect = card.getBoundingClientRect();
      e.dataTransfer.setDragImage(card, e.clientX - rect.left, e.clientY - rect.top);
    }
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(id));
  };

  const handleWidgetDragOver = (e: React.DragEvent, id: number) => {
    e.preventDefault();
    setDragOverId(id);
  };

  const handleWidgetDrop = async (e: React.DragEvent, targetId: number) => {
    e.preventDefault();
    setDragOverId(null);
    const draggedId = Number(e.dataTransfer.getData("text/plain"));
    if (!draggedId || draggedId === targetId) return;
    const ids = widgets.map((w) => w.id);
    const from = ids.indexOf(draggedId);
    const to = ids.indexOf(targetId);
    if (from === -1 || to === -1) return;
    ids.splice(from, 1);
    ids.splice(to, 0, draggedId);
    await handleReorderWidgets(ids);
  };

  const handleWidgetCardClick = (widgetId: number, normalAction: () => void) => {
    if (deleteToolActive) {
      handleDeleteWidget(widgetId);
      return;
    }
    if (copyToolActive) {
      handleDuplicateWidget(widgetId);
      return;
    }
    normalAction();
  };

  const handleDeleteGoal = async () => {
    if (!goal) return;
    if (!confirm(`Delete "${goal.name}"? This also removes its widgets and everything in them.`)) return;
    await deleteGoal(goal.id);
    onNavigate({ type: "goals-home" });
  };

  if (loading) {
    return (
      <div className="page">
        <p className="page-text">Loading…</p>
      </div>
    );
  }
  if (!goal) {
    return (
      <div className="page">
        <p className="page-text">Goal not found.</p>
      </div>
    );
  }

  const widgetsSection = (
    <div className="project-widgets-section">
      <div className="project-widgets-header">
        <h2 className="project-field-label">Widgets</h2>
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
          <button className="add-button secondary" onClick={() => handleAddWidget("table")}>
            Table
          </button>
          <button className="add-button secondary" onClick={() => handleAddWidget("photo")}>
            Quick Photo
          </button>
          <button className="add-button secondary" onClick={() => handleAddWidget("dock")}>
            Image Dock
          </button>
        </div>
      )}

      {widgets.length === 0 ? (
        <p className="page-text">No widgets yet.</p>
      ) : (
        <div className="project-widget-grid">
          {widgets.map((w) => (
            <div
              key={w.id}
              className={`project-widget-card${["dock", "photo", "table"].includes(w.widgetType) ? " project-widget-card-inline" : ""}${rearranging ? " project-widget-card-rearranging" : ""}${dragOverId === w.id ? " project-widget-card-drop-target" : ""}${rearranging && deleteToolActive ? " project-widget-card-delete-armed" : ""}`}
              onDragOver={(e) => handleWidgetDragOver(e, w.id)}
              onDragLeave={() => setDragOverId((id) => (id === w.id ? null : id))}
              onDrop={(e) => handleWidgetDrop(e, w.id)}
              onClickCapture={(e) => {
                if (rearranging && (deleteToolActive || copyToolActive)) {
                  e.preventDefault();
                  e.stopPropagation();
                  handleWidgetCardClick(w.id, () => {});
                }
              }}
            >
              {rearranging && (
                <span
                  className="project-widget-card-drag-handle"
                  draggable
                  title="Drag to reorder"
                  onDragStart={(e) => handleWidgetDragStart(e, w.id)}
                >
                  ⠿
                </span>
              )}
              {w.widgetType === "dock" ? (
                <ImageDockWidget widgetId={w.id} />
              ) : w.widgetType === "photo" ? (
                <QuickPhotoWidget widgetId={w.id} />
              ) : w.widgetType === "table" ? (
                <TableWidgetPreview
                  widgetId={w.id}
                  onOpen={() => onNavigate({ type: "project-table", widgetId: w.id, goalId: goal.id })}
                />
              ) : (
                <button
                  className="project-widget-card-open"
                  onClick={() =>
                    onNavigate(
                      w.widgetType === "journal"
                        ? { type: "project-journal", widgetId: w.id, goalId: goal.id }
                        : { type: "project-board", widgetId: w.id, goalId: goal.id }
                    )
                  }
                >
                  <span className="project-widget-card-icon">
                    {w.widgetType === "journal" ? "📓" : "🧷"}
                  </span>
                  <span className="project-widget-card-title">{w.title}</span>
                </button>
              )}
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
  );

  const renderField = (f: FieldLayoutRow) => {
    switch (f.fieldType) {
      case "goal_select":
        return null; // Goals have no "which goal" picker — that field only applies to projects.
      case "goals_text":
        return (
          <div className="project-field">
            <div className="field-slot-header-row">
              <label className="project-field-label" style={headerStyle(f)}>Goals</label>
            </div>
            <textarea
              className="instructions-textarea"
              rows={3}
              style={contentStyle(f)}
              value={goalsDraft}
              onChange={(e) => setGoalsDraft(e.target.value)}
              onBlur={saveGoals}
              placeholder="What does achieving this actually look like?"
            />
          </div>
        );
      case "reasoning_text":
        return (
          <div className="project-field">
            <div className="field-slot-header-row">
              <label className="project-field-label" style={headerStyle(f)}>Reasoning</label>
            </div>
            <textarea
              className="instructions-textarea"
              rows={3}
              style={contentStyle(f)}
              value={reasoningDraft}
              onChange={(e) => setReasoningDraft(e.target.value)}
              onBlur={saveReasoning}
              placeholder="Why does this goal matter?"
            />
          </div>
        );
      case "needs_doing_text":
        return (
          <div className="project-field">
            <div className="field-slot-header-row">
              <label className="project-field-label" style={headerStyle(f)}>What needs doing</label>
            </div>
            <textarea
              className="instructions-textarea"
              rows={3}
              style={contentStyle(f)}
              value={needsDoingDraft}
              onChange={(e) => setNeedsDoingDraft(e.target.value)}
              onBlur={saveNeedsDoing}
              placeholder="What actually has to happen?"
            />
          </div>
        );
      case "estimated_start":
        return (
          <div className="project-field">
            <div className="field-slot-header-row">
              <label className="project-field-label" style={headerStyle(f)}>Estimated start date</label>
            </div>
            <EstimatedStartDateField
              value={goal.estimatedStartDate}
              onSave={handleSaveEstimatedStart}
              style={contentStyle(f)}
            />
          </div>
        );
      case "expected_range":
        return (
          <div className="project-field">
            <div className="field-slot-header-row">
              <label className="project-field-label" style={headerStyle(f)}>When it should be done</label>
            </div>
            <DreamDateRangeField
              start={goal.expectedDateStart}
              end={goal.expectedDateEnd}
              resetToken={dateResetToken}
              onSave={handleSaveDate}
              style={contentStyle(f)}
            />
          </div>
        );
      case "widgets":
        return widgetsSection;
      case "freetext": {
        const ft = f.refId !== null ? freetextById.get(f.refId) : undefined;
        if (!ft) return null;
        return (
          <FreetextFieldEditor
            refId={ft.id}
            label={ft.label}
            content={ft.content}
            field={f}
          />
        );
      }
    }
  };

  const fieldElements: React.ReactNode[] = [];
  fields.forEach((f, i) => {
    if (rearranging) {
      fieldElements.push(<FieldGap key={`gap-${f.id}`} order={gapOrderBefore(fields, i)} />);
    }
    fieldElements.push(
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
      >
        {renderField(f)}
      </RearrangeableField>
    );
  });
  if (rearranging) {
    fieldElements.push(<FieldGap key="gap-end" order={gapOrderAfterLast(fields)} />);
  }

  return (
    <div className="page" data-color-surface="page-bg" style={pageSurfaceStyle(pageBgOverrides["page-bg"])}>
      <Breadcrumb
        crumbs={[
          { label: "Goals", onClick: () => onNavigate({ type: "goals-home" }) },
          ...(goal.dreamId !== null && dreamName
            ? [{ label: dreamName, onClick: () => onNavigate({ type: "dream-detail", dreamId: goal.dreamId! }) }]
            : []),
          { label: goal.name },
        ]}
      />

      <div className="page-header">
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
            {goal.name}
          </h1>
        )}
        <div className="detail-header-actions" style={{ position: "relative", display: "flex", gap: "6px" }}>
          <button
            className="icon-button"
            onClick={() => onNavigate({ type: "goal-web", goalId: goal.id })}
            title="Enter Goal Web"
          >
            <Icon iconKey="web-view" size={16} />
          </button>
          <button className="icon-button" onClick={() => setMenuOpen((v) => !v)} title="Goal actions">
            <Icon iconKey="menu-more" size={16} />
          </button>
          {menuOpen && (
            <>
              <div className="menu-backdrop" onClick={() => setMenuOpen(false)} />
              <div className="managed-row-dropdown" style={{ right: 0, minWidth: 160 }}>
                <button
                  className="dropdown-item dropdown-item-danger"
                  onClick={() => {
                    setMenuOpen(false);
                    handleDeleteGoal();
                  }}
                >
                  Delete
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {fieldElements}
    </div>
  );
}
