// Vault pages — structurally the same tree-of-pages shape as NotePage
// (see types/notes.ts), but title/content are only ever decrypted
// client-side, in memory, while the vault is unlocked. See
// vault/crypto.ts and db/vault.ts.
export interface VaultPage {
  id: number;
  parentId: number | null;
  icon: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  title: string; // decrypted
  content: string; // decrypted, Tiptap HTML
}

// Row shape as stored in vault_pages — everything sensitive is a
// {iv, ciphertext} pair (see vault/crypto.ts's EncryptedBlob) stored as
// two plain TEXT columns rather than JSON, so SQL never needs to parse it.
export interface VaultPageRow {
  id: number;
  parentId: number | null;
  icon: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  titleIv: string;
  titleCiphertext: string;
  contentIv: string;
  contentCiphertext: string;
}

export interface VaultMeta {
  salt: string;
  canaryIv: string;
  canaryCiphertext: string;
  createdAt: string;
}
