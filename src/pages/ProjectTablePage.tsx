import { useEffect, useRef, useState } from "react";
import { View } from "../types/nav";
import { ProjectTableData } from "../types/project";
import { fetchTable, saveTable } from "../db/tables";
import { useSaveFeedback } from "../hooks/useSaveFeedback";
import { SaveStatusIndicator } from "../components/SaveStatusIndicator";
import "./Page.css";
import "./ProjectTablePage.css";

const DEFAULT_COLUMN_WIDTH = 160;
const MIN_COLUMN_WIDTH = 60;

// A plain grid widget — no formulas, no cell types, just flexible rows
// and columns of text. Edits autosave (debounced via blur, same
// convention as every other text field in this app) rather than
// needing an explicit save action.
export function ProjectTablePage({
  widgetId,
  projectId,
  goalId,
  onNavigate,
}: {
  widgetId: number;
  projectId?: number;
  goalId?: number;
  onNavigate: (view: View) => void;
}) {
  const [data, setData] = useState<ProjectTableData | null>(null);
  const [loading, setLoading] = useState(true);
  const { status, run } = useSaveFeedback();
  const resizeRef = useRef<{ col: number; startX: number; startWidth: number } | null>(null);
  // The resize mousemove/mouseup handlers below are attached to
  // `window` once at drag-start and live for the whole drag — without
  // this ref they'd keep closing over whatever `data` was at that one
  // render, so mouseup's final save would write the pre-drag width
  // instead of wherever the column actually ended up.
  const dataRef = useRef(data);
  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  useEffect(() => {
    setLoading(true);
    fetchTable(widgetId).then((d) => {
      setData(d);
      setLoading(false);
    });
  }, [widgetId]);

  const persist = (next: ProjectTableData) => {
    setData(next);
    run(() => saveTable(widgetId, next));
  };

  const setCell = (row: number, col: number, value: string) => {
    if (!data) return;
    const rows = data.rows.map((r, i) => (i === row ? r.map((c, j) => (j === col ? value : c)) : r));
    persist({ ...data, rows });
  };

  const setColumnLabel = (col: number, value: string) => {
    if (!data) return;
    const columns = data.columns.map((c, i) => (i === col ? value : c));
    persist({ ...data, columns });
  };

  const addColumn = () => {
    if (!data) return;
    persist({
      columns: [...data.columns, `Column ${data.columns.length + 1}`],
      rows: data.rows.map((r) => [...r, ""]),
      columnWidths: data.columnWidths ? [...data.columnWidths, DEFAULT_COLUMN_WIDTH] : undefined,
    });
  };

  const removeColumn = (col: number) => {
    if (!data || data.columns.length <= 1) return;
    persist({
      columns: data.columns.filter((_, i) => i !== col),
      rows: data.rows.map((r) => r.filter((_, i) => i !== col)),
      columnWidths: data.columnWidths?.filter((_, i) => i !== col),
    });
  };

  const widthFor = (col: number) => data?.columnWidths?.[col] ?? DEFAULT_COLUMN_WIDTH;

  const startResize = (col: number, e: React.MouseEvent) => {
    e.preventDefault();
    resizeRef.current = { col, startX: e.clientX, startWidth: widthFor(col) };
    window.addEventListener("mousemove", handleResizeMove);
    window.addEventListener("mouseup", handleResizeUp);
  };

  const handleResizeMove = (e: MouseEvent) => {
    const r = resizeRef.current;
    const current = dataRef.current;
    if (!r || !current) return;
    const newWidth = Math.max(MIN_COLUMN_WIDTH, r.startWidth + (e.clientX - r.startX));
    const widths = current.columns.map((_, i) => current.columnWidths?.[i] ?? DEFAULT_COLUMN_WIDTH);
    widths[r.col] = newWidth;
    setData({ ...current, columnWidths: widths });
  };

  const handleResizeUp = () => {
    window.removeEventListener("mousemove", handleResizeMove);
    window.removeEventListener("mouseup", handleResizeUp);
    resizeRef.current = null;
    if (dataRef.current) run(() => saveTable(widgetId, dataRef.current!));
  };

  const addRow = () => {
    if (!data) return;
    persist({ ...data, rows: [...data.rows, data.columns.map(() => "")] });
  };

  const removeRow = (row: number) => {
    if (!data || data.rows.length <= 1) return;
    persist({ ...data, rows: data.rows.filter((_, i) => i !== row) });
  };

  if (loading || !data) {
    return (
      <div className="page">
        <p className="page-text">Loading…</p>
      </div>
    );
  }

  return (
    <div className="page project-table-page">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1 className="page-title">Table</h1>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <SaveStatusIndicator status={status === "saving" ? "idle" : status} />
          <button
            className="add-button secondary"
            onClick={() =>
              onNavigate(
                projectId !== undefined
                  ? { type: "project-detail", projectId }
                  : { type: "goal-detail", goalId: goalId! }
              )
            }
          >
            ← Back to {projectId !== undefined ? "Project" : "Goal"}
          </button>
        </div>
      </div>

      <div className="project-table-scroll">
        <table className="project-table-grid">
          <thead>
            <tr>
              <th className="project-table-row-handle" />
              {data.columns.map((col, c) => (
                <th key={c} style={{ width: widthFor(c), position: "relative" }}>
                  <div className="project-table-col-header">
                    <input
                      className="project-table-col-input"
                      value={col}
                      onChange={(e) => setColumnLabel(c, e.target.value)}
                    />
                    <button
                      className="project-table-remove-btn"
                      onClick={() => removeColumn(c)}
                      disabled={data.columns.length <= 1}
                      title="Remove column"
                    >
                      ✕
                    </button>
                  </div>
                  <div
                    className="project-table-col-resize-handle"
                    onMouseDown={(e) => startResize(c, e)}
                    title="Drag to resize"
                  />
                </th>
              ))}
              <th className="project-table-add-col-cell">
                <button className="icon-button" onClick={addColumn} title="Add column">
                  +
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row, r) => (
              <tr key={r}>
                <td className="project-table-row-handle">
                  <button
                    className="project-table-remove-btn"
                    onClick={() => removeRow(r)}
                    disabled={data.rows.length <= 1}
                    title="Remove row"
                  >
                    ✕
                  </button>
                </td>
                {row.map((cell, c) => (
                  <td key={c}>
                    <input
                      className="project-table-cell-input"
                      value={cell}
                      onChange={(e) => setCell(r, c, e.target.value)}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <button className="add-button secondary" style={{ marginTop: 8 }} onClick={addRow}>
          + Row
        </button>
      </div>
    </div>
  );
}
