import React, { createContext, useContext, useEffect, useState } from "react";
import { fetchIconOverrides, setIconOverride, clearIconOverride } from "../db/icons";

interface IconContextValue {
  overrides: Record<string, string>;
  setOverride: (key: string, imageData: string) => Promise<void>;
  clearOverride: (key: string) => Promise<void>;
}

const IconContext = createContext<IconContextValue | null>(null);

export function IconProvider({ children }: { children: React.ReactNode }) {
  const [overrides, setOverrides] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchIconOverrides()
      .then(setOverrides)
      .catch((err) => console.warn("Failed to load icon overrides:", err));
  }, []);

  const setOverride = async (key: string, imageData: string) => {
    await setIconOverride(key, imageData);
    setOverrides((prev) => ({ ...prev, [key]: imageData }));
  };

  const clearOverride = async (key: string) => {
    await clearIconOverride(key);
    setOverrides((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  return (
    <IconContext.Provider value={{ overrides, setOverride, clearOverride }}>
      {children}
    </IconContext.Provider>
  );
}

export function useIcons(): IconContextValue {
  const ctx = useContext(IconContext);
  if (!ctx) throw new Error("useIcons must be used inside an IconProvider");
  return ctx;
}
