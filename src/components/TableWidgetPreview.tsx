import { useEffect, useState } from "react";
import { ProjectTableData } from "../types/project";
import { fetchTable } from "../db/tables";
import "./TableWidgetPreview.css";

const PREVIEW_COLS = 3;
const PREVIEW_ROWS = 3;

// A live miniature of the table's actual content instead of a generic
// icon+title nav card — same "viewed instantly" spirit as Image Dock/
// Quick Photo. Still just a button that navigates to the full table
// page on click (see ProjectDetailPage.tsx/GoalDetailPage.tsx), not an
// editing surface itself.
export function TableWidgetPreview({ widgetId, onOpen }: { widgetId: number; onOpen: () => void }) {
  const [data, setData] = useState<ProjectTableData | null>(null);

  useEffect(() => {
    fetchTable(widgetId).then(setData);
  }, [widgetId]);

  if (!data) return null;

  const cols = data.columns.slice(0, PREVIEW_COLS);
  const rows = data.rows.slice(0, PREVIEW_ROWS);
  const hasMoreCols = data.columns.length > PREVIEW_COLS;
  const hasMoreRows = data.rows.length > PREVIEW_ROWS;

  return (
    <button className="table-widget-preview" onClick={onOpen} title="Open table">
      <span className="table-widget-preview-title">📊 Table</span>
      <table className="table-widget-preview-grid">
        <thead>
          <tr>
            {cols.map((c, i) => (
              <th key={i}>{c || "—"}</th>
            ))}
            {hasMoreCols && <th className="table-widget-preview-ellipsis">…</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, r) => (
            <tr key={r}>
              {row.slice(0, PREVIEW_COLS).map((cell, c) => (
                <td key={c}>{cell}</td>
              ))}
              {hasMoreCols && <td className="table-widget-preview-ellipsis">…</td>}
            </tr>
          ))}
          {hasMoreRows && (
            <tr>
              {cols.map((_, i) => (
                <td key={i} className="table-widget-preview-ellipsis">
                  …
                </td>
              ))}
              {hasMoreCols && <td className="table-widget-preview-ellipsis">…</td>}
            </tr>
          )}
        </tbody>
      </table>
    </button>
  );
}
