// src/pages/DreamDetailPage.tsx
import { useEffect, useState } from "react";
import {
  fetchDream,
  fetchDreamHistory,
  fetchLinkedDreams,
  updateDreamField,
  updateDreamExpectedDate,
  removeDreamLink,
  wakeDream,
  deleteDream,
  putDreamToBed,
  parseSleepDuration,
  formatDateRange,
  LinkedDream,
} from "../db/dreams";
import { Dream, DreamHistoryEntry, DreamHistoryField, DreamPriority } from "../types/models";
import { View } from "../types/nav";
import {
  fetchFieldLayout,
  reorderFields,
  addBuiltinField,
  addFreetextField,
  addFreetextFieldWithContent,
  removeField,
  fetchFreetextFields,
  FieldLayoutRow,
  FieldType,
  FreetextField,
  REMOVABLE_FIELD_TYPES,
} from "../db/fieldLayout";
import { Breadcrumb } from "../components/Breadcrumb";
import { DreamDateRangeField } from "../components/DreamDateRangeField";
import { FreetextFieldEditor } from "../components/FreetextFieldEditor";
import { useRearrangeMode, AddableField, FieldClipboard } from "../rearrange/RearrangeModeContext";
import { RearrangeableField, FieldGap } from "../rearrange/RearrangeableField";
import { withFieldUndo } from "../rearrange/fieldUndo";
import "../components/ManagedListRow.css"; // reusing .managed-row-dropdown / .dropdown-item / .menu-backdrop
import "./Page.css";
import "./DreamDetailPage.css";

const PRIORITY_LABELS: Record<DreamPriority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

const FIELD_LABELS: Record<DreamHistoryField, string> = {
  name: "Name",
  reasoning: "Reasoning",
  expectedDate: "Expected date",
  priority: "Priority",
  notes: "Notes",
  sleep: "Sleep state",
};

const ALL_HISTORY_FIELDS = Object.keys(FIELD_LABELS) as DreamHistoryField[];
const COPIABLE_FIELD_TYPES: FieldType[] = ["dream_reasoning_text", "dream_notes_text", "freetext"];

function gapOrderBefore(fields: FieldLayoutRow[], index: number): number {
  const current = fields[index].sortOrder;
  if (index === 0) return current - 1;
  return (fields[index - 1].sortOrder + current) / 2;
}

function gapOrderAfterLast(fields: FieldLayoutRow[]): number {
  return fields.length === 0 ? 0 : fields[fields.length - 1].sortOrder + 1;
}

