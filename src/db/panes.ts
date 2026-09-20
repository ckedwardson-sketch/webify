// src/db/panes.ts
//
// CRUD for web_panes rows — see types/project.ts's Pane and
// components/PaneNode.tsx. Mirrors db/projects.ts's Web widget section
// (fetchWidgetsForWeb/addWebWidget/etc.) since panes are the same
// "web_type + web_owner_id" free-floating-on-a-canvas shape, just their
// own table instead of a project_widgets row.
import { getDb } from "./database";
import { Pane } from "../types/project";

interface RawPaneRow {
  id: number;
  web_type: string;
  web_owner_id: number;
  title: string;
  color: string;
  opacity: number;
  pos_x: number;
  pos_y: number;
  width: number;
  height: number;
  is_front: number;
  header_font_size: number;
  header_color: string | null;
  locked: number;
  created_at: string;
}

function mapPaneRow(row: RawPaneRow): Pane {
  return {
    id: row.id,
    webType: row.web_type as "goal" | "dream",
    webOwnerId: row.web_owner_id,
    title: row.title,
    color: row.color,
    opacity: row.opacity,
    posX: row.pos_x,
    posY: row.pos_y,
    width: row.width,
    height: row.height,
    isFront: !!row.is_front,
    headerFontSize: row.header_font_size,
    headerColor: row.header_color,
    locked: !!row.locked,
    createdAt: row.created_at,
  };
}

export async function fetchPanesForWeb(webType: "goal" | "dream", ownerId: number): Promise<Pane[]> {
  const db = await getDb();
  const rows = await db.select<RawPaneRow[]>(
    "SELECT * FROM web_panes WHERE web_type = $1 AND web_owner_id = $2 ORDER BY id",
    [webType, ownerId]
  );
  return rows.map(mapPaneRow);
}

// Batch variant for Dream Web, which renders every dream at once — same
// convention as fetchWidgetsForWebOwners.
export async function fetchPanesForWebOwners(webType: "goal" | "dream", ownerIds: number[]): Promise<Pane[]> {
  if (ownerIds.length === 0) return [];
  const db = await getDb();
  const placeholders = ownerIds.map((_, i) => `$${i + 2}`).join(", ");
  const rows = await db.select<RawPaneRow[]>(
    `SELECT * FROM web_panes WHERE web_type = $1 AND web_owner_id IN (${placeholders})`,
    [webType, ...ownerIds]
  );
  return rows.map(mapPaneRow);
}

export async function addPane(
  webType: "goal" | "dream",
  ownerId: number,
  x: number,
  y: number
): Promise<number> {
  const db = await getDb();
  const result = await db.execute(
    `INSERT INTO web_panes (web_type, web_owner_id, pos_x, pos_y) VALUES ($1, $2, $3, $4)`,
    [webType, ownerId, x, y]
  );
  return result.lastInsertId as number;
}

export async function updatePanePosition(id: number, x: number, y: number): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE web_panes SET pos_x = $1, pos_y = $2 WHERE id = $3", [x, y, id]);
}

export async function updatePaneSize(id: number, width: number, height: number): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE web_panes SET width = $1, height = $2 WHERE id = $3", [width, height, id]);
}

export async function updatePaneTitle(id: number, title: string): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE web_panes SET title = $1 WHERE id = $2", [title, id]);
}

export async function updatePaneColor(id: number, color: string): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE web_panes SET color = $1 WHERE id = $2", [color, id]);
}

export async function updatePaneOpacity(id: number, opacity: number): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE web_panes SET opacity = $1 WHERE id = $2", [opacity, id]);
}

export async function updatePaneFront(id: number, isFront: boolean): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE web_panes SET is_front = $1 WHERE id = $2", [isFront ? 1 : 0, id]);
}

export async function updatePaneHeaderFontSize(id: number, fontSize: number): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE web_panes SET header_font_size = $1 WHERE id = $2", [fontSize, id]);
}

export async function updatePaneHeaderColor(id: number, color: string | null): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE web_panes SET header_color = $1 WHERE id = $2", [color, id]);
}

export async function updatePaneLocked(id: number, locked: boolean): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE web_panes SET locked = $1 WHERE id = $2", [locked ? 1 : 0, id]);
}

export async function deletePane(id: number): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM web_panes WHERE id = $1", [id]);
}
