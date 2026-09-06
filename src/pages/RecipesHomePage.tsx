// src/pages/RecipesHomePage.tsx
import { useEffect, useMemo, useState } from "react";
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
import { PaneGrid } from "../components/PaneGrid";
import { PageHeader } from "../components/PageHeader";
import { useTheme } from "../theme/ThemeContext";
import { usePageBackground, pageSurfaceStyle } from "../theme/PageBackgroundContext";
import { parseDecals } from "../theme/decals";
import { DecalLayer } from "../theme/DecalLayer";
import "./Page.css";

export function RecipesHomePage({
  onNavigate,
}: {
  onNavigate: (view: View) => void;
}) {
  const { theme } = useTheme();
  const { overrides: pageBgOverrides, scopeKey: pageBgScopeKey } = usePageBackground();
  const decals = useMemo(() => parseDecals(theme.decals), [theme.decals]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");

  const { items: categories, setItems, handleDragStart, handleDragOver, handleDragEnd } =
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
    <div className="page" data-color-surface="page-bg" style={pageSurfaceStyle(pageBgOverrides["page-bg"])}>
      <DecalLayer decals={decals} target="page-bg" surface={pageBgScopeKey ?? undefined} />
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

      {theme.recipeViewMode === "pane-small" || theme.recipeViewMode === "pane-large" || theme.recipeViewMode === "icon-grid" ? (
        <PaneGrid
          items={categories.map((c) => ({ id: c.id, label: c.name }))}
          size={theme.recipeViewMode === "pane-large" ? "large" : "small"}
          surface="recipe"
          onOpen={(id) => {
            const category = categories.find((c) => c.id === id);
            if (category) onNavigate({ type: "recipes-category", categoryId: category.id, categoryName: category.name });
          }}
          onRename={handleRename}
          onDelete={handleDelete}
          onDragStart={handleDragStart}
          onDragOverTarget={handleDragOver}
          onDragEnd={handleDragEnd}
        />
      ) : (
        <ul className={`list${theme.recipeColumnCount !== "1" ? ` list-columns-${theme.recipeColumnCount}` : ""}`}>
          {categories.map((category) => (
            <ManagedListRow
              key={category.id}
              id={category.id}
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
              onDragOverTarget={handleDragOver}
              onDragEnd={handleDragEnd}
            />
          ))}
        </ul>
      )}
    </div>
  );
}