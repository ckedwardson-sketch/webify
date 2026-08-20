import React, { createContext, useContext, useEffect, useState } from "react";
import {
  fetchButtonStyleOverrides,
  setButtonStyleOverride,
  clearButtonStyleOverride,
  ButtonStyleOverride,
} from "../db/buttonStyles";

interface ButtonStyleContextValue {
  overrides: Record<string, ButtonStyleOverride>;
  setOverride: (key: string, override: ButtonStyleOverride) => Promise<void>;
  clearOverride: (key: string) => Promise<void>;
}

const ButtonStyleContext = createContext<ButtonStyleContextValue | null>(null);

export function ButtonStyleProvider({ children }: { children: React.ReactNode }) {
  const [overrides, setOverrides] = useState<Record<string, ButtonStyleOverride>>({});

  useEffect(() => {
    fetchButtonStyleOverrides()
      .then(setOverrides)
      .catch((err) => console.warn("Failed to load button style overrides:", err));
  }, []);

  const setOverride = async (key: string, override: ButtonStyleOverride) => {
    await setButtonStyleOverride(key, override);
    setOverrides((prev) => ({ ...prev, [key]: override }));
  };

  const clearOverride = async (key: string) => {
    await clearButtonStyleOverride(key);
    setOverrides((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  return (
    <ButtonStyleContext.Provider value={{ overrides, setOverride, clearOverride }}>
      {children}
    </ButtonStyleContext.Provider>
  );
}

export function useButtonStyles(): ButtonStyleContextValue {
  const ctx = useContext(ButtonStyleContext);
  if (!ctx) throw new Error("useButtonStyles must be used inside a ButtonStyleProvider");
  return ctx;
}
