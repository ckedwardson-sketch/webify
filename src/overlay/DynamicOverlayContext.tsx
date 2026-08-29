import React, { createContext, useContext, useState } from "react";
import { SettingsSearchItem } from "../pages/settingsSearchIndex";

// A pinned settings item: shift-clicking an item in the overlay panel
// pins it here instead of navigating. Pins are in-memory only (not
// persisted to the DB) — scoped down per the task spec, since they're a
// convenience within a single session, not durable app state.
export interface PinnedItem {
  key: string;
  label: string;
  pageType: string; // View["type"] of the owning settings page
}

interface DynamicOverlayContextValue {
  active: boolean;
  toggle: () => void;
  enter: () => void;
  exit: () => void;
  pins: PinnedItem[];
  addPin: (item: PinnedItem) => void;
  removePin: (key: string) => void;
  // A focus request the panel can issue for the currently-mounted page —
  // scroll+highlight a data-settings-key element in place.
  focusRequest: string | null;
  requestFocus: (key: string) => void;
  panelSide: "left" | "right";
  togglePanelSide: () => void;
  // The one settings item currently open for inline editing in the
  // overlay panel. Lives here (not local panel state) so every entry
  // point — the panel's own tree, the Settings-home search box, the
  // Dynamic Settings Search page, and the reverse hover+jump — opens the
  // exact same inline editor instead of navigating to a real settings
  // page. Requesting a quick edit also activates the overlay, since the
  // whole point is "find it and change it without navigating," even when
  // the request came from a page that isn't the overlay panel itself.
  quickEditItem: SettingsSearchItem | null;
  requestQuickEdit: (item: SettingsSearchItem) => void;
  closeQuickEdit: () => void;
  // Color Mode (see overlay/ColorModePanel.tsx) — mutually exclusive
  // with the normal settings tree, same swap-in-place idea as
  // quickEditItem above. Opening it also closes any quick edit in
  // progress, and vice versa, so the panel body only ever shows one.
  colorModeOpen: boolean;
  toggleColorMode: () => void;
  // The field_layout row id currently open for style editing (font/
  // color/background/border/header + the "On the web" toggles — see
  // overlay/FieldStyleQuickEdit.tsx) — ctrl+click on a field opens this
  // instead of the old inline 🎨 popover, same "route everything through
  // the one panel" idea as quickEditItem/colorModeOpen, and mutually
  // exclusive with both.
  fieldStyleTarget: number | null;
  openFieldStyle: (fieldId: number) => void;
  closeFieldStyle: () => void;
}

const DynamicOverlayContext = createContext<DynamicOverlayContextValue | null>(null);

export function DynamicOverlayProvider({ children }: { children: React.ReactNode }) {
  const [active, setActive] = useState(false);
  const [pins, setPins] = useState<PinnedItem[]>([]);
  const [focusRequest, setFocusRequest] = useState<string | null>(null);
  const [panelSide, setPanelSide] = useState<"left" | "right">("right");
  const [quickEditItem, setQuickEditItem] = useState<SettingsSearchItem | null>(null);
  const [colorModeOpen, setColorModeOpen] = useState(false);
  const [fieldStyleTarget, setFieldStyleTarget] = useState<number | null>(null);

  const addPin = (item: PinnedItem) => {
    setPins((prev) => (prev.some((p) => p.key === item.key) ? prev : [...prev, item]));
  };
  const removePin = (key: string) => setPins((prev) => prev.filter((p) => p.key !== key));

  const requestFocus = (key: string) => {
    setFocusRequest(key);
    // Clear shortly after so the same key can be requested again later.
    setTimeout(() => setFocusRequest(null), 50);
  };

  return (
    <DynamicOverlayContext.Provider
      value={{
        active,
        toggle: () => setActive((a) => !a),
        enter: () => setActive(true),
        exit: () => setActive(false),
        pins,
        addPin,
        removePin,
        focusRequest,
        requestFocus,
        panelSide,
        togglePanelSide: () => setPanelSide((s) => (s === "right" ? "left" : "right")),
        quickEditItem,
        requestQuickEdit: (item) => {
          setActive(true);
          setColorModeOpen(false);
          setFieldStyleTarget(null);
          setQuickEditItem(item);
        },
        closeQuickEdit: () => setQuickEditItem(null),
        colorModeOpen,
        toggleColorMode: () =>
          setColorModeOpen((v) => {
            if (!v) {
              setQuickEditItem(null);
              setFieldStyleTarget(null);
            }
            return !v;
          }),
        fieldStyleTarget,
        openFieldStyle: (fieldId) => {
          setActive(true);
          setColorModeOpen(false);
          setQuickEditItem(null);
          setFieldStyleTarget(fieldId);
        },
        closeFieldStyle: () => setFieldStyleTarget(null),
      }}
    >
      {children}
    </DynamicOverlayContext.Provider>
  );
}

export function useDynamicOverlay(): DynamicOverlayContextValue {
  const ctx = useContext(DynamicOverlayContext);
  if (!ctx) throw new Error("useDynamicOverlay must be used inside a DynamicOverlayProvider");
  return ctx;
}
