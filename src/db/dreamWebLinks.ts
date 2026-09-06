// src/db/dreamWebLinks.ts
import { getDb } from "./database";

// A link a user draws directly between two nodes on Dream Web — plain
// text ids, same "reuse the node id scheme" convention as
// goalWebLinks.ts. Currently the only nodes without their own dedicated
// link system are skill nodes ("sk-<linkId>") — dreams already have
// dreamLinks and goal attachments already have goal_dream_links — so in
// practice one end is always a skill, but nothing here enforces that.
export interface DreamWebLink {
  id: number;
  sourceNodeId: string;
  targetNodeId: string;
  sourceAngle: number | null;
  targetAngle: number | null;
}

const COLUMNS = `id, source_node_id as sourceNodeId, target_node_id as targetNodeId, source_angle as sourceAngle, target_angle as targetAngle`;

export async function fetchDreamWebLinks(): Promise<DreamWebLink[]> {
  const db = await getDb();
  return db.select<DreamWebLink[]>(`SELECT ${COLUMNS} FROM dream_web_links`);
}

export async function addDreamWebLink(
  sourceNodeId: string,
  targetNodeId: string,
  sourceAngle: number | null,
  targetAngle: number | null
): Promise<number> {
  const db = await getDb();
  const result = await db.execute(
    "INSERT INTO dream_web_links (source_node_id, target_node_id, source_angle, target_angle) VALUES ($1, $2, $3, $4)",
    [sourceNodeId, targetNodeId, sourceAngle, targetAngle]
  );
  return result.lastInsertId as number;
}

export async function removeDreamWebLink(id: number): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM dream_web_links WHERE id = $1", [id]);
}
