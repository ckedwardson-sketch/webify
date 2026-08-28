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
  mutate: () => Promise<void>,
  pushUndo: (entry: UndoEntry) => void,
  load: () => void
): Promise<void> {
  const snapshot = await snapshotFieldLayout(category, ownerId);
  await mutate();
  pushUndo({
    label,
    undo: async () => {
      await restoreFieldLayoutSnapshot(category, ownerId, snapshot);
      load();
    },
  });
  load();
}
