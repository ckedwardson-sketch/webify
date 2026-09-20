import { useEffect, useState } from "react";
import { CostGrouping } from "../types/project";
import {
  fetchAllCostLogWidgets,
  fetchCostGroupings,
  createCostGrouping,
  renameCostGrouping,
  deleteCostGrouping,
  fetchMasterCostLogSourceDetails,
  addMasterCostLogSource,
  removeMasterCostLogSource,
  setMasterCostLogSourceGrouping,
  CostLogWidgetOption,
  MasterCostLogSourceDetail,
} from "../db/costLog";
import "./MasterCostLogWidget.css";

function formatCurrency(amount: number): string {
  const sign = amount < 0 ? "-" : "";
  return `${sign}$${Math.abs(amount).toFixed(2)}`;
}

export function MasterCostLogWidget({ widgetId }: { widgetId: number }) {
  const [groupings, setGroupings] = useState<CostGrouping[]>([]);
  const [sources, setSources] = useState<MasterCostLogSourceDetail[]>([]);
  const [showPicker, setShowPicker] = useState(false);
  const [available, setAvailable] = useState<CostLogWidgetOption[]>([]);
  const [newGroupingName, setNewGroupingName] = useState("");

  const load = () => {
    fetchCostGroupings(widgetId).then(setGroupings);
    fetchMasterCostLogSourceDetails(widgetId).then(setSources);
  };

  useEffect(load, [widgetId]);

  const openPicker = () => {
    fetchAllCostLogWidgets(widgetId).then((all) => {
      const includedIds = new Set(sources.map((s) => s.costLogWidgetId));
      setAvailable(all.filter((w) => !includedIds.has(w.id)));
      setShowPicker(true);
    });
  };

  const handleAddSource = async (costLogWidgetId: number) => {
    await addMasterCostLogSource(widgetId, costLogWidgetId, null);
    setAvailable((prev) => prev.filter((w) => w.id !== costLogWidgetId));
    load();
  };

  const handleRemoveSource = async (id: number) => {
    await removeMasterCostLogSource(id);
    load();
  };

  const handleCreateGrouping = async () => {
    const name = newGroupingName.trim();
    if (!name) return;
    await createCostGrouping(widgetId, name);
    setNewGroupingName("");
    load();
  };

  const handleRenameGrouping = async (id: number, name: string) => {
    await renameCostGrouping(id, name);
    load();
  };

  const handleDeleteGrouping = async (id: number) => {
    if (!confirm("Delete this grouping? Its cost logs stay in the master total, just ungrouped.")) return;
    await deleteCostGrouping(id);
    load();
  };

  const overallTotal = sources.reduce((sum, s) => sum + s.total, 0);
  const ungrouped = sources.filter((s) => s.groupingId === null);

  return (
    <div className="master-cost-log-widget">
      <div className="cost-log-total">{formatCurrency(overallTotal)}</div>

      {groupings.map((g) => {
        const members = sources.filter((s) => s.groupingId === g.id);
        const subtotal = members.reduce((sum, s) => sum + s.total, 0);
        return (
          <div key={g.id} className="master-cost-log-grouping">
            <div className="master-cost-log-grouping-header">
              <input
                className="master-cost-log-grouping-name"
                value={g.name}
                onChange={(e) => setGroupings((prev) => prev.map((x) => (x.id === g.id ? { ...x, name: e.target.value } : x)))}
                onBlur={(e) => handleRenameGrouping(g.id, e.target.value)}
              />
              <span className="master-cost-log-grouping-subtotal">{formatCurrency(subtotal)}</span>
              <button className="master-cost-log-grouping-delete" title="Delete grouping" onClick={() => handleDeleteGrouping(g.id)}>
                ✕
              </button>
            </div>
            {members.map((s) => (
              <div key={s.id} className="master-cost-log-source-row">
                <select
                  className="master-cost-log-source-grouping-select"
                  value={s.groupingId ?? ""}
                  onChange={(e) => {
                    setMasterCostLogSourceGrouping(s.id, e.target.value ? Number(e.target.value) : null).then(load);
                  }}
                >
                  <option value="">Ungrouped</option>
                  {groupings.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.name}
                    </option>
                  ))}
                </select>
                <span className="master-cost-log-source-label">
                  {s.ownerLabel} — {s.title || "Cost Log"}
                </span>
                <span className="master-cost-log-source-total">{formatCurrency(s.total)}</span>
                <button className="master-cost-log-source-remove" title="Remove from master" onClick={() => handleRemoveSource(s.id)}>
                  ✕
                </button>
              </div>
            ))}
          </div>
        );
      })}

      {ungrouped.length > 0 && (
        <div className="master-cost-log-grouping master-cost-log-ungrouped">
          <div className="master-cost-log-grouping-header">
            <span className="master-cost-log-grouping-name master-cost-log-grouping-name-static">Ungrouped</span>
            <span className="master-cost-log-grouping-subtotal">
              {formatCurrency(ungrouped.reduce((sum, s) => sum + s.total, 0))}
            </span>
          </div>
          {ungrouped.map((s) => (
            <div key={s.id} className="master-cost-log-source-row">
              <select
                className="master-cost-log-source-grouping-select"
                value=""
                onChange={(e) => {
                  setMasterCostLogSourceGrouping(s.id, e.target.value ? Number(e.target.value) : null).then(load);
                }}
              >
                <option value="">Ungrouped</option>
                {groupings.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.name}
                  </option>
                ))}
              </select>
              <span className="master-cost-log-source-label">
                {s.ownerLabel} — {s.title || "Cost Log"}
              </span>
              <span className="master-cost-log-source-total">{formatCurrency(s.total)}</span>
              <button className="master-cost-log-source-remove" title="Remove from master" onClick={() => handleRemoveSource(s.id)}>
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {sources.length === 0 && <div className="cost-log-empty">No cost logs added yet.</div>}

      <div className="master-cost-log-actions">
        <input
          className="master-cost-log-new-grouping-input"
          placeholder="New grouping name"
          value={newGroupingName}
          onChange={(e) => setNewGroupingName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleCreateGrouping()}
        />
        <button className="add-button secondary" onClick={handleCreateGrouping} disabled={!newGroupingName.trim()}>
          + Grouping
        </button>
      </div>

      {showPicker ? (
        <div className="master-cost-log-picker">
          <div className="master-cost-log-picker-header">
            <span>Add a Cost Log</span>
            <button className="master-cost-log-picker-close" onClick={() => setShowPicker(false)}>
              ✕
            </button>
          </div>
          {available.length === 0 ? (
            <div className="cost-log-empty">No other Cost Log widgets to add.</div>
          ) : (
            available.map((w) => (
              <button key={w.id} className="master-cost-log-picker-item" onClick={() => handleAddSource(w.id)}>
                {w.ownerLabel} — {w.title || "Cost Log"}
              </button>
            ))
          )}
        </div>
      ) : (
        <button className="cost-log-add-button" onClick={openPicker}>
          + Add Cost Log
        </button>
      )}
    </div>
  );
}
