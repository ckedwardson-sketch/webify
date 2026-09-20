import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { useMobileLayout } from "../theme/useMobileLayout";
import { useUiPreferences } from "./UiPreferencesContext";

// Whether nodes on the Dream Web / Goal Web / Recipes Graph canvases can
// be dragged to reposition. On a touch screen, a finger is much less
// precise than a mouse — panning/zooming to see anything means you're
// zoomed in, and a tap meant as a scroll easily lands on a node and drags
// it. So by default (see the "Lock node dragging on mobile" setting in
// Panel & Layout Memory) this starts locked whenever the app is in mobile
// layout, and unlocked otherwise. Once the user manually flips it (the
// lock button in WebControls), that choice sticks for the rest of the
// session — the auto behavior above never overrides a deliberate choice,
// it only sets the starting point.
interface WebNodeLockContextValue {
  locked: boolean;
  setLocked: (locked: boolean) => void;
}

const WebNodeLockContext = createContext<WebNodeLockContextValue | null>(null);

export function WebNodeLockProvider({ children }: { children: React.ReactNode }) {
  const { preferences } = useUiPreferences();
  const autoLockEnabled = preferences.autoLockWebNodesMobile !== "0";
  const mobile = useMobileLayout();
  const [locked, setLockedState] = useState(() => autoLockEnabled && mobile);
  const userOverrideRef = useRef(false);

  useEffect(() => {
    if (!autoLockEnabled) {
      // Setting turned off: no auto-lock behavior to enforce, and a fresh
      // toggle-on later should re-derive from the viewport again rather
      // than remembering a stale override from before it was disabled.
      userOverrideRef.current = false;
      setLockedState(false);
      return;
    }
    if (userOverrideRef.current) return;
    setLockedState(mobile);
  }, [autoLockEnabled, mobile]);

  const setLocked = (v: boolean) => {
    userOverrideRef.current = true;
    setLockedState(v);
  };

  return (
    <WebNodeLockContext.Provider value={{ locked, setLocked }}>{children}</WebNodeLockContext.Provider>
  );
}

export function useWebNodeLock(): WebNodeLockContextValue {
  const ctx = useContext(WebNodeLockContext);
  if (!ctx) throw new Error("useWebNodeLock must be used inside a WebNodeLockProvider");
  return ctx;
}
