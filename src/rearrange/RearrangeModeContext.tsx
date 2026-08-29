import React, { createContext, useContext, useMemo, useState } from "react";
import { ProjectWidget, ProjectWidgetType } from "../types/project";
import { SavedLayout } from "../db/layouts";
import {
  FieldType,
  FieldCategory,
  AddableFieldOption,
  PairMode,
  snapshotFieldLayout,
  restoreFieldLayoutSnapshot,
} from "../db/fieldLayout";

// What gets copied when the Copy tool is used on a field — a plain
// label+text snapshot, regardless of whether the source field was a
// freetext box or a built-in text field (Goals, Reasoning, ...). Paste
// always materializes it as a new freetext field, since a built-in
// singleton can't have a second instance.
export interface FieldClipboard {
  label: string;
  content: string;
}

// One reversible field-layout action. category/ownerId let popUndo/
// popRedo (below) snapshot generically without the entry needing to
// carry its own bespoke inverse for both directions; `load` is the
// owning page's reload function, captured at push time, so flipping
// either stack always refreshes whatever's currently on screen.
export interface UndoEntry {
  label: string;
  category: FieldCategory;
  ownerId: number;
  load: () => void;
  undo: () => Promise<void>;
}

// What the currently-mounted page (Project Detail, Goal Detail, Dream
// Detail) exposes to the rearrange toolbar, which is rendered once
// globally (see App.tsx) and otherwise has no idea what page it's
// looking at. The page registers itself on mount and unregisters on
// unmount; the toolbar just reads/calls whatever's currently registered.
export interface RearrangeTarget {
  category: FieldCategory; // "project" | "goal" | "dream"
  ownerId: number;
  supportedWidgetTypes: ProjectWidgetType[];
  // Whether the "widgets" field (the grid's own slot) is currently
  // present — gates the Add-field menu's per-widget-type buttons, since
  // adding a widget with nowhere to render it (the slot removed) would
  // just orphan it. See AddFieldMenu.tsx. Optional: pages with no widget
  // grid at all (Dream Detail) just omit it — undefined reads as falsy,
  // same as explicitly false.
  hasWidgetsField?: boolean;
  widgets: ProjectWidget[];
  onAddWidget: (type: ProjectWidgetType) => Promise<void>;
  onDeleteWidget: (id: number) => Promise<void>;
  onDuplicateWidget: (id: number) => Promise<void>;
  onReorder: (orderedIds: number[]) => Promise<void>;
  onApplyLayout: (layout: SavedLayout) => Promise<void>;
  // Generalized field system (beyond the widget grid above). onAddField
  // always adds a "freetext" (a plain text box) or one of the
  // currently-missing field types in availableFieldsToAdd; onPasteField
  // adds a freetext field pre-filled from the clipboard. Where either
  // lands uses whatever gap is currently selected (see insertAt below),
  // defaulting to the end.
  availableFieldsToAdd: AddableFieldOption[];
  onAddField: (type: FieldType) => Promise<void>;
  // `order` is passed explicitly (not read from insertAt/context) since
  // a paste happens within a single click with no render in between —
  // see FieldGap's comment in RearrangeableField.tsx.
  onPasteField: (clip: FieldClipboard, order: number) => Promise<void>;
  // Adds a brand-new field paired to the right of an existing one (the
  // right-edge blue bar — see FieldPairBar in RearrangeableField.tsx).
  // Optional: pairing/rename/resize (FieldSlot/FieldPairBar/PairControls)
  // aren't wired into any page's rendering yet — only RearrangeableField's
  // flat-prop API (drag/delete/copy) is live today — so no page is
  // required to implement these until that UI is adopted.
  onAddPairedField?: (primaryId: number, type: FieldType, mode: PairMode) => Promise<void>;
  onSetPairMode?: (secondaryId: number, mode: PairMode) => Promise<void>;
  onUnpairField?: (secondaryId: number) => Promise<void>;
  onRenameField?: (fieldId: number, label: string | null) => Promise<void>;
  onResizeField?: (fieldId: number, heightPx: number | null) => Promise<void>;
}

interface RearrangeModeContextValue {
  active: boolean;
  enter: () => void;
  exit: () => void;
  deleteToolActive: boolean;
  toggleDeleteTool: () => void;
  // Copy captures a field's content (see FieldClipboard) and highlights
  // its source in green. Paste is no longer a separate armed tool — any
  // gap's popover offers "Paste" right at the top whenever the clipboard
  // has something in it (see FieldGap in RearrangeableField.tsx), so
  // pasting and adding a fresh field both come from the same click.
  copyToolActive: boolean;
  toggleCopyTool: () => void;
  clipboard: FieldClipboard | null;
  copiedFieldId: number | null;
  copyField: (fieldId: number, content: FieldClipboard) => void;
  // Ends the green "copied" highlight and empties the clipboard — called
  // right after a successful paste, or when the user clicks the
  // already-copied field again to cancel it.
  clearClipboard: () => void;
  target: RearrangeTarget | null;
  registerTarget: (t: RearrangeTarget | null) => void;
  // Shared between the toolbar (which owns the menu popover) and the
  // page (which renders the blue insertion gaps between its fields) —
  // see RearrangeableField.tsx's FieldGap.
  showAddMenu: boolean;
  toggleAddMenu: () => void;
  closeAddMenu: () => void;
  insertAt: number | null;
  setInsertAt: (order: number | null) => void;
  // Symmetric undo/redo stacks of reversible field-layout actions
  // (reorder/delete/add/paste/pair) — see rearrange/fieldUndo.ts.
  undoStack: UndoEntry[];
  redoStack: UndoEntry[];
  pushUndo: (entry: UndoEntry) => void;
  popUndo: () => Promise<void>;
  popRedo: () => Promise<void>;
}

