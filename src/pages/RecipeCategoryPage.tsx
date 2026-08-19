// src/pages/RecipeCategoryPage.tsx
import { useEffect, useState } from "react";
import {
  fetchRecipes,
  addRecipe,
  renameRecipe,
  deleteRecipe,
  reorderRecipes,
} from "../db/recipes";
import { Recipe } from "../types/models";
import { View } from "../types/nav";
import { useReorderableList } from "../hooks/useReorderableList";
import { Breadcrumb } from "../components/Breadcrumb";
import { ManagedListRow } from "../components/ManagedListRow";
import { PageHeader } from "../components/PageHeader";
import "./Page.css";

export function RecipeCategoryPage({
  categoryId,
  categoryName,
  onNavigate,
}: {
  categoryId: number;
  categoryName: string;
  onNavigate: (view: View) => void;
}) {
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");

  const { items: recipes, setItems, handleDragStart, handleDropOn } =
    useReorderableList<Recipe>(reorderRecipes);

  const load = async () => {
    setItems(await fetchRecipes(categoryId));
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [categoryId]);

  const confirmAdd = async () => {
    const name = newName.trim();
    setAdding(false);
    setNewName("");
    if (name) {
      await addRecipe(categoryId, name);
      await load();
    }
  };

  const cancelAdd = () => {
    setNewName("");
    setAdding(false);
  };

  const handleRename = async (id: number, name: string) => {
    await renameRecipe(id, name);
    await load();
  };

  const handleDelete = async (id: number) => {
    await deleteRecipe(id);
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
      <Breadcrumb
        crumbs={[
          { label: "Recipes", onClick: () => onNavigate({ type: "recipes-home" }) },
          { label: categoryName },
        ]}
      />

      <PageHeader
        title={categoryName}
        onAdd={() => setAdding(true)}
        onOpenGraph={() =>
          onNavigate({
            type: "recipes-graph",
            categoryId,
            categoryName,
          })
        }
      />

      {adding && (
        <input
          className="inline-add-input"
          autoFocus
          placeholder="New recipe name"
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
        {recipes.map((recipe) => (
          <ManagedListRow
            key={recipe.id}
            label={recipe.name}
            onOpen={() =>
              onNavigate({
                type: "recipe-detail",
                categoryId,
                categoryName,
                recipeId: recipe.id,
              })
            }
            onRename={(name) => handleRename(recipe.id, name)}
            onDelete={() => handleDelete(recipe.id)}
            onDragStart={() => handleDragStart(recipe.id)}
            onDropOn={() => handleDropOn(recipe.id)}
          />
        ))}
      </ul>
    </div>
  );
}