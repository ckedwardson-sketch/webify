import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { deriveVaultKey, generateSaltB64, makeCanary, verifyCanary } from "./crypto";
import { fetchVaultMeta, initializeVault } from "../db/vault";

// The derived AES key lives only here, in memory, for the life of this
// React tree — never written to disk, localStorage, or anywhere else.
// It's forgotten (state reset to null) after IDLE_TIMEOUT_MS of no vault
// activity, or whenever the app process ends (nothing to do there — an
// in-memory value just stops existing).
const IDLE_TIMEOUT_MS = 10 * 60 * 1000;

interface VaultSessionValue {
  isSetUp: boolean | null; // null until the one-time DB check resolves
  isUnlocked: boolean;
  cryptoKey: CryptoKey | null;
  error: string | null;
  setupVault: (keyString: string) => Promise<void>;
  unlockVault: (keyString: string) => Promise<boolean>;
  lockVault: () => void;
  noteActivity: () => void;
}

const VaultSessionContext = createContext<VaultSessionValue | null>(null);

export function VaultSessionProvider({ children }: { children: React.ReactNode }) {
  const [isSetUp, setIsSetUp] = useState<boolean | null>(null);
  const [cryptoKey, setCryptoKey] = useState<CryptoKey | null>(null);
  const [error, setError] = useState<string | null>(null);
  const idleTimer = useRef<number | null>(null);

  useEffect(() => {
    fetchVaultMeta()
      .then((meta) => setIsSetUp(meta !== null))
      .catch((err) => {
        console.error("Failed to check vault setup state:", err);
        setIsSetUp(false);
      });
  }, []);

  const lockVault = useCallback(() => {
    if (idleTimer.current !== null) {
      window.clearTimeout(idleTimer.current);
      idleTimer.current = null;
    }
    setCryptoKey(null);
  }, []);

  // Called on any vault interaction to push the auto-lock deadline back
  // out — see IDLE_TIMEOUT_MS above.
  const noteActivity = useCallback(() => {
    if (idleTimer.current !== null) window.clearTimeout(idleTimer.current);
    idleTimer.current = window.setTimeout(lockVault, IDLE_TIMEOUT_MS);
  }, [lockVault]);

  const setupVault = useCallback(async (keyString: string) => {
    setError(null);
    const salt = generateSaltB64();
    const key = await deriveVaultKey(keyString, salt);
    const canary = await makeCanary(key);
    await initializeVault(salt, canary);
    setIsSetUp(true);
    setCryptoKey(key);
    noteActivity();
  }, [noteActivity]);

  const unlockVault = useCallback(async (keyString: string): Promise<boolean> => {
    setError(null);
    const meta = await fetchVaultMeta();
    if (!meta) {
      setError("Vault isn't set up yet.");
      return false;
    }
    const key = await deriveVaultKey(keyString, meta.salt);
    const ok = await verifyCanary(key, { iv: meta.canaryIv, ciphertext: meta.canaryCiphertext });
    if (!ok) {
      setError("Incorrect key.");
      return false;
    }
    setCryptoKey(key);
    noteActivity();
    return true;
  }, [noteActivity]);

  useEffect(() => () => {
    if (idleTimer.current !== null) window.clearTimeout(idleTimer.current);
  }, []);

  return (
    <VaultSessionContext.Provider
      value={{
        isSetUp,
        isUnlocked: cryptoKey !== null,
        cryptoKey,
        error,
        setupVault,
        unlockVault,
        lockVault,
        noteActivity,
      }}
    >
      {children}
    </VaultSessionContext.Provider>
  );
}

export function useVaultSession(): VaultSessionValue {
  const ctx = useContext(VaultSessionContext);
  if (!ctx) throw new Error("useVaultSession must be used within a VaultSessionProvider");
  return ctx;
}
