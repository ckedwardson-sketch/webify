import { FieldCategory, snapshotFieldLayout, restoreFieldLayoutSnapshot } from "../db/fieldLayout";
import { UndoEntry } from "./RearrangeModeContext";

// Wraps any field-layout mutation (reorder/delete/add/paste) with undo
// support: snapshot before, run the mutation, push an entry that
// restores the snapshot. See db/fieldLayout.ts's
// snapshotFieldLayout/restoreFieldLayoutSnapshot for why a full
// snapshot rather than a bespoke inverse per action.
export async function withFieldUndo(
  category: FieldCategory,
  ownerId: number,
  label: string,
  // Return value (if any) is discarded — several mutations (e.g.
  // addBuiltinField) return the new row's id for callers that need it
  // immediately (see useFieldLayout.ts's handleAddPairedField); this
  // wrapper just doesn't care.
  mutate: () => Promise<unknown>,
  pushUndo: (entry: UndoEntry) => void,
  load: () => void
): Promise<void> {
  const snapshot = await snapshotFieldLayout(category, ownerId);
  await mutate();
  pushUndo({
    label,
    category,
    ownerId,
    load,
    undo: async () => {
      await restoreFieldLayoutSnapshot(category, ownerId, snapshot);
    },
  });
  load();
}
