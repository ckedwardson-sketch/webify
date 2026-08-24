import React, { useEffect, useState } from "react";
import { View } from "../types/nav";
import { ProjectJournalEntry } from "../types/project";
import {
  fetchJournalEntries,
  addJournalEntry,
  updateJournalEntry,
  deleteJournalEntry,
} from "../db/projects";
import "./Page.css";
import "./ProjectJournalPage.css";

function formatTimestamp(iso: string): string {
  // SQLite's CURRENT_TIMESTAMP is UTC with no offset marker — append Z
  // so the browser parses it as UTC instead of assuming local time.
  const d = new Date(iso.replace(" ", "T") + "Z");
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

export function ProjectJournalPage({
  widgetId,
  projectId,
  onNavigate,
}: {
  widgetId: number;
  projectId: number;
  onNavigate: (view: View) => void;
}) {
  const [entries, setEntries] = useState<ProjectJournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [editMode, setEditMode] = useState(false);
  const [editDrafts, setEditDrafts] = useState<Record<number, string>>({});

  const load = async () => {
    setEntries(await fetchJournalEntries(widgetId));
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [widgetId]);

  const handleAddEntry = async () => {
    const text = draft.trim();
    if (!text) return;
    await addJournalEntry(widgetId, text);
    setDraft("");
    await load();
  };

  const handleEnableEditMode = () => {
    if (
      !confirm(
        "Editing past journal entries isn't normally allowed, since it changes your history. Enable Edit Mode anyway?"
      )
    ) {
      return;
    }
    setEditDrafts(Object.fromEntries(entries.map((e) => [e.id, e.content])));
    setEditMode(true);
  };

  const handleExitEditMode = async () => {
    for (const entry of entries) {
      const newContent = editDrafts[entry.id];
      if (newContent !== undefined && newContent !== entry.content) {
        await updateJournalEntry(entry.id, newContent);
      }
    }
    setEditMode(false);
    await load();
  };

  const handleDeleteEntry = async (id: number) => {
    if (!confirm("Delete this journal entry permanently?")) return;
    await deleteJournalEntry(id);
    await load();
  };

  if (loading) {
    return (
      <div className="page">
        <p className="page-text">Loading…</p>
      </div>
    );
  }

  return (
    <div className="page project-journal-page">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1 className="page-title">Journal</h1>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            className="add-button secondary"
            onClick={() => onNavigate({ type: "project-detail", projectId })}
          >
            ← Back to Project
          </button>
          {editMode ? (
            <button className="add-button" onClick={handleExitEditMode}>
              Done Editing
            </button>
          ) : (
            <button className="add-button secondary" onClick={handleEnableEditMode}>
              Edit Journal Mode
            </button>
          )}
        </div>
      </div>

      {!editMode && (
        <div className="journal-add-row">
          <textarea
            className="instructions-textarea"
            rows={3}
            placeholder="Write a new entry…"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
          <button className="add-button" onClick={handleAddEntry} disabled={!draft.trim()}>
            Add Entry
          </button>
        </div>
      )}

      <div className="journal-entries">
        {entries.length === 0 && <p className="page-text">No entries yet.</p>}
        {entries.map((entry) => (
          <div key={entry.id} className="journal-entry">
            {editMode ? (
              <>
                <textarea
                  className="instructions-textarea"
                  rows={2}
                  value={editDrafts[entry.id] ?? entry.content}
                  onChange={(e) =>
                    setEditDrafts((prev) => ({ ...prev, [entry.id]: e.target.value }))
                  }
                />
                <button className="add-button danger" onClick={() => handleDeleteEntry(entry.id)}>
                  Delete
                </button>
              </>
            ) : (
              <>
                <div className="journal-entry-timestamp">{formatTimestamp(entry.createdAt)}</div>
                <div className="journal-entry-content">{entry.content}</div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
