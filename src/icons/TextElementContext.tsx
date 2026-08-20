import React, { createContext, useContext, useEffect, useState } from "react";
import {
  fetchTextElementOverrides,
  setTextElementOverride,
  clearTextElementOverride,
  TextElementOverride,
} from "../db/textElements";

interface TextElementContextValue {
  overrides: Record<string, TextElementOverride>;
  setOverride: (key: string, override: TextElementOverride) => Promise<void>;
  clearOverride: (key: string) => Promise<void>;
}

const TextElementContext = createContext<TextElementContextValue | null>(null);

export function TextElementProvider({ children }: { children: React.ReactNode }) {
  const [overrides, setOverrides] = useState<Record<string, TextElementOverride>>({});

  useEffect(() => {
    fetchTextElementOverrides()
      .then(setOverrides)
      .catch((err) => console.warn("Failed to load text element overrides:", err));
  }, []);

  const setOverride = async (key: string, override: TextElementOverride) => {
    await setTextElementOverride(key, override);
    setOverrides((prev) => ({ ...prev, [key]: override }));
  };

  const clearOverride = async (key: string) => {
    await clearTextElementOverride(key);
    setOverrides((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  return (
    <TextElementContext.Provider value={{ overrides, setOverride, clearOverride }}>
      {children}
    </TextElementContext.Provider>
  );
}

export function useTextElements(): TextElementContextValue {
  const ctx = useContext(TextElementContext);
  if (!ctx) throw new Error("useTextElements must be used inside a TextElementProvider");
  return ctx;
}
