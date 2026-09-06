import { useEffect, useMemo, useState } from "react";
import { View } from "../types/nav";
import { Responsibility, ResponsibilityCategory } from "../types/responsibility";
import {
  fetchResponsibilities,
  addResponsibility,
  updateResponsibilityDetails,
  deleteResponsibility,
} from "../db/responsibilities";
import { PaneGrid } from "../components/PaneGrid";
import { useTheme } from "../theme/ThemeContext";
import "./Page.css";
import "./Responsibilities.css";

export function ResponsibilitiesManagePage({ onNavigate }: { onNavigate: (view: View) => void }) {
  const { theme } = useTheme();
  const [responsibilities, setResponsibilities] = useState<Responsibility[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingCategory, setAddingCategory] = useState<ResponsibilityCategory | null>(null);
  const [newName, setNewName] = useState("");

  const load = async () => {
    setResponsibilities(await fetchResponsibilities());
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  // Responsibility has no createdAt/updatedAt (see types/responsibility.ts) —
  // only sortOrder and name. "created"/"updated" therefore behave as
  // "manual" (no-op) rather than crashing on a missing field.
  const sortedResponsibilities = useMemo(() => {
    const order = theme.responsibilityHomeSortOrder;
    if (order === "name") {
      return [...responsibilities].sort((a, b) => a.name.localeCompare(b.name));
    }
    return responsibilities;
  }, [responsibilities, theme.responsibilityHomeSortOrder]);

  const confirmAdd = async (category: ResponsibilityCategory) => {
    const name = newName.trim();
    setAddingCategory(null);
    setNewName("");
    if (!name) return;
    const id = await addResponsibility(name, category);
    onNavigate({ type: "responsibility-detail", responsibilityId: id });
  };

  if (loading) {
    return (
      <div className="page">
        <p className="page-text">Loading…</p>
      </div>
    );
  }

  return (
    <div className="page resp-page">
      <div className="resp-home-header">
        <h1 className="page-title">Manage Responsibilities</h1>
        <button
          className="add-button secondary resp-manage-action"
          onClick={() => onNavigate({ type: "responsibilities-home" })}
        >
          ← Back to Tasks
        </button>
      </div>

      {(
        [
          ["daily", "Daily"],
          ["weekly", "Weekly / Bi-weekly"],
          ["yearly", "Yearly"],
        ] as [ResponsibilityCategory, string][]
      ).map(([category, title]) => {
        const items = sortedResponsibilities.filter((r) => r.category === category);
        return (
          <div key={category} className="resp-category-section">
            <div className="resp-category-header">
              <h2 className="resp-category-title">{title}</h2>
              <button className="icon-button" onClick={() => setAddingCategory(category)} title="Add">
                +
              </button>
            </div>

            {addingCategory === category && (
              <input
                className="inline-add-input"
                autoFocus
                placeholder="New responsibility name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") confirmAdd(category);
                  if (e.key === "Escape") {
                    setAddingCategory(null);
                    setNewName("");
                  }
                }}
                onBlur={() => {
                  setAddingCategory(null);
                  setNewName("");
                }}
              />
            )}

            {items.length === 0 ? (
              <p className="resp-empty">Nothing here yet.</p>
            ) : theme.responsibilityViewMode === "pane-small" ||
              theme.responsibilityViewMode === "pane-large" ||
              theme.responsibilityViewMode === "icon-grid" ? (
              <PaneGrid
                items={items.map((r) => ({ id: r.id, label: r.name, glyph: r.icon }))}
                size={theme.responsibilityViewMode === "pane-large" ? "large" : "small"}
                surface="responsibility"
                onOpen={(id) => onNavigate({ type: "responsibility-detail", responsibilityId: id })}
                onRename={(id, name) => updateResponsibilityDetails(id, { name }).then(load)}
                onDelete={(id) => deleteResponsibility(id).then(load)}
              />
            ) : (
              <ul className="list">
                {items.map((r) => (
                  <li key={r.id}>
                    <button
                      className="resp-list-item"
                      onClick={() => onNavigate({ type: "responsibility-detail", responsibilityId: r.id })}
                    >
                      <span className="resp-icon">{r.icon}</span> {r.name}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}
