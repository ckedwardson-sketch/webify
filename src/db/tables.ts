import { getDb } from "./database";
import { ProjectTableData } from "../types/project";

const DEFAULT_TABLE: ProjectTableData = {
  columns: ["Column 1", "Column 2"],
  rows: [
    ["", ""],
    ["", ""],
  ],
};

export async function fetchTable(widgetId: number): Promise<ProjectTableData> {
  const db = await getDb();
  const rows = await db.select<{ dataJson: string }[]>(
    "SELECT data_json as dataJson FROM project_tables WHERE widget_id = $1",
    [widgetId]
  );
  if (rows.length === 0) return DEFAULT_TABLE;
  try {
    const parsed = JSON.parse(rows[0].dataJson) as Partial<ProjectTableData>;
    return {
      columns: parsed.columns ?? DEFAULT_TABLE.columns,
      rows: parsed.rows ?? DEFAULT_TABLE.rows,
      columnWidths: parsed.columnWidths,
    };
  } catch {
    return DEFAULT_TABLE;
  }
}

export async function saveTable(widgetId: number, data: ProjectTableData): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT INTO project_tables (widget_id, data_json) VALUES ($1, $2)
     ON CONFLICT(widget_id) DO UPDATE SET data_json = excluded.data_json`,
    [widgetId, JSON.stringify(data)]
  );
}