function formatTimestamp(raw: string): string {
  const iso = raw.includes("T") ? raw : `${raw.replace(" ", "T")}Z`;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return raw;
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// The one place every content edit funnels through: hold the pending
// old -> new value, ask why, then either apply() it (with the reason
// attached to its dream_history row) or revert() and discard it. This
// is what makes editing feel accountable instead of silent.
interface PendingChange {
  label: string;
  oldDisplay: string;
  newDisplay: string;
  apply: (reason: string | null) => Promise<void>;
  revert: () => void;
}

export function DreamDetailPage({
  dreamId,
  onNavigate,
}: {
  dreamId: number;
  onNavigate: (view: View) => void;
}) {
  const [dream, setDream] = useState<Dream | null>(null);
  const [history, setHistory] = useState<DreamHistoryEntry[]>([]);
  const [linked, setLinked] = useState<LinkedDream[]>([]);
  const [fields, setFields] = useState<FieldLayoutRow[]>([]);
  const [freetextById, setFreetextById] = useState<Map<number, FreetextField>>(new Map());
  const [loading, setLoading] = useState(true);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [reasoningDraft, setReasoningDraft] = useState("");
  const [notesDraft, setNotesDraft] = useState("");
  const [dateResetToken, setDateResetToken] = useState(0);
  const [pendingChange, setPendingChange] = useState<PendingChange | null>(null);
  const [reasonDraft, setReasonDraft] = useState("");
  const [showHistoryFilter, setShowHistoryFilter] = useState(false);
  const [historyFieldFilter, setHistoryFieldFilter] = useState<Record<DreamHistoryField, boolean>>(
    Object.fromEntries(ALL_HISTORY_FIELDS.map((f) => [f, true])) as Record<DreamHistoryField, boolean>
  );
  const [historyDateFrom, setHistoryDateFrom] = useState("");
  const [historyDateTo, setHistoryDateTo] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
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

  const load = () => {
    setLoading(true);
    Promise.all([
      fetchDream(dreamId),
      fetchDreamHistory(dreamId),
      fetchLinkedDreams(dreamId),
      fetchFieldLayout("dream", dreamId),
    ]).then(async ([d, h, l, fieldRows]) => {
      setDream(d);
      setReasoningDraft(d?.reasoning ?? "");
      setNotesDraft(d?.notes ?? "");
      setHistory(h);
      setLinked(l);
      setFields(fieldRows);
      const freetextIds = fieldRows
        .filter((f) => f.fieldType === "freetext" && f.refId !== null)
        .map((f) => f.refId!);
      setFreetextById(await fetchFreetextFields(freetextIds));
      setLoading(false);
    });
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dreamId]);

  const refreshHistory = () => fetchDreamHistory(dreamId).then(setHistory);

  // Only date and priority changes go through the reason-for-change
  // modal below — name/reasoning/notes still write a dream_history row
  // (via apply(null)), just without stopping to ask why every time.
  // Dates and priority are the two fields worth pausing for: they're
  // what you're most likely to want to remember the reasoning behind
  // later.
  const openChange = (change: PendingChange) => {
    setReasonDraft("");
    setPendingChange(change);
  };

  const commitDirect = async (change: Pick<PendingChange, "apply">) => {
    await change.apply(null);
    refreshHistory();
  };

  const confirmChange = async () => {
    if (!pendingChange) return;
    await pendingChange.apply(reasonDraft.trim() || null);
    setPendingChange(null);
    refreshHistory();
  };

  const cancelChange = () => {
    pendingChange?.revert();
    setPendingChange(null);
  };

  const startRename = () => {
    setNameDraft(dream?.name ?? "");
    setEditingName(true);
  };

  const confirmRename = () => {
    const trimmed = nameDraft.trim();
    setEditingName(false);
    if (!dream || !trimmed || trimmed === dream.name) return;
    commitDirect({
      apply: async (reason) => {
        await updateDreamField(dream.id, "name", trimmed, reason);
        setDream((prev) => (prev ? { ...prev, name: trimmed } : prev));
      },
    });
  };

  const commitReasoning = () => {
    if (!dream || reasoningDraft === dream.reasoning) return;
    commitDirect({
      apply: async (reason) => {
        await updateDreamField(dream.id, "reasoning", reasoningDraft, reason);
        setDream((prev) => (prev ? { ...prev, reasoning: reasoningDraft } : prev));
      },
    });
  };

  const commitNotes = () => {
    if (!dream || notesDraft === dream.notes) return;
    commitDirect({
      apply: async (reason) => {
        await updateDreamField(dream.id, "notes", notesDraft, reason);
        setDream((prev) => (prev ? { ...prev, notes: notesDraft } : prev));
      },
    });
  };

  const commitPriority = (value: DreamPriority) => {
    if (!dream || value === dream.priority) return;
    openChange({
      label: "Priority",
      oldDisplay: PRIORITY_LABELS[dream.priority],
      newDisplay: PRIORITY_LABELS[value],
      apply: async (reason) => {
        await updateDreamField(dream.id, "priority", value, reason);
        setDream((prev) => (prev ? { ...prev, priority: value } : prev));
      },
      revert: () => {}, // <select> reads straight from dream.priority — nothing to revert
    });
  };

  const commitDate = (start: string | null, end: string | null) => {
    if (!dream) return;
    if ((dream.expectedDateStart ?? null) === start && (dream.expectedDateEnd ?? null) === end) return;
    openChange({
      label: "Expected date",
      oldDisplay: formatDateRange(dream.expectedDateStart, dream.expectedDateEnd),
      newDisplay: formatDateRange(start, end),
      apply: async (reason) => {
        await updateDreamExpectedDate(dream.id, start, end, reason);
        setDream((prev) =>
          prev ? { ...prev, expectedDateStart: start ?? undefined, expectedDateEnd: end ?? undefined } : prev
        );
      },
      revert: () => setDateResetToken((t) => t + 1),
    });
  };

  const handleUnlink = async (linkId: number) => {
    await removeDreamLink(linkId);
    setLinked((prev) => prev.filter((l) => l.linkId !== linkId));
  };

  const filteredHistory = history.filter((entry) => {
    if (!historyFieldFilter[entry.field]) return false;
    if (historyDateFrom || historyDateTo) {
      const entryDate = entry.changedAt.slice(0, 10);
      if (historyDateFrom && entryDate < historyDateFrom) return false;
      if (historyDateTo && entryDate > historyDateTo) return false;
    }
    return true;
  });

  const handleWake = async () => {
    if (!dream) return;
    await wakeDream(dream.id);
    setDream((prev) => (prev ? { ...prev, isAsleep: false, sleepUntil: undefined } : prev));
    refreshHistory();
  };

  const handleDelete = async () => {
    if (!dream) return;
    setMenuOpen(false);
    if (
      !confirm(
        `Delete "${dream.name}"? This also removes its links and history. Any projects linked to it just detach, they aren't deleted.`
      )
    )
      return;
    await deleteDream(dream.id);
    onNavigate({ type: "dreams-web" });
  };

  const handlePutToBed = async () => {
    if (!dream) return;
    setMenuOpen(false);
    const input = window.prompt(
      `How far out do you want to put "${dream.name}" to bed? (e.g. "6 months", "2 years", "3 weeks")`,
      "1 year"
    );
    if (!input) return;
    const sleepUntil = parseSleepDuration(input);
    if (!sleepUntil) {
      alert('Couldn\'t understand that — try something like "6 months" or "2 years".');
      return;
    }
    await putDreamToBed(dream.id, sleepUntil);
    setDream((prev) => (prev ? { ...prev, isAsleep: true, sleepUntil } : prev));
    refreshHistory();
  };

  // Where a newly added field lands — whichever gap the user clicked
  // (see FieldGap), or the end of the list if none was picked.
  const nextSortOrder = (): number => (insertAt !== null ? insertAt : gapOrderAfterLast(fields));

  const handleAddField = async (type: FieldType) => {
    if (!dream) return;
    const order = nextSortOrder();
    await withFieldUndo(
      "dream",
      dream.id,
      "Add field",
      () =>
        type === "freetext"
          ? addFreetextField("dream", dream.id, order)
          : addBuiltinField("dream", dream.id, type, order),
      pushUndo,
      load
    );
    setInsertAt(null);
  };

  const handlePasteField = async (clip: FieldClipboard, order: number) => {
    if (!dream) return;
    await withFieldUndo(
      "dream",
      dream.id,
      "Paste field",
      () => addFreetextFieldWithContent("dream", dream.id, order, clip.label, clip.content),
      pushUndo,
      load
    );
  };

  const handleDeleteField = async (row: FieldLayoutRow) => {
    if (!REMOVABLE_FIELD_TYPES.includes(row.fieldType) || !dream) return;
    await withFieldUndo(
      "dream",
      dream.id,
      "Delete field",
      () => removeField(row.id, row.fieldType, row.refId),
      pushUndo,
      load
    );
  };

  const contentFor = (f: FieldLayoutRow): FieldClipboard | null => {
    switch (f.fieldType) {
      case "dream_reasoning_text":
        return { label: "Reasoning", content: reasoningDraft };
      case "dream_notes_text":
        return { label: "Other words", content: notesDraft };
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

  const handleFieldDragStart = (e: React.DragEvent, id: number) => {
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
    if (!draggedId || draggedId === targetId || !dream) return;
    const ids = fields.map((f) => f.id);
    const from = ids.indexOf(draggedId);
    const to = ids.indexOf(targetId);
    if (from === -1 || to === -1) return;
    ids.splice(from, 1);
    ids.splice(to, 0, draggedId);
    await withFieldUndo("dream", dream.id, "Reorder fields", () => reorderFields(ids), pushUndo, load);
  };

  const availableFieldsToAdd: AddableField[] = (() => {
    const present = new Set(fields.map((f) => f.fieldType));
    return present.has("dream_expected_date") ? [] : [{ type: "dream_expected_date", label: "Expected date" }];
  })();

  // Dream Detail has no widget grid at all — this target exists purely
  // for the field-rearrangement system, so the widget-shaped callbacks
  // are unreachable no-ops (RearrangeToolbar hides Widgets/Save/Load
  // whenever supportedWidgetTypes is empty).
  useEffect(() => {
    if (!dream) return;
    registerTarget({
      category: "dream",
      ownerId: dream.id,
      supportedWidgetTypes: [],
      widgets: [],
      onAddWidget: async () => {},
      onDeleteWidget: async () => {},
      onDuplicateWidget: async () => {},
      onReorder: async () => {},
      onApplyLayout: async () => {},
      availableFieldsToAdd,
      onAddField: handleAddField,
      onPasteField: handlePasteField,
    });
    return () => registerTarget(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dream, fields, insertAt]);

  if (loading) {
    return (
      <div className="page">
        <p className="page-text">Loading…</p>
      </div>
    );
  }

  if (!dream) {
    return (
      <div className="page">
        <p className="page-text">Dream not found.</p>
      </div>
    );
  }

  const renderField = (f: FieldLayoutRow) => {
    switch (f.fieldType) {
      case "dream_expected_date":
        return (
          <label className="dream-field">
            <span className="dream-field-label">Expected date</span>
            <DreamDateRangeField
              start={dream.expectedDateStart}
              end={dream.expectedDateEnd}
              resetToken={dateResetToken}
              onSave={commitDate}
            />
          </label>
        );
      case "dream_priority":
        return (
          <label className="dream-field">
            <span className="dream-field-label">Priority — also sets its size on the web</span>
            <select
              className="inline-add-input"
              value={dream.priority}
              onChange={(e) => commitPriority(e.target.value as DreamPriority)}
            >
              {(Object.keys(PRIORITY_LABELS) as DreamPriority[]).map((p) => (
                <option key={p} value={p}>
                  {PRIORITY_LABELS[p]}
                </option>
              ))}
            </select>
          </label>
        );
      case "dream_reasoning_text":
        return (
          <label className="dream-field">
            <span className="dream-field-label">Reasoning — why this dream matters</span>
            <textarea
              className="instructions-textarea"
              rows={4}
              value={reasoningDraft}
              onChange={(e) => setReasoningDraft(e.target.value)}
              onBlur={commitReasoning}
              placeholder="Why does this matter to you?"
            />
          </label>
        );
      case "dream_notes_text":
        return (
          <label className="dream-field">
            <span className="dream-field-label">Other words</span>
            <textarea
              className="instructions-textarea"
              rows={4}
              value={notesDraft}
              onChange={(e) => setNotesDraft(e.target.value)}
              onBlur={commitNotes}
              placeholder="Anything else — details, feelings, plans…"
            />
          </label>
        );
      case "dream_linked":
        return (
          <div className="theme-section">
            <h2 className="theme-section-title">Linked dreams</h2>
            {linked.length === 0 ? (
              <p className="page-text">No links yet — draw one on the Dream Web.</p>
            ) : (
              <div className="theme-color-list">
                {linked.map((l) => (
                  <div key={l.linkId} className="theme-color-row">
                    <button
                      className="dream-link-button"
                      onClick={() => onNavigate({ type: "dream-detail", dreamId: l.dream.id })}
                    >
                      {l.dream.name}
                    </button>
                    <button className="add-button danger" onClick={() => handleUnlink(l.linkId)}>
                      Unlink
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      case "dream_memory":
        return (
          <div className="theme-section">
            <div className="dream-memory-header">
              <h2 className="theme-section-title">Memory</h2>
              {history.length > 0 && (
                <div style={{ position: "relative" }}>
                  <button className="add-button secondary" onClick={() => setShowHistoryFilter((v) => !v)}>
                    Filter
                  </button>
                  {showHistoryFilter && (
                    <div className="dream-filter-dropdown">
                      <div className="dream-filter-section">
                        {ALL_HISTORY_FIELDS.map((f) => (
                          <label key={f} className="dream-filter-checkbox">
                            <span>{FIELD_LABELS[f]}</span>
                            <input
                              type="checkbox"
                              checked={historyFieldFilter[f]}
                              onChange={(e) =>
                                setHistoryFieldFilter({ ...historyFieldFilter, [f]: e.target.checked })
                              }
                            />
                          </label>
                        ))}
                      </div>
                      <hr />
                      <div className="dream-filter-section">
                        <label className="dream-filter-date">
                          From
                          <input
                            type="date"
                            value={historyDateFrom}
                            onChange={(e) => setHistoryDateFrom(e.target.value)}
                          />
                        </label>
                        <label className="dream-filter-date">
                          To
                          <input type="date" value={historyDateTo} onChange={(e) => setHistoryDateTo(e.target.value)} />
                        </label>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
            {history.length === 0 ? (
              <p className="page-text">No edits yet — this dream's history will build up here.</p>
            ) : filteredHistory.length === 0 ? (
              <p className="page-text">No changes match this filter.</p>
            ) : (
              <ul className="dream-history-list">
                {filteredHistory.map((entry) => (
                  <li key={entry.id} className="dream-history-entry">
                    <span className="dream-history-field">{FIELD_LABELS[entry.field] ?? entry.field}</span>
                    <span className="dream-history-change">
                      "{entry.oldValue || "—"}" → "{entry.newValue || "—"}"
                    </span>
                    {entry.reason && <span className="dream-history-reason">"{entry.reason}"</span>}
                    <span className="dream-history-time">{formatTimestamp(entry.changedAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      case "freetext": {
        const ft = f.refId !== null ? freetextById.get(f.refId) : undefined;
        if (!ft) return null;
        return <FreetextFieldEditor refId={ft.id} label={ft.label} content={ft.content} />;
      }
      default:
        return null;
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
    <div className="page">
      <Breadcrumb
        crumbs={[
          { label: "Dream Web", onClick: () => onNavigate({ type: "dreams-web" }) },
          { label: dream.name },
        ]}
      />

      {dream.isAsleep && (
        <div className="dream-sleeping-banner">
          <span>This dream is asleep{dream.sleepUntil ? ` until ${dream.sleepUntil}` : ""}.</span>
          <button className="add-button secondary" onClick={handleWake}>
            Wake now
          </button>
        </div>
      )}

      <div className="detail-header">
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
            {dream.name}
          </h1>
        )}
        <div className="detail-header-actions" style={{ position: "relative" }}>
          <button className="icon-button" onClick={() => setMenuOpen((v) => !v)} title="Dream actions">
            ⋯
          </button>
          {menuOpen && (
            <>
              <div className="menu-backdrop" onClick={() => setMenuOpen(false)} />
              <div className="managed-row-dropdown" style={{ right: 0, minWidth: 160 }}>
                {!dream.isAsleep && (
                  <button className="dropdown-item" onClick={handlePutToBed}>
                    Put dream to bed
                  </button>
                )}
                <button className="dropdown-item dropdown-item-danger" onClick={handleDelete}>
                  Delete
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {fieldElements}

      {pendingChange && (
        <div className="dream-reason-backdrop">
          <div className="dream-reason-modal">
            <h3 className="dream-reason-title">Why the change?</h3>
            <p className="dream-reason-diff">
              <strong>{pendingChange.label}</strong>: "{pendingChange.oldDisplay}" → "{pendingChange.newDisplay}"
            </p>
            <textarea
              className="instructions-textarea"
              rows={3}
              autoFocus
              value={reasonDraft}
              onChange={(e) => setReasonDraft(e.target.value)}
              placeholder="What changed, and why? (optional, but this is what makes your memory worth reading later)"
            />
            <div className="dream-reason-actions">
              <button className="add-button secondary" onClick={cancelChange}>
                Cancel
              </button>
              <button className="add-button" onClick={confirmChange}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
