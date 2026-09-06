// Finds the nearest ancestor (including itself) carrying a
// data-item-id, starting from whatever element is physically under the
// pointer right now. Shared by ManagedListRow and PaneGrid — both drive
// reordering with pointer-capture (see useReorderableList) rather than
// native HTML5 drag-and-drop, so the "what am I over" check has to be
// done manually via elementFromPoint instead of a dragover target.
export function itemIdAtPoint(x: number, y: number): number | null {
  const el = document.elementFromPoint(x, y);
  const row = el?.closest<HTMLElement>("[data-item-id]");
  if (!row) return null;
  const id = Number(row.dataset.itemId);
  return Number.isNaN(id) ? null : id;
}
