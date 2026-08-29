import { useEffect, useState } from "react";
import { View } from "../types/nav";
import { Goal, Project, ProjectWidget, ProjectWidgetType } from "../types/project";
import {
  fetchProject,
  updateProjectField,
  updateProjectExpectedDate,
  updateProjectEstimatedStartDate,
  updateProjectGoalId,
  fetchWidgetsForProject,
  addWidget,
  deleteWidget,
  deleteProject,
  updateWidgetOrder,
  duplicateWidget,
  fetchJournalEntries,
  fetchBoardItems,
} from "../db/projects";
import { fetchAllGoals } from "../db/goals";
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

export function ProjectDetailPage({
  projectId,
  onNavigate,
}: {
  projectId: number;
  onNavigate: (view: View) => void;
}) {
  const { overrides: pageBgOverrides } = usePageBackground();
  const [project, setProject] = useState<Project | null>(null);
  const [dreamName, setDreamName] = useState("");
  const [goals, setGoals] = useState<Goal[]>([]);
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
  const [widgetPreviews, setWidgetPreviews] = useState<Record<number, string>>({});
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
    const p = await fetchProject(projectId);
    if (p) {
      setProject(p);
      setGoalsDraft(p.goals);
      setReasoningDraft(p.reasoning);
      setNeedsDoingDraft(p.needsDoing);
      const dream = p.dreamId !== null ? await fetchDream(p.dreamId) : null;
      setDreamName(dream?.name ?? "");
    }
    setGoals(await fetchAllGoals());
    setWidgets(await fetchWidgetsForProject(projectId));
    const fieldRows = await fetchFieldLayout("project", projectId);
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
  }, [projectId]);

  // Wii-menu-style widget grid (see widgetsSection below) — every tile
  // shows a one-line live preview. Table/photo/dock already render their
  // own preview inline; journal/linkboard don't have an equivalent, so
  // this fetches just enough to build one.
  useEffect(() => {
    const targets = widgets.filter((w) => w.widgetType === "journal" || w.widgetType === "linkboard");
    if (targets.length === 0) return;
    let cancelled = false;
    Promise.all(
      targets.map(async (w): Promise<[number, string]> => {
        if (w.widgetType === "journal") {
          const entries = await fetchJournalEntries(w.id);
          return [w.id, entries[0] ? entries[0].content.slice(0, 70) : "No entries yet"];
        }
        const items = await fetchBoardItems(w.id);
        if (items.length === 0) return [w.id, "Empty"];
        const first = items[0];
        const firstLabel =
          first.itemType === "image"
            ? "🖼 Image"
            : (first.itemType === "link" ? first.linkLabel || first.linkHref : first.textContent) ?? "";
        return [w.id, `${items.length} item${items.length === 1 ? "" : "s"} · ${firstLabel.slice(0, 40)}`];
      })
    ).then((pairs) => {
      if (!cancelled) setWidgetPreviews(Object.fromEntries(pairs));
    });
    return () => {
      cancelled = true;
    };
  }, [widgets]);

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

  const handleSaveEstimatedStart = async (date: string | null) => {
    if (!project) return;
    await updateProjectEstimatedStartDate(project.id, date);
    setProject((prev) => (prev ? { ...prev, estimatedStartDate: date ?? undefined } : prev));
  };

  // Attaching a project to a goal is what makes it auto-populate on
  // that goal's Goal Web (see GoalWebPage.tsx) — this is the "assign an
  // existing project" half of that; creating one directly from the Goal
  // Web's "+ Project" button is the other.
  const handleGoalChange = async (goalIdValue: string) => {
    if (!project) return;
    const goalId = goalIdValue ? Number(goalIdValue) : null;
    await updateProjectGoalId(project.id, goalId);
    setProject((prev) => (prev ? { ...prev, goalId } : prev));
  };

  const WIDGET_TITLES: Record<ProjectWidgetType, string> = {
    journal: "Journal",
    linkboard: "Board",
    table: "Table",
    photo: "Quick Photo",
    dock: "Image Dock",
  };

  const WIDGET_ICON_KEYS: Record<ProjectWidgetType, string> = {
    journal: "widget-journal",
    linkboard: "widget-linkboard",
    table: "widget-table",
    photo: "widget-photo",
    dock: "widget-dock",
  };

  const handleAddWidget = async (type: ProjectWidgetType) => {
    if (!project) return;
    await addWidget(project.id, type, WIDGET_TITLES[type]);
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
    if (!project) return;
    // A layout replaces the widget grid rather than appending to it —
    // without clearing first, loading a layout onto a page that already
    // has widgets (including reloading the very one you just saved from)
    // just piles a second copy of everything on top of the first.
    if (
      widgets.length > 0 &&
      !confirm(`Loading "${layout.name}" replaces the ${widgets.length} widget(s) already on this page. Continue?`)
    ) {
      return;
    }
    for (const w of widgets) await deleteWidget(w.id);
    for (const w of layout.widgets) {
      const newId = await addWidget(project.id, w.widgetType, w.title);
      await applyWidgetContent(newId, w.widgetType, w.content);
    }
    await load();
  };

  // Where a newly added field lands — whichever gap the user clicked
  // (see FieldGap), or the end of the list if none was picked.
  const nextSortOrder = (): number => (insertAt !== null ? insertAt : gapOrderAfterLast(fields));

  const handleAddField = async (type: FieldType) => {
    if (!project) return;
    const order = nextSortOrder();
    await withFieldUndo(
      "project",
      project.id,
      "Add field",
      () =>
        type === "freetext"
          ? addFreetextField("project", project.id, order)
          : addBuiltinField("project", project.id, type, order),
      pushUndo,
      load
    );
    setInsertAt(null);
  };

  const handlePasteField = async (clip: FieldClipboard, order: number) => {
    if (!project) return;
    await withFieldUndo(
      "project",
      project.id,
      "Paste field",
      () => addFreetextFieldWithContent("project", project.id, order, clip.label, clip.content),
      pushUndo,
      load
    );
  };

  const handleDeleteField = async (row: FieldLayoutRow) => {
    if (!REMOVABLE_FIELD_TYPES.includes(row.fieldType) || !project) return;
    await withFieldUndo(
      "project",
      project.id,
      "Delete field",
      () => removeField(row.id, row.fieldType, row.refId),
      pushUndo,
      load
    );
  };

  // What Copy captures for a given field — a plain label+text snapshot,
  // whether the source is a freetext box or a built-in text field (both
  // read from their live draft state, not stale DB content). Non-text
  // fields (dates, the goal picker, widgets) aren't copiable.
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

  // Optimistic local update (see mergeFieldStylePatch) so the style
  // popover's controls reflect a change immediately instead of waiting
  // on a full page reload — persistence runs independently in the
  // background, same fire-and-forget convention as every autosaving
  // field on this page.
  const handleFieldStyleSave = (row: FieldLayoutRow, patch: FieldStylePatch) => {
    setFields((prev) => prev.map((f) => (f.id === row.id ? mergeFieldStylePatch(f, patch) : f)));
    updateFieldStyle(row.id, patch);
  };

  // Lets ctrl+click on any field (see RearrangeableField.tsx) open its
  // style controls in the Dynamic Settings panel — see
  // FieldStyleRegistryContext.tsx and overlay/FieldStyleQuickEdit.tsx.
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
    if (!draggedId || draggedId === targetId || !project) return;
    const ids = fields.map((f) => f.id);
    const from = ids.indexOf(draggedId);
    const to = ids.indexOf(targetId);
    if (from === -1 || to === -1) return;
    ids.splice(from, 1);
    ids.splice(to, 0, draggedId);
    await withFieldUndo("project", project.id, "Reorder fields", () => reorderFields(ids), pushUndo, load);
  };

  const availableFieldsToAdd: AddableField[] = computeAvailableFieldsToAdd("project", fields);
  const hasWidgetsField = fields.some((f) => f.fieldType === "widgets");

  // Registers this page as rearrange mode's active target whenever it's
  // mounted with a loaded project — see rearrange/RearrangeModeContext.tsx.
  // Re-registers on every widgets/fields/project change so the toolbar's
  // "Save layout"/"Add"/etc. always see current data, not a stale
  // snapshot from whenever the page first mounted.
  useEffect(() => {
    if (!project) return;
    registerTarget({
      category: "project",
      ownerId: project.id,
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
  }, [project, widgets, fields, insertAt]);

  // Widget cards: only the small ⠿ handle is the native drag source —
  // NOT the whole card — deliberately: this card sits nested inside the
  // "widgets" field's own draggable structure, and a draggable ancestor
  // around a draggable descendant is a well-known way to break HTML5
  // drag-and-drop in Chromium/WebView2 (this is what made dragging stop
  // working at all once widgets became one more field among many).
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

  // In rearrange mode, clicking a widget card does whatever tool is
  // active (delete, or copy — which for widgets just duplicates in
  // place, unlike fields' copy/paste, since a widget can already be
  // freely duplicated) instead of its normal open action.
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

  const handleDeleteProject = async () => {
    if (!project) return;
    if (!confirm(`Delete "${project.name}"? This also removes its widgets and everything in them.`)) return;
    await deleteProject(project.id);
    onNavigate({ type: "projects-home" });
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
        // A menu of uniform rounded tiles, not a mixed bag of button
        // sizes — every widget gets the same icon+title header, whether
        // it's a nav card (journal/board — no content of its own to
        // show, so a fetched one-line preview stands in) or one that
        // already renders its own live content inline (table/photo/
        // dock). Click a tile to go in, same as a console's game grid.
        <div className="project-wii-grid">
          {widgets.map((w) => {
            const isInline = w.widgetType === "dock" || w.widgetType === "photo" || w.widgetType === "table";
            return (
              <div
                key={w.id}
                className={`project-wii-tile${rearranging ? " project-wii-tile-rearranging" : ""}${dragOverId === w.id ? " project-wii-tile-drop-target" : ""}${rearranging && deleteToolActive ? " project-wii-tile-delete-armed" : ""}`}
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
                    className="project-wii-tile-drag-handle"
                    draggable
                    title="Drag to reorder"
                    onDragStart={(e) => handleWidgetDragStart(e, w.id)}
                  >
                    ⠿
                  </span>
                )}
                {isInline ? (
                  <div className="project-wii-tile-inline">
                    <div className="project-wii-tile-header">
                      <span className="project-wii-tile-icon"><Icon iconKey={WIDGET_ICON_KEYS[w.widgetType]} size={16} /></span>
                      <span className="project-wii-tile-title">{w.title}</span>
                    </div>
                    <div className="project-wii-tile-preview-body">
                      {w.widgetType === "dock" ? (
                        <ImageDockWidget widgetId={w.id} />
                      ) : w.widgetType === "photo" ? (
                        <QuickPhotoWidget widgetId={w.id} />
                      ) : (
                        <TableWidgetPreview
                          widgetId={w.id}
                          onOpen={() =>
                            onNavigate({ type: "project-table", widgetId: w.id, projectId: project.id })
                          }
                        />
                      )}
                    </div>
                  </div>
                ) : (
                  <button
                    className="project-wii-tile-open"
                    onClick={() =>
                      onNavigate(
                        w.widgetType === "journal"
                          ? { type: "project-journal", widgetId: w.id, projectId: project.id }
                          : { type: "project-board", widgetId: w.id, projectId: project.id }
                      )
                    }
                  >
                    <div className="project-wii-tile-header">
                      <span className="project-wii-tile-icon"><Icon iconKey={WIDGET_ICON_KEYS[w.widgetType]} size={16} /></span>
                      <span className="project-wii-tile-title">{w.title}</span>
                    </div>
                    <span className="project-wii-tile-preview-text">
                      {widgetPreviews[w.id] ?? "…"}
                    </span>
                  </button>
                )}
                <button
                  className="project-wii-tile-delete"
                  onClick={() => handleDeleteWidget(w.id)}
                  title="Delete widget"
                >
                  ✕
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  // Every built-in field type maps to exactly one of these — "widgets"
  // and "freetext" are the two whose content isn't a fixed project
  // column (see db/fieldLayout.ts).
  const renderField = (f: FieldLayoutRow) => {
    switch (f.fieldType) {
      case "goal_select":
        return (
          <div className="project-field">
            <label className="project-field-label">Goal</label>
            <select
              className="inline-add-input"
              style={{ marginBottom: 0 }}
              value={project.goalId ?? ""}
              onChange={(e) => handleGoalChange(e.target.value)}
            >
              <option value="">(none)</option>
              {goals.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>
        );
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
              placeholder="What is this project trying to achieve?"
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
              placeholder="Why does this project matter?"
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
              value={project.estimatedStartDate}
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
              start={project.expectedDateStart}
              end={project.expectedDateEnd}
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
          { label: "Projects", onClick: () => onNavigate({ type: "projects-home" }) },
          ...(project.dreamId !== null && dreamName
            ? [{ label: dreamName, onClick: () => onNavigate({ type: "dream-detail", dreamId: project.dreamId! }) }]
            : []),
          { label: project.name },
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
            {project.name}
          </h1>
        )}
        <div className="detail-header-actions" style={{ position: "relative", display: "flex", gap: "6px" }}>
          {project.goalId !== null && (
            <button
              className="icon-button"
              onClick={() => onNavigate({ type: "goal-web", goalId: project.goalId! })}
              title="View tasks in Goal Web"
            >
              <Icon iconKey="web-view" size={16} />
            </button>
          )}
          <button className="icon-button" onClick={() => setMenuOpen((v) => !v)} title="Project actions">
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
                    handleDeleteProject();
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
