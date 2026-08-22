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
  formatDateRange,
  LinkedDream,
} from "../db/dreams";
import { Dream, DreamHistoryEntry, DreamHistoryField, DreamPriority } from "../types/models";
import { View } from "../types/nav";
import { Breadcrumb } from "../components/Breadcrumb";
import { DreamDateRangeField } from "../components/DreamDateRangeField";
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

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchDream(dreamId), fetchDreamHistory(dreamId), fetchLinkedDreams(dreamId)]).then(
      ([d, h, l]) => {
        setDream(d);
        setReasoningDraft(d?.reasoning ?? "");
        setNotesDraft(d?.notes ?? "");
        setHistory(h);
        setLinked(l);
        setLoading(false);
      }
    );
  }, [dreamId]);

  const refreshHistory = () => fetchDreamHistory(dreamId).then(setHistory);

  const openChange = (change: PendingChange) => {
    setReasonDraft("");
    setPendingChange(change);
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
    openChange({
      label: "Name",
      oldDisplay: dream.name,
      newDisplay: trimmed,
      apply: async (reason) => {
        await updateDreamField(dream.id, "name", trimmed, reason);
        setDream((prev) => (prev ? { ...prev, name: trimmed } : prev));
      },
      revert: () => setNameDraft(dream.name),
    });
  };

  const commitReasoning = () => {
    if (!dream || reasoningDraft === dream.reasoning) return;
    openChange({
      label: "Reasoning",
      oldDisplay: dream.reasoning || "—",
      newDisplay: reasoningDraft || "—",
      apply: async (reason) => {
        await updateDreamField(dream.id, "reasoning", reasoningDraft, reason);
        setDream((prev) => (prev ? { ...prev, reasoning: reasoningDraft } : prev));
      },
      revert: () => setReasoningDraft(dream.reasoning),
    });
  };

  const commitNotes = () => {
    if (!dream || notesDraft === dream.notes) return;
    openChange({
      label: "Other words",
      oldDisplay: dream.notes || "—",
      newDisplay: notesDraft || "—",
      apply: async (reason) => {
        await updateDreamField(dream.id, "notes", notesDraft, reason);
        setDream((prev) => (prev ? { ...prev, notes: notesDraft } : prev));
      },
      revert: () => setNotesDraft(dream.notes),
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
      </div>

      <div className="dream-field-grid">
        <label className="dream-field">
          <span className="dream-field-label">Expected date</span>
          <DreamDateRangeField
            start={dream.expectedDateStart}
            end={dream.expectedDateEnd}
            resetToken={dateResetToken}
            onSave={commitDate}
          />
        </label>

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
      </div>

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
                      <input
                        type="date"
                        value={historyDateTo}
                        onChange={(e) => setHistoryDateTo(e.target.value)}
                      />
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
