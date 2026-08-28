import React, { createContext, useContext, useMemo, useState } from "react";
import { ProjectWidget, ProjectWidgetType } from "../types/project";
import { SavedLayout } from "../db/layouts";
import { FieldType } from "../db/fieldLayout";

// A field type the "Add new area" menu can offer beyond widgets/freetext
// — currently just the two removable built-ins (see
// db/fieldLayout.ts's REMOVABLE_FIELD_TYPES) when they aren't already
// on the page.
export interface AddableField {
  type: FieldType;
  label: string;
}

// What gets copied when the Copy tool is used on a field — a plain
// label+text snapshot, regardless of whether the source field was a
// freetext box or a built-in text field (Goals, Reasoning, ...). Paste
// always materializes it as a new freetext field, since a built-in
// singleton can't have a second instance.
export interface FieldClipboard {
  label: string;
  content: string;
}

export interface UndoEntry {
  label: string;
  undo: () => Promise<void>;
}

// What the currently-mounted page (Project Detail, Goal Detail, Dream
// Detail) exposes to the rearrange toolbar, which is rendered once
// globally (see App.tsx) and otherwise has no idea what page it's
// looking at. The page registers itself on mount and unregisters on
// unmount; the toolbar just reads/calls whatever's currently registered.
export interface RearrangeTarget {
  category: string; // "project" | "goal" | "dream" — see SavedLayout's comment
  ownerId: number;
  supportedWidgetTypes: ProjectWidgetType[];
  widgets: ProjectWidget[];
  onAddWidget: (type: ProjectWidgetType) => Promise<void>;
  onDeleteWidget: (id: number) => Promise<void>;
  onDuplicateWidget: (id: number) => Promise<void>;
  onReorder: (orderedIds: number[]) => Promise<void>;
  onApplyLayout: (layout: SavedLayout) => Promise<void>;
  // Generalized field system (beyond the widget grid above). onAddField
  // always adds a "freetext" (a plain text box) or one of the
  // currently-missing removable built-ins in availableFieldsToAdd;
  // onPasteField adds a freetext field pre-filled from the clipboard.
  // Where either lands uses whatever gap is currently selected (see
  // insertAt below), defaulting to the end.
  availableFieldsToAdd: AddableField[];
  onAddField: (type: FieldType) => Promise<void>;
  // `order` is passed explicitly (not read from insertAt/context) since
  // a paste happens within a single click with no render in between —
  // see FieldGap's comment in RearrangeableField.tsx.
  onPasteField: (clip: FieldClipboard, order: number) => Promise<void>;
}

interface RearrangeModeContextValue {
  active: boolean;
  enter: () => void;
  exit: () => void;
  deleteToolActive: boolean;
  toggleDeleteTool: () => void;
  // Copy captures a field's content (see FieldClipboard) and highlights
  // its source; Paste materializes the clipboard as a new freetext
  // field wherever you click. Widgets keep their old one-click instant
  // duplicate under the Copy tool — see onDuplicateWidget above —
  // since every widget can already be freely duplicated (unlike a
  // built-in singleton field), it doesn't need the two-step flow.
  copyToolActive: boolean;
  toggleCopyTool: () => void;
  pasteToolActive: boolean;
  togglePasteTool: () => void;
  clipboard: FieldClipboard | null;
  copiedFieldId: number | null;
  copyField: (fieldId: number, content: FieldClipboard) => void;
  // Ends the green "copied" highlight and empties the clipboard — called
  // right after a successful paste (see RearrangeableField.tsx's
  // FieldGap), since lingering on the original field once its content
  // has already landed elsewhere just reads as a stuck glow.
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
  // A capped stack of reversible field-layout actions (reorder/delete/
  // add/paste) — see rearrange/fieldUndo.ts.
  undoStack: UndoEntry[];
  pushUndo: (entry: UndoEntry) => void;
  popUndo: () => Promise<void>;
}

const RearrangeModeContext = createContext<RearrangeModeContextValue | null>(null);
const UNDO_STACK_LIMIT = 20;

export function RearrangeModeProvider({ children }: { children: React.ReactNode }) {
  const [active, setActive] = useState(false);
  const [deleteToolActive, setDeleteToolActive] = useState(false);
  const [copyToolActive, setCopyToolActive] = useState(false);
  const [pasteToolActive, setPasteToolActive] = useState(false);
  const [clipboard, setClipboard] = useState<FieldClipboard | null>(null);
  const [copiedFieldId, setCopiedFieldId] = useState<number | null>(null);
  const [target, setTarget] = useState<RearrangeTarget | null>(null);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [insertAt, setInsertAt] = useState<number | null>(null);
  const [undoStack, setUndoStack] = useState<UndoEntry[]>([]);

  const value = useMemo<RearrangeModeContextValue>(
    () => ({
      active,
      enter: () => setActive(true),
      exit: () => {
        setActive(false);
        setDeleteToolActive(false);
        setCopyToolActive(false);
        setPasteToolActive(false);
        setClipboard(null);
        setCopiedFieldId(null);
        setShowAddMenu(false);
        setInsertAt(null);
        setUndoStack([]);
      },
      deleteToolActive,
      toggleDeleteTool: () => {
        setDeleteToolActive((v) => !v);
        setCopyToolActive(false);
        setPasteToolActive(false);
      },
      copyToolActive,
      toggleCopyTool: () => {
        setCopyToolActive((v) => !v);
        setDeleteToolActive(false);
        setPasteToolActive(false);
      },
      pasteToolActive,
      togglePasteTool: () => {
        setPasteToolActive((v) => !v);
        setDeleteToolActive(false);
        setCopyToolActive(false);
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
        setPasteToolActive(false);
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
      pushUndo: (entry) => setUndoStack((prev) => [...prev, entry].slice(-UNDO_STACK_LIMIT)),
      popUndo: async () => {
        const entry = undoStack[undoStack.length - 1];
        if (!entry) return;
        setUndoStack((prev) => prev.slice(0, -1));
        await entry.undo();
      },
    }),
    [
      active,
      deleteToolActive,
      copyToolActive,
      pasteToolActive,
      clipboard,
      copiedFieldId,
      target,
      showAddMenu,
      insertAt,
      undoStack,
    ]
  );

  return <RearrangeModeContext.Provider value={value}>{children}</RearrangeModeContext.Provider>;
}

export function useRearrangeMode(): RearrangeModeContextValue {
  const ctx = useContext(RearrangeModeContext);
  if (!ctx) throw new Error("useRearrangeMode must be used inside a RearrangeModeProvider");
  return ctx;
}

// A layout is compatible with the current page only if every widget
// type it contains is one the page actually supports — an all-or-
// nothing check (see RearrangeToolbar.tsx's load browser) rather than
// partial-loading whatever fits, which would silently drop content.
export function isLayoutCompatible(layout: SavedLayout, supportedTypes: ProjectWidgetType[]): boolean {
  return layout.widgets.every((w) => supportedTypes.includes(w.widgetType));
}
