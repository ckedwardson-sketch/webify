import React, { createContext, useContext, useEffect, useState } from "react";
import { fetchUiPreferences, setUiPreference } from "../db/uiPreferences";

interface UiPreferencesContextValue {
  preferences: Record<string, string>;
  setPreference: (key: string, value: string) => Promise<void>;
}

const UiPreferencesContext = createContext<UiPreferencesContextValue | null>(null);

export function UiPreferencesProvider({ children }: { children: React.ReactNode }) {
  const [preferences, setPreferences] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchUiPreferences()
      .then(setPreferences)
      .catch((err) => console.warn("Failed to load UI preferences:", err));
  }, []);

  const setPreference = async (key: string, value: string) => {
    await setUiPreference(key, value);
    setPreferences((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <UiPreferencesContext.Provider value={{ preferences, setPreference }}>
      {children}
    </UiPreferencesContext.Provider>
  );
}

export function useUiPreferences(): UiPreferencesContextValue {
  const ctx = useContext(UiPreferencesContext);
  if (!ctx) throw new Error("useUiPreferences must be used inside a UiPreferencesProvider");
  return ctx;
}
