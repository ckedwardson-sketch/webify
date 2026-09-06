// Vault encryption core. The 20-character key you type is never stored
// anywhere, in any form — only a random, non-secret salt is. Unlocking
// runs your typed key through PBKDF2 to derive an AES-256-GCM key, then
// tries to decrypt the stored canary value with it. GCM's authentication
// tag makes that decryption fail (throw) if the key is wrong, so there's
// no separate "compare this hash to that hash" password-check step —
// wrong-key detection falls straight out of the encryption scheme itself.
const PBKDF2_ITERATIONS = 600_000;
const CANARY_PLAINTEXT = "webify-vault-canary";

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function fromBase64(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function generateSaltB64(): string {
  const salt = new Uint8Array(16);
  crypto.getRandomValues(salt);
  return toBase64(salt);
}

export async function deriveVaultKey(keyString: string, saltB64: string): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(keyString),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: fromBase64(saltB64), iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

export interface EncryptedBlob {
  iv: string; // base64
  ciphertext: string; // base64
}

export async function encryptString(key: CryptoKey, plaintext: string): Promise<EncryptedBlob> {
  const iv = new Uint8Array(12);
  crypto.getRandomValues(iv);
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(plaintext)
  );
  return { iv: toBase64(iv), ciphertext: toBase64(new Uint8Array(ciphertext)) };
}

// Throws (SubtleCrypto's OperationError) if `key` is wrong or the blob
// was tampered with — that failure IS the "wrong key" signal.
export async function decryptString(key: CryptoKey, blob: EncryptedBlob): Promise<string> {
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromBase64(blob.iv) },
    key,
    fromBase64(blob.ciphertext)
  );
  return new TextDecoder().decode(plaintext);
}

export async function makeCanary(key: CryptoKey): Promise<EncryptedBlob> {
  return encryptString(key, CANARY_PLAINTEXT);
}

// Returns true only if `key` decrypts the canary back to the expected
// marker — false (not a throw) for any wrong-key failure, so callers can
// show "incorrect key" instead of a raw crypto error.
export async function verifyCanary(key: CryptoKey, canary: EncryptedBlob): Promise<boolean> {
  try {
    return (await decryptString(key, canary)) === CANARY_PLAINTEXT;
  } catch {
    return false;
  }
}
