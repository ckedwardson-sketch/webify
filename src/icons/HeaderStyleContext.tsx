import React, { createContext, useContext, useEffect, useState } from "react";
import {
  fetchHeaderStyleOverrides,
  setHeaderStyleOverride,
  clearHeaderStyleOverride,
  HeaderStyleOverride,
} from "../db/headerStyles";

interface HeaderStyleContextValue {
  overrides: Record<string, HeaderStyleOverride>;
  setOverride: (key: string, override: HeaderStyleOverride) => Promise<void>;
  clearOverride: (key: string) => Promise<void>;
}

const HeaderStyleContext = createContext<HeaderStyleContextValue | null>(null);

export function HeaderStyleProvider({ children }: { children: React.ReactNode }) {
  const [overrides, setOverrides] = useState<Record<string, HeaderStyleOverride>>({});

  useEffect(() => {
    fetchHeaderStyleOverrides()
      .then(setOverrides)
      .catch((err) => console.warn("Failed to load header style overrides:", err));
  }, []);

  const setOverride = async (key: string, override: HeaderStyleOverride) => {
    await setHeaderStyleOverride(key, override);
    setOverrides((prev) => ({ ...prev, [key]: override }));
  };

  const clearOverride = async (key: string) => {
    await clearHeaderStyleOverride(key);
    setOverrides((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  return (
    <HeaderStyleContext.Provider value={{ overrides, setOverride, clearOverride }}>
      {children}
    </HeaderStyleContext.Provider>
  );
}

export function useHeaderStyles(): HeaderStyleContextValue {
  const ctx = useContext(HeaderStyleContext);
  if (!ctx) throw new Error("useHeaderStyles must be used inside a HeaderStyleProvider");
  return ctx;
}
