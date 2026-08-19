import { useState } from "react";

// Manages an ordered list of items that can be drag-reordered. Handles
// the local reorder (instant, for a snappy feel) and calls `persist`
// with the new id order so the caller can write it to the database.
export function useReorderableList<T extends { id: number }>(
  persist: (orderedIds: number[]) => Promise<void>
) {
  const [items, setItems] = useState<T[]>([]);
  const [draggedId, setDraggedId] = useState<number | null>(null);

  const handleDragStart = (id: number) => setDraggedId(id);

  const handleDropOn = async (targetId: number) => {
    if (draggedId === null || draggedId === targetId) return;

    const fromIndex = items.findIndex((item) => item.id === draggedId);
    const toIndex = items.findIndex((item) => item.id === targetId);
    if (fromIndex === -1 || toIndex === -1) return;

    const reordered = [...items];
    const [moved] = reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, moved);

    setItems(reordered);
    setDraggedId(null);
    await persist(reordered.map((item) => item.id));
  };

  return { items, setItems, handleDragStart, handleDropOn };
}
