import { getDb } from "./database";

export interface IssueReport {
  id: number;
  note: string;
  screenshotData: string;
  createdAt: string;
}

export async function fetchIssues(): Promise<IssueReport[]> {
  const db = await getDb();
  return db.select<IssueReport[]>(
    "SELECT id, note, screenshot_data as screenshotData, created_at as createdAt FROM issue_reports ORDER BY created_at DESC"
  );
}

export async function addIssue(note: string, screenshotData: string): Promise<void> {
  const db = await getDb();
  await db.execute(
    "INSERT INTO issue_reports (note, screenshot_data) VALUES ($1, $2)",
    [note, screenshotData]
  );
}

export async function deleteIssue(id: number): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM issue_reports WHERE id = $1", [id]);
}
