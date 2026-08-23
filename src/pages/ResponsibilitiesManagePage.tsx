import { useEffect, useState } from "react";
import { View } from "../types/nav";
import { Responsibility, ResponsibilityCategory } from "../types/responsibility";
import { fetchResponsibilities, addResponsibility } from "../db/responsibilities";
import "./Page.css";
import "./Responsibilities.css";

export function ResponsibilitiesManagePage({ onNavigate }: { onNavigate: (view: View) => void }) {
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
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h1 className="page-title">Manage Responsibilities</h1>
        <button
          className="add-button secondary"
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
        const items = responsibilities.filter((r) => r.category === category);
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
            ) : (
              <ul className="list">
                {items.map((r) => (
                  <li key={r.id}>
                    <button
                      className="list-item"
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
