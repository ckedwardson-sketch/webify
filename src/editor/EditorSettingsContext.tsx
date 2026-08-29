import React, { createContext, useContext, useEffect, useState } from "react";
import {
  EditorToolSettings,
  EDITOR_SETTINGS_DEFAULTS,
  fetchEditorSettings,
  setEditorSetting,
} from "../db/editorSettings";

interface EditorSettingsContextValue {
  settings: EditorToolSettings;
  setSetting: <K extends keyof EditorToolSettings>(key: K, value: EditorToolSettings[K]) => Promise<void>;
}

const EditorSettingsContext = createContext<EditorSettingsContextValue | null>(null);

export function EditorSettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<EditorToolSettings>(EDITOR_SETTINGS_DEFAULTS);

  useEffect(() => {
    fetchEditorSettings()
      .then(setSettings)
      .catch((err) => console.warn("Failed to load editor settings:", err));
  }, []);

  const setSetting = async <K extends keyof EditorToolSettings>(key: K, value: EditorToolSettings[K]) => {
    await setEditorSetting(key, value);
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <EditorSettingsContext.Provider value={{ settings, setSetting }}>{children}</EditorSettingsContext.Provider>
  );
}

export function useEditorSettings(): EditorSettingsContextValue {
  const ctx = useContext(EditorSettingsContext);
  if (!ctx) throw new Error("useEditorSettings must be used inside an EditorSettingsProvider");
  return ctx;
}
