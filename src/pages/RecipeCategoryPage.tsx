// src/pages/RecipeCategoryPage.tsx
import { useEffect, useMemo, useState } from "react";
import {
  fetchRecipes,
  addRecipe,
  renameRecipe,
  deleteRecipe,
  reorderRecipes,
  updateRecipeImage,
} from "../db/recipes";
import { Recipe } from "../types/models";
import { View } from "../types/nav";
import { useReorderableList } from "../hooks/useReorderableList";
import { Breadcrumb } from "../components/Breadcrumb";
import { ManagedListRow } from "../components/ManagedListRow";
import { PaneGrid } from "../components/PaneGrid";
import { PageHeader } from "../components/PageHeader";
import { Icon } from "../icons/Icon";
import { useTheme } from "../theme/ThemeContext";
import "./Page.css";
import "./FutureSlot.css";

export function RecipeCategoryPage({
  categoryId,
  categoryName,
  onNavigate,
}: {
  categoryId: number;
  categoryName: string;
  onNavigate: (view: View) => void;
}) {
  const { theme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [addingFutureSlot, setAddingFutureSlot] = useState(false);
  const [newName, setNewName] = useState("");

  const { items: recipes, setItems, handleDragStart, handleDragOver, handleDragEnd } =
    useReorderableList<Recipe>(reorderRecipes);

  const load = async () => {
    setItems(await fetchRecipes(categoryId));
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [categoryId]);

  // "manual" leaves fetch order (drag-reorder / sortOrder) untouched.
  // "created"/"updated" go newest-first, matching Goals/Projects.
  const sortedRecipes = useMemo(() => {
    const order = theme.recipeHomeSortOrder;
    if (order === "name") {
      return [...recipes].sort((a, b) => a.name.localeCompare(b.name));
    }
    if (order === "created") {
      return [...recipes].sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
    }
    if (order === "updated") {
      return [...recipes].sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""));
    }
    return recipes;
  }, [recipes, theme.recipeHomeSortOrder]);

  const confirmAdd = async () => {
    const name = newName.trim();
    const isFutureSlot = addingFutureSlot;
    setAdding(false);
    setAddingFutureSlot(false);
    setNewName("");
    if (name) {
      const newId = await addRecipe(categoryId, name, isFutureSlot);
      await load();
      if (isFutureSlot) {
        onNavigate({ type: "recipe-detail", categoryId, categoryName, recipeId: newId });
      }
    }
  };

  const cancelAdd = () => {
    setNewName("");
    setAdding(false);
    setAddingFutureSlot(false);
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
        onAdd={() => {
          setAddingFutureSlot(false);
          setAdding(true);
        }}
        onOpenGraph={() =>
          onNavigate({
            type: "recipes-graph",
            categoryId,
            categoryName,
          })
        }
        extraActions={
          <button
            className="icon-button future-slot-add-button"
            onClick={() => {
              setAddingFutureSlot(true);
              setAdding(true);
            }}
            title="Add Future Slot — plan an idea for a recipe that doesn't exist yet"
          >
            <Icon iconKey="future-slot" size={16} /> Future Slot
          </button>
        }
      />

      {adding && (
        <input
          className={`inline-add-input${addingFutureSlot ? " inline-add-input-future-slot" : ""}`}
          autoFocus
          placeholder={addingFutureSlot ? "New future slot name" : "New recipe name"}
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") confirmAdd();
            if (e.key === "Escape") cancelAdd();
          }}
          onBlur={cancelAdd}
        />
      )}

      {theme.recipeViewMode === "pane-small" || theme.recipeViewMode === "pane-large" || theme.recipeViewMode === "icon-grid" ? (
        <PaneGrid
          items={sortedRecipes.map((r) => ({
            id: r.id,
            label: r.name,
            imageUrl: r.imageData,
            isFutureSlot: r.isFutureSlot,
          }))}
          size={theme.recipeViewMode === "pane-large" ? "large" : "small"}
          surface="recipe"
          onOpen={(id) => onNavigate({ type: "recipe-detail", categoryId, categoryName, recipeId: id })}
          onRename={handleRename}
          onDelete={handleDelete}
          onSetImage={(id, file) => {
            const reader = new FileReader();
            reader.onload = async () => {
              await updateRecipeImage(id, reader.result as string);
              load();
            };
            reader.readAsDataURL(file);
          }}
          onDragStart={handleDragStart}
          onDragOverTarget={handleDragOver}
          onDragEnd={handleDragEnd}
        />
      ) : (
        <ul className={`list${theme.recipeColumnCount !== "1" ? ` list-columns-${theme.recipeColumnCount}` : ""}`}>
          {sortedRecipes.map((recipe) => (
            <ManagedListRow
              key={recipe.id}
              id={recipe.id}
              label={recipe.name}
              imageUrl={recipe.imageData}
              isFutureSlot={recipe.isFutureSlot}
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
              onAddImage={(file) => {
                const reader = new FileReader();
                reader.onload = async () => {
                  await updateRecipeImage(recipe.id, reader.result as string);
                  load();
                };
                reader.readAsDataURL(file);
              }}
              onDragStart={() => handleDragStart(recipe.id)}
              onDragOverTarget={handleDragOver}
              onDragEnd={handleDragEnd}
            />
          ))}
        </ul>
      )}
    </div>
  );
}