// src/pages/RecipesHomePage.tsx
import { useEffect, useState } from "react";
import {
  fetchCategories,
  addCategory,
  renameCategory,
  deleteCategory,
  reorderCategories,
} from "../db/categories";
import { Category } from "../types/models";
import { View } from "../types/nav";
import { useReorderableList } from "../hooks/useReorderableList";
import { ManagedListRow } from "../components/ManagedListRow";
import { PageHeader } from "../components/PageHeader";
import "./Page.css";

export function RecipesHomePage({
  onNavigate,
}: {
  onNavigate: (view: View) => void;
}) {
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");

  const { items: categories, setItems, handleDragStart, handleDropOn } =
    useReorderableList<Category>(reorderCategories);

  const load = async () => {
    setItems(await fetchCategories());
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const confirmAdd = async () => {
    const name = newName.trim();
    setAdding(false);
    setNewName("");
    if (name) {
      await addCategory(name);
      await load();
    }
  };

  const cancelAdd = () => {
    setNewName("");
    setAdding(false);
  };

  const handleRename = async (id: number, name: string) => {
    await renameCategory(id, name);
    await load();
  };

  const handleDelete = async (id: number) => {
    await deleteCategory(id);
    await load();
  };

  if (loading) {
    return (
      <div className="page">
        <p className="page-text">Loading…</p>
      </div>
    );
  }

  return (
    <div className="page">
      <PageHeader
        title="Recipes"
        onAdd={() => setAdding(true)}
        onOpenGraph={() => onNavigate({ type: "recipes-graph" })}
      />

      {adding && (
        <input
          className="inline-add-input"
          autoFocus
          placeholder="New category name"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") confirmAdd();
            if (e.key === "Escape") cancelAdd();
          }}
          onBlur={cancelAdd}
        />
      )}

      <ul className="list">
        {categories.map((category) => (
          <ManagedListRow
            key={category.id}
            label={category.name}
            onOpen={() =>
              onNavigate({
                type: "recipes-category",
                categoryId: category.id,
                categoryName: category.name,
              })
            }
            onRename={(name) => handleRename(category.id, name)}
            onDelete={() => handleDelete(category.id)}
            onDragStart={() => handleDragStart(category.id)}
            onDropOn={() => handleDropOn(category.id)}
          />
        ))}
      </ul>
    </div>
  );
}