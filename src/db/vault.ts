import { getDb } from "./database";
import { VaultMeta, VaultPage, VaultPageRow } from "../types/vault";
import { encryptString, decryptString, EncryptedBlob } from "../vault/crypto";

const ROW_COLUMNS = `
  id, parent_id as parentId, icon, sort_order as sortOrder,
  title_iv as titleIv, title_ciphertext as titleCiphertext,
  content_iv as contentIv, content_ciphertext as contentCiphertext,
  created_at as createdAt, updated_at as updatedAt
`;

export async function fetchVaultMeta(): Promise<VaultMeta | null> {
  const db = await getDb();
  const rows = await db.select<VaultMeta[]>(
    "SELECT salt, canary_iv as canaryIv, canary_ciphertext as canaryCiphertext, created_at as createdAt FROM vault_meta WHERE id = 1"
  );
  return rows[0] ?? null;
}

// Vault setup — called once, the first time a key is chosen. `canary` is
// the derived key's encryption of a known marker string (see
// vault/crypto.ts's makeCanary), stored so future unlock attempts can
// verify a typed key without ever storing the key itself.
export async function initializeVault(salt: string, canary: EncryptedBlob): Promise<void> {
  const db = await getDb();
  await db.execute(
    "INSERT INTO vault_meta (id, salt, canary_iv, canary_ciphertext) VALUES (1, $1, $2, $3)",
    [salt, canary.iv, canary.ciphertext]
  );
}

async function decryptRow(key: CryptoKey, row: VaultPageRow): Promise<VaultPage> {
  const [title, content] = await Promise.all([
    decryptString(key, { iv: row.titleIv, ciphertext: row.titleCiphertext }),
    decryptString(key, { iv: row.contentIv, ciphertext: row.contentCiphertext }),
  ]);
  return {
    id: row.id,
    parentId: row.parentId,
    icon: row.icon,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    title,
    content,
  };
}

export async function fetchAllVaultPages(key: CryptoKey): Promise<VaultPage[]> {
  const db = await getDb();
  const rows = await db.select<VaultPageRow[]>(`SELECT ${ROW_COLUMNS} FROM vault_pages ORDER BY sort_order`);
  return Promise.all(rows.map((row) => decryptRow(key, row)));
}

export async function addVaultPage(key: CryptoKey, parentId: number | null, title = "Untitled"): Promise<number> {
  const db = await getDb();
  const existing = await db.select<{ maxOrder: number | null }[]>(
    "SELECT MAX(sort_order) as maxOrder FROM vault_pages WHERE parent_id IS $1",
    [parentId]
  );
  const nextOrder = (existing[0].maxOrder ?? -1) + 1;
  const [titleBlob, contentBlob] = await Promise.all([
    encryptString(key, title),
    encryptString(key, "<p></p>"),
  ]);
  const result = await db.execute(
    `INSERT INTO vault_pages
       (parent_id, sort_order, title_iv, title_ciphertext, content_iv, content_ciphertext, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    [parentId, nextOrder, titleBlob.iv, titleBlob.ciphertext, contentBlob.iv, contentBlob.ciphertext]
  );
  return result.lastInsertId as number;
}

export async function updateVaultPageTitle(key: CryptoKey, id: number, title: string): Promise<void> {
  const db = await getDb();
  const blob = await encryptString(key, title);
  await db.execute(
    "UPDATE vault_pages SET title_iv = $1, title_ciphertext = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3",
    [blob.iv, blob.ciphertext, id]
  );
}

export async function updateVaultPageContent(key: CryptoKey, id: number, content: string): Promise<void> {
  const db = await getDb();
  const blob = await encryptString(key, content);
  await db.execute(
    "UPDATE vault_pages SET content_iv = $1, content_ciphertext = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3",
    [blob.iv, blob.ciphertext, id]
  );
}

export async function updateVaultPageIcon(id: number, icon: string): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE vault_pages SET icon = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2", [icon, id]);
}

export async function updateVaultPageParent(id: number, parentId: number | null): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE vault_pages SET parent_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2", [
    parentId,
    id,
  ]);
}

export async function reorderVaultPages(orderedIds: number[]): Promise<void> {
  const db = await getDb();
  for (let i = 0; i < orderedIds.length; i++) {
    await db.execute("UPDATE vault_pages SET sort_order = $1 WHERE id = $2", [i, orderedIds[i]]);
  }
}

export async function deleteVaultPage(id: number): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM vault_pages WHERE id = $1", [id]);
}
