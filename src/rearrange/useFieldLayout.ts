import { useCallback, useEffect, useState } from "react";
import {
  fetchFieldLayout,
  reorderFields,
  addBuiltinField,
  addFreetextField,
  addFreetextFieldWithContent,
  removeField,
  fetchFreetextFields,
  updateFieldLayoutLabel,
  updateFieldLayoutHeight,
  setFieldPair,
  updateFieldPairMode,
  unpairField,
  availableFieldsToAdd as computeAvailableFieldsToAdd,
  fieldTypeGroup,
  FieldLayoutRow,
  FieldType,
  FreetextField,
  FieldCategory,
  PairMode,
} from "../db/fieldLayout";
import { useRearrangeMode, FieldClipboard } from "./RearrangeModeContext";
import { withFieldUndo } from "./fieldUndo";
import { buildFieldRows, gapOrderAfterLast, FieldRowGroup } from "./fieldRows";

// The one shared engine behind every field-arrangeable page (Project,
// Goal, Dream Detail) — state, CRUD, drag-reorder, pairing, rename,
// resize, all in one place instead of tripled per page. Each page still
// owns its own field *content* (drafts, save-on-blur, what each
// fieldType actually renders) via `contentFor` (for Copy) and its own
// renderField switch — this only owns the layout/arrangement mechanics.
export function useFieldLayout(opts: {
  category: FieldCategory;
  ownerId: number | null;
  contentFor: (f: FieldLayoutRow) => FieldClipboard | null;
}) {
  const { category, ownerId, contentFor } = opts;
  const [fields, setFields] = useState<FieldLayoutRow[]>([]);
  const [freetextById, setFreetextById] = useState<Map<number, FreetextField>>(new Map());
  const [dragOverId, setDragOverId] = useState<number | null>(null);
  const {
    active: rearranging,
    deleteToolActive,
    copyToolActive,
    copiedFieldId,
    copyField,
    clearClipboard,
    clipboard,
    insertAt,
    setInsertAt,
    pushUndo,
  } = useRearrangeMode();

  const reload = useCallback(async () => {
    if (ownerId === null) return;
    const fieldRows = await fetchFieldLayout(category, ownerId);
    setFields(fieldRows);
    const freetextIds = fieldRows.filter((f) => f.fieldType === "freetext" && f.refId !== null).map((f) => f.refId!);
    setFreetextById(await fetchFreetextFields(freetextIds));
  }, [category, ownerId]);

  useEffect(() => {
    reload();
  }, [reload]);

  const rows: FieldRowGroup[] = buildFieldRows(fields);
  const primaries = rows.map((r) => r.primary);

  const nextSortOrder = (): number => (insertAt !== null ? insertAt : gapOrderAfterLast(primaries));

  const handleAddField = async (type: FieldType) => {
    if (ownerId === null) return;
    const order = nextSortOrder();
    await withFieldUndo(
      category,
      ownerId,
      "Add field",
      () => (type === "freetext" ? addFreetextField(category, ownerId, order) : addBuiltinField(category, ownerId, type, order)),
      pushUndo,
      reload
    );
    setInsertAt(null);
  };

  const handlePasteField = async (clip: FieldClipboard, order: number) => {
    if (ownerId === null) return;
    await withFieldUndo(
      category,
      ownerId,
      "Paste field",
      () => addFreetextFieldWithContent(category, ownerId, order, clip.label, clip.content),
      pushUndo,
      reload
    );
  };

  const handleDeleteField = async (row: FieldLayoutRow) => {
    if (ownerId === null) return;
    await withFieldUndo(category, ownerId, "Delete field", () => removeField(row.id, row.fieldType, row.refId), pushUndo, reload);
  };

  const handleCopyField = (row: FieldLayoutRow) => {
    if (copiedFieldId === row.id) {
      // Clicking the already-copied field again cancels it — the one
      // way to back out of a copy besides pasting it or leaving
      // rearrange mode entirely.
      clearClipboard();
      return;
    }
    const content = contentFor(row);
    if (!content) return;
    copyField(row.id, content);
  };

  // Row-level drag: only a row's primary is ever a drag source (see
  // fieldRows.ts) — dragging moves the whole row (its paired secondary,
  // if any, comes along for free since it's found via pairedWithId, not
  // its own position). effectAllowed/dropEffect are set explicitly
  // (some Chromium/WebView2 builds are pickier than desktop Chrome about
  // needing both sides of a drag to declare it) rather than relying on
  // the default, which is the most likely reason plain field reordering
  // never actually completed a drop before.
  const handleDragStart = (e: React.DragEvent, id: number) => {
    const card = (e.currentTarget as HTMLElement).closest(".field-row") as HTMLElement | null;
    if (card) {
      const rect = card.getBoundingClientRect();
      e.dataTransfer.setDragImage(card, e.clientX - rect.left, e.clientY - rect.top);
    }
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(id));
  };

  const handleDragOver = (e: React.DragEvent, id: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverId(id);
  };

  const handleDragLeave = (id: number) => {
    setDragOverId((cur) => (cur === id ? null : cur));
  };

  const handleDrop = async (e: React.DragEvent, targetId: number) => {
    e.preventDefault();
    setDragOverId(null);
    const draggedId = Number(e.dataTransfer.getData("text/plain"));
    if (!draggedId || draggedId === targetId || ownerId === null) return;
    const ids = primaries.map((f) => f.id);
    const from = ids.indexOf(draggedId);
    const to = ids.indexOf(targetId);
    if (from === -1 || to === -1) return;
    ids.splice(from, 1);
    ids.splice(to, 0, draggedId);
    // Secondaries aren't in `ids` at all — reorderFields only touches
    // rows it's given, so every paired secondary's own sort_order (never
    // read for layout purposes) is simply left alone.
    await withFieldUndo(category, ownerId, "Reorder fields", () => reorderFields(ids), pushUndo, reload);
  };

  const handleAddPairedField = async (primaryId: number, type: FieldType, mode: PairMode) => {
    if (ownerId === null) return;
    const order = gapOrderAfterLast(fields);
    await withFieldUndo(
      category,
      ownerId,
      "Add paired field",
      async () => {
        const newId =
          type === "freetext"
            ? await addFreetextField(category, ownerId, order)
            : await addBuiltinField(category, ownerId, type, order);
        await setFieldPair(newId, primaryId, mode);
      },
      pushUndo,
      reload
    );
  };

  const handleSetPairMode = async (secondaryId: number, mode: PairMode) => {
    if (ownerId === null) return;
    await withFieldUndo(category, ownerId, "Change pair layout", () => updateFieldPairMode(secondaryId, mode), pushUndo, reload);
  };

  const handleUnpairField = async (secondaryId: number) => {
    if (ownerId === null) return;
    await withFieldUndo(category, ownerId, "Unpair field", () => unpairField(secondaryId), pushUndo, reload);
  };

  // Header rename doesn't go through the undo stack — it's a low-stakes,
  // instantly-reversible text edit (just type it back), same as
  // FreetextFieldEditor's own label input never having been undo-tracked
  // either. Passing null clears back to the field type's default label.
  const handleRenameField = async (fieldId: number, label: string | null) => {
    await updateFieldLayoutLabel(fieldId, label);
    await reload();
  };

  // Also not undo-tracked, same reasoning — and dragging a resize handle
  // fires far too often to snapshot on every pixel anyway.
  const handleResizeField = async (fieldId: number, heightPx: number | null) => {
    await updateFieldLayoutHeight(fieldId, heightPx);
    setFields((prev) => prev.map((f) => (f.id === fieldId ? { ...f, heightPx } : f)));
  };

  const options = computeAvailableFieldsToAdd(category, fields);

  return {
    fields,
    rows,
    freetextById,
    rearranging,
    deleteToolActive,
    copyToolActive,
    copiedFieldId,
    clipboard,
    dragOverId,
    reload,
    handleDragStart,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleAddField,
    handlePasteField,
    handleDeleteField,
    handleCopyField,
    handleAddPairedField,
    handleSetPairMode,
    handleUnpairField,
    handleRenameField,
    handleResizeField,
    availableFieldsToAdd: options,
    isCopiable: (f: FieldLayoutRow) => fieldTypeGroup(f.fieldType) === "text",
  };
}
