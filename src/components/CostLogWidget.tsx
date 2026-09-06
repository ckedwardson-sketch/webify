import { useEffect, useState } from "react";
import { CostEntry } from "../types/project";
import { fetchCostEntries, addCostEntry, deleteCostEntry } from "../db/costLog";
import "./CostLogWidget.css";

function formatCurrency(amount: number): string {
  const sign = amount < 0 ? "-" : "";
  return `${sign}$${Math.abs(amount).toFixed(2)}`;
}

function formatCostDate(iso: string): string {
  const d = new Date(iso.replace(" ", "T") + "Z");
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function CostLogWidget({ widgetId }: { widgetId: number }) {
  const [entries, setEntries] = useState<CostEntry[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [amountDraft, setAmountDraft] = useState("");
  const [descriptionDraft, setDescriptionDraft] = useState("");

  const load = () => {
    fetchCostEntries(widgetId).then(setEntries);
  };

  useEffect(load, [widgetId]);

  const total = entries.reduce((sum, e) => sum + e.amount, 0);

  const handleSave = async () => {
    const amount = Number(amountDraft);
    if (!amountDraft || Number.isNaN(amount)) return;
    await addCostEntry(widgetId, amount, descriptionDraft.trim());
    setAmountDraft("");
    setDescriptionDraft("");
    setShowForm(false);
    load();
  };

  const handleCancel = () => {
    setAmountDraft("");
    setDescriptionDraft("");
    setShowForm(false);
  };

  const handleDelete = async (id: number) => {
    await deleteCostEntry(id);
    load();
  };

  return (
    <div className="cost-log-widget">
      <div className="cost-log-total">{formatCurrency(total)}</div>

      {showForm ? (
        <div className="cost-log-add-form">
          <input
            type="number"
            step="0.01"
            className="cost-log-amount-input"
            placeholder="Amount"
            autoFocus
            value={amountDraft}
            onChange={(e) => setAmountDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSave();
              if (e.key === "Escape") handleCancel();
            }}
          />
          <input
            type="text"
            className="cost-log-description-input"
            placeholder="Description (optional)"
            value={descriptionDraft}
            onChange={(e) => setDescriptionDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSave();
              if (e.key === "Escape") handleCancel();
            }}
          />
          <div className="cost-log-form-actions">
            <button className="add-button secondary" onClick={handleCancel}>
              Cancel
            </button>
            <button className="add-button" onClick={handleSave} disabled={!amountDraft}>
              Save
            </button>
          </div>
        </div>
      ) : (
        <button className="cost-log-add-button" onClick={() => setShowForm(true)}>
          + Add Cost
        </button>
      )}

      <div className="cost-log-entries">
        {entries.length === 0 ? (
          <div className="cost-log-empty">No costs logged yet.</div>
        ) : (
          entries.map((e) => (
            <div key={e.id} className="cost-log-entry">
              <div className="cost-log-entry-main">
                <span className="cost-log-entry-amount">{formatCurrency(e.amount)}</span>
                {e.description && <span className="cost-log-entry-description">{e.description}</span>}
              </div>
              <div className="cost-log-entry-side">
                <span className="cost-log-entry-date">{formatCostDate(e.createdAt)}</span>
                <button
                  className="cost-log-entry-delete"
                  onClick={() => handleDelete(e.id)}
                  title="Delete entry"
                >
                  ✕
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
