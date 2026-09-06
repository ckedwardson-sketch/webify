import { useCallback, useEffect, useState } from "react";
import { fetchPageSetting, setPageSetting, clearPageSetting } from "../db/pageSettings";
import { DEFAULT_NODE_SCALE_SETTINGS, NodeScaleSettings } from "./nodeScale";

const SETTING_KEY = "nodeScale";

export function useNodeScaleSettings(scopeKey: string): {
  settings: NodeScaleSettings;
  loaded: boolean;
  updateSettings: (patch: Partial<NodeScaleSettings>) => void;
  resetSettings: () => void;
} {
  const [settings, setSettings] = useState<NodeScaleSettings>(DEFAULT_NODE_SCALE_SETTINGS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoaded(false);
    fetchPageSetting(scopeKey, SETTING_KEY)
      .then((raw) => {
        if (cancelled) return;
        if (raw) {
          try {
            setSettings({ ...DEFAULT_NODE_SCALE_SETTINGS, ...JSON.parse(raw) });
          } catch {
            setSettings(DEFAULT_NODE_SCALE_SETTINGS);
          }
        } else {
          setSettings(DEFAULT_NODE_SCALE_SETTINGS);
        }
        setLoaded(true);
      })
      .catch((err) => {
        console.warn("Failed to load node scale settings:", err);
        setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [scopeKey]);

  const updateSettings = useCallback(
    (patch: Partial<NodeScaleSettings>) => {
      setSettings((prev) => {
        const next = { ...prev, ...patch };
        setPageSetting(scopeKey, SETTING_KEY, JSON.stringify(next)).catch((err) =>
          console.warn("Failed to save node scale settings:", err)
        );
        return next;
      });
    },
    [scopeKey]
  );

  const resetSettings = useCallback(() => {
    setSettings(DEFAULT_NODE_SCALE_SETTINGS);
    clearPageSetting(scopeKey, SETTING_KEY).catch((err) =>
      console.warn("Failed to reset node scale settings:", err)
    );
  }, [scopeKey]);

  return { settings, loaded, updateSettings, resetSettings };
}
