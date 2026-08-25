import { useState } from "react";

// Manages an ordered list of items that can be drag-reordered. The
// actual drag gesture is driven by pointer events (see ManagedListRow),
// not native HTML5 drag-and-drop, so this works the same on mouse and
// touch. handleDragOver reorders locally on every row the drag passes
// over (a live preview, same feel native DnD gave); handleDragEnd
// persists whatever order that settled on once the pointer is released.
export function useReorderableList<T extends { id: number }>(
  persist: (orderedIds: number[]) => Promise<void>
) {
  const [items, setItems] = useState<T[]>([]);
  const [draggedId, setDraggedId] = useState<number | null>(null);

  const handleDragStart = (id: number) => setDraggedId(id);

  const handleDragOver = (targetId: number) => {
    if (draggedId === null || draggedId === targetId) return;
    setItems((prev) => {
      const fromIndex = prev.findIndex((item) => item.id === draggedId);
      const toIndex = prev.findIndex((item) => item.id === targetId);
      if (fromIndex === -1 || toIndex === -1) return prev;
      const reordered = [...prev];
      const [moved] = reordered.splice(fromIndex, 1);
      reordered.splice(toIndex, 0, moved);
      return reordered;
    });
  };

  const handleDragEnd = async () => {
    if (draggedId === null) return;
    setDraggedId(null);
    await persist(items.map((item) => item.id));
  };

  return { items, setItems, draggedId, handleDragStart, handleDragOver, handleDragEnd };
}
