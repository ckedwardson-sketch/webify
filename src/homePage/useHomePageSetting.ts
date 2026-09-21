import { useCallback, useEffect, useState } from "react";
import { fetchPageSetting, setPageSetting, clearPageSetting } from "../db/pageSettings";
import { HOME_PAGE_SCOPE_KEY, HOME_PAGE_SETTING_KEY } from "./homePageOptions";

// Reads/writes which page Home shows. Home and Settings > Page Settings
// are never on screen at the same time, so each just loads the stored
// value when it mounts — no shared state needed between them.
export function useHomePageSetting(): {
  homePageKey: string | null;
  loaded: boolean;
  updateHomePage: (key: string | null) => void;
} {
  const [homePageKey, setHomePageKey] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchPageSetting(HOME_PAGE_SCOPE_KEY, HOME_PAGE_SETTING_KEY)
      .then((raw) => {
        if (cancelled) return;
        setHomePageKey(raw);
        setLoaded(true);
      })
      .catch((err) => {
        console.warn("Failed to load home page setting:", err);
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // null un-assigns Home (deletes the row) so it goes back to showing
  // the picker.
  const updateHomePage = useCallback((key: string | null) => {
    setHomePageKey(key);
    const write = key
      ? setPageSetting(HOME_PAGE_SCOPE_KEY, HOME_PAGE_SETTING_KEY, key)
      : clearPageSetting(HOME_PAGE_SCOPE_KEY, HOME_PAGE_SETTING_KEY);
    write.catch((err) => console.warn("Failed to save home page setting:", err));
  }, []);

  return { homePageKey, loaded, updateHomePage };
}