const RearrangeModeContext = createContext<RearrangeModeContextValue | null>(null);
const UNDO_STACK_LIMIT = 20;

export function RearrangeModeProvider({ children }: { children: React.ReactNode }) {
  const [active, setActive] = useState(false);
  const [deleteToolActive, setDeleteToolActive] = useState(false);
  const [copyToolActive, setCopyToolActive] = useState(false);
  const [clipboard, setClipboard] = useState<FieldClipboard | null>(null);
  const [copiedFieldId, setCopiedFieldId] = useState<number | null>(null);
  const [target, setTarget] = useState<RearrangeTarget | null>(null);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [insertAt, setInsertAt] = useState<number | null>(null);
  const [undoStack, setUndoStack] = useState<UndoEntry[]>([]);
  const [redoStack, setRedoStack] = useState<UndoEntry[]>([]);

  const value = useMemo<RearrangeModeContextValue>(
    () => ({
      active,
      enter: () => setActive(true),
      exit: () => {
        setActive(false);
        setDeleteToolActive(false);
        setCopyToolActive(false);
        setClipboard(null);
        setCopiedFieldId(null);
        setShowAddMenu(false);
        setInsertAt(null);
        setUndoStack([]);
        setRedoStack([]);
      },
      deleteToolActive,
      toggleDeleteTool: () => {
        setDeleteToolActive((v) => !v);
        setCopyToolActive(false);
      },
      copyToolActive,
      toggleCopyTool: () => {
        setCopyToolActive((v) => !v);
        setDeleteToolActive(false);
      },
      clipboard,
      copiedFieldId,
      copyField: (fieldId, content) => {
        setClipboard(content);
        setCopiedFieldId(fieldId);
      },
      clearClipboard: () => {
        setClipboard(null);
        setCopiedFieldId(null);
      },
      target,
      registerTarget: setTarget,
      showAddMenu,
      toggleAddMenu: () =>
        setShowAddMenu((v) => {
          if (v) setInsertAt(null);
          return !v;
        }),
      closeAddMenu: () => {
        setShowAddMenu(false);
        setInsertAt(null);
      },
      insertAt,
      setInsertAt,
      undoStack,
      redoStack,
      // A fresh action invalidates whatever used to be redoable — same
      // convention as any editor's undo/redo.
      pushUndo: (entry) => {
        setUndoStack((prev) => [...prev, entry].slice(-UNDO_STACK_LIMIT));
        setRedoStack([]);
      },
      popUndo: async () => {
        const entry = undoStack[undoStack.length - 1];
        if (!entry) return;
        setUndoStack((prev) => prev.slice(0, -1));
        // Snapshots the *current* (about-to-be-undone) state before
        // undoing, so redo has something to restore forward to — see
        // fieldUndo.ts's withFieldUndo for the mirror-image case (undo
        // itself just restores a snapshot taken before the original
        // mutation).
        const afterSnapshot = await snapshotFieldLayout(entry.category, entry.ownerId);
        await entry.undo();
        entry.load();
        setRedoStack((prev) =>
          [
            ...prev,
            {
              label: entry.label,
              category: entry.category,
              ownerId: entry.ownerId,
              load: entry.load,
              undo: async () => {
                await restoreFieldLayoutSnapshot(entry.category, entry.ownerId, afterSnapshot);
              },
            },
          ].slice(-UNDO_STACK_LIMIT)
        );
      },
      popRedo: async () => {
        const entry = redoStack[redoStack.length - 1];
        if (!entry) return;
        setRedoStack((prev) => prev.slice(0, -1));
        const beforeSnapshot = await snapshotFieldLayout(entry.category, entry.ownerId);
        await entry.undo();
        entry.load();
        setUndoStack((prev) =>
          [
            ...prev,
            {
              label: entry.label,
              category: entry.category,
              ownerId: entry.ownerId,
              load: entry.load,
              undo: async () => {
                await restoreFieldLayoutSnapshot(entry.category, entry.ownerId, beforeSnapshot);
              },
            },
          ].slice(-UNDO_STACK_LIMIT)
        );
      },
    }),
    [active, deleteToolActive, copyToolActive, clipboard, copiedFieldId, target, showAddMenu, insertAt, undoStack, redoStack]
  );

  return <RearrangeModeContext.Provider value={value}>{children}</RearrangeModeContext.Provider>;
}

export function useRearrangeMode(): RearrangeModeContextValue {
  const ctx = useContext(RearrangeModeContext);
  if (!ctx) throw new Error("useRearrangeMode must be used inside a RearrangeModeProvider");
  return ctx;
}

// Re-exported so pages/components can import everything field-related
// from one of two places without caring which — kept for the few
// existing call sites that imported AddableField from here.
export type AddableField = AddableFieldOption;

// A layout is compatible with the current page only if every widget
// type it contains is one the page actually supports — an all-or-
// nothing check (see RearrangeToolbar.tsx's load browser) rather than
// partial-loading whatever fits, which would silently drop content.
export function isLayoutCompatible(layout: SavedLayout, supportedTypes: ProjectWidgetType[]): boolean {
  return layout.widgets.every((w) => supportedTypes.includes(w.widgetType));
}
