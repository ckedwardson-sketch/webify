import React, { createContext, useContext, useState } from "react";
import { FieldLayoutRow, FieldStylePatch } from "../db/fieldLayout";

// Same "the currently-mounted page registers what the global UI needs"
// pattern as RearrangeModeContext's registerTarget — the ctrl+click
// style editor (see overlay/FieldStyleQuickEdit.tsx) lives in the
// Dynamic Settings panel, outside any specific detail page, so it can't
// just close over that page's `fields` state/save handler directly. Only
// one Project/Goal/Dream detail page is ever mounted at a time, so a
// single registered target is enough — no need to key this by owner.
export interface FieldStyleRegistryTarget {
  fields: FieldLayoutRow[];
  onSave: (fieldId: number, patch: FieldStylePatch) => void;
  onRename: (fieldId: number, label: string | null) => void;
}

interface FieldStyleRegistryContextValue {
  target: FieldStyleRegistryTarget | null;
  registerFieldStyleTarget: (target: FieldStyleRegistryTarget | null) => void;
}

const FieldStyleRegistryContext = createContext<FieldStyleRegistryContextValue | null>(null);

export function FieldStyleRegistryProvider({ children }: { children: React.ReactNode }) {
  const [target, setTarget] = useState<FieldStyleRegistryTarget | null>(null);
  return (
    <FieldStyleRegistryContext.Provider value={{ target, registerFieldStyleTarget: setTarget }}>
      {children}
    </FieldStyleRegistryContext.Provider>
  );
}

export function useFieldStyleRegistry(): FieldStyleRegistryContextValue {
  const ctx = useContext(FieldStyleRegistryContext);
  if (!ctx) throw new Error("useFieldStyleRegistry must be used inside a FieldStyleRegistryProvider");
  return ctx;
}
