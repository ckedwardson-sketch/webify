// src/pages/RecipeDetailPage.tsx
import { useEffect, useRef, useState } from "react";
import {
  fetchRecipe,
  updateRecipeInstructions,
  updateRecipeImage,
  updateRecipeFlag,
  createIteration,
  fetchIterations,
  updateIterationDifference,
  renameRecipe,
} from "../db/recipes";
import { fetchCategories } from "../db/categories";
import { RecipeEditor } from "../editor/RecipeEditor";
import { Icon } from "../icons/Icon";
import { Recipe } from "../types/models";
import { View } from "../types/nav";
import { Breadcrumb } from "../components/Breadcrumb";
import "./Page.css";
import "../components/ManagedListRow.css"; // reusing .managed-row-dropdown / .dropdown-item / .menu-backdrop

type FlagField = "isProven" | "isFrozen" | "isHomegrown" | "isFavorite";

export function RecipeDetailPage({
  categoryId,
  categoryName,
  recipeId,
  onNavigate,
}: {
  categoryId: number;
  categoryName: string;
  recipeId: number;
  onNavigate: (view: View) => void;
}) {
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [parentRecipe, setParentRecipe] = useState<Recipe | null>(null);
  const [iterations, setIterations] = useState<Recipe[]>([]);
  const [instructions, setInstructions] = useState("");
  const [iterationDiff, setIterationDiff] = useState("");
  const [loading, setLoading] = useState(true);
  const [creatingIteration, setCreatingIteration] = useState(false);
  const [showIterationsMenu, setShowIterationsMenu] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const data = await fetchRecipe(recipeId);
      if (data) {
        setRecipe(data);
        setInstructions(data.instructions || "");
        setIterationDiff(data.iterationDifference || "");
        setParentRecipe(data.parentRecipeId ? await fetchRecipe(data.parentRecipeId) : null);
      }
      setIterations(await fetchIterations(recipeId));
      setLoading(false);
    }
    load();
  }, [recipeId]);

  const handleOpenRecipeLink = async (targetRecipeId: number) => {
    const target = await fetchRecipe(targetRecipeId);
    if (!target) return;
    const categories = await fetchCategories();
    const targetCategory = categories.find((c) => c.id === target.categoryId);
    onNavigate({
      type: "recipe-detail",
      categoryId: target.categoryId,
      categoryName: targetCategory?.name ?? "",
      recipeId: target.id,
    });
  };

  const handleSaveIterationDiff = async () => {
    if (recipe) {
      await updateIterationDifference(recipe.id, iterationDiff);
    }
  };

  const handleImageSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !recipe) return;

    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      await updateRecipeImage(recipe.id, dataUrl);
      setRecipe((prev) => (prev ? { ...prev, imageData: dataUrl } : prev));
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleRemoveImage = async () => {
    if (!recipe) return;
    await updateRecipeImage(recipe.id, null);
    setRecipe((prev) => (prev ? { ...prev, imageData: undefined } : prev));
  };

  const handleToggleFlag = async (field: FlagField, value: boolean) => {
    if (!recipe) return;
    await updateRecipeFlag(recipe.id, field, value);
    setRecipe((prev) => (prev ? { ...prev, [field]: value } : prev));
  };

  const handleCreateIteration = async () => {
    if (!recipe) return;
    setCreatingIteration(true);
    try {
      const newId = await createIteration(recipe.id);
      onNavigate({ type: "recipe-detail", categoryId, categoryName, recipeId: newId });
    } finally {
      setCreatingIteration(false);
    }
  };

  const startRename = () => {
    setNameDraft(recipe?.name ?? "");
    setEditingName(true);
  };

  const confirmRename = async () => {
    const trimmed = nameDraft.trim();
    setEditingName(false);
    if (recipe && trimmed && trimmed !== recipe.name) {
      await renameRecipe(recipe.id, trimmed);
      setRecipe((prev) => (prev ? { ...prev, name: trimmed } : prev));
    }
  };

  const cancelRename = () => {
    setEditingName(false);
  };

  if (loading) {
    return (
      <div className="page">
        <p className="page-text">Loading…</p>
      </div>
    );
  }

  if (!recipe) {
    return (
      <div className="page">
        <p className="page-text">Recipe not found.</p>
      </div>
    );
  }

  return (
    <div className="page">
      <Breadcrumb
        crumbs={[
          { label: "Recipes", onClick: () => onNavigate({ type: "recipes-home" }) },
          {
            label: categoryName,
            onClick: () =>
              onNavigate({ type: "recipes-category", categoryId, categoryName }),
          },
          { label: recipe.name },
        ]}
      />

      <div className="detail-header">
        {editingName ? (
          <input
            className="title-rename-input"
            autoFocus
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") confirmRename();
              if (e.key === "Escape") cancelRename();
            }}
            onBlur={confirmRename}
          />
        ) : (
          <h1 className="page-title" onDoubleClick={startRename} title="Double-click to rename">
            {recipe.name}
          </h1>
        )}
        <div className="detail-header-actions">
          <button
            className="icon-button"
            onClick={() => onNavigate({ type: "recipes-graph", categoryId, categoryName })}
            title="Open Web View"
          >
            <Icon iconKey="web-view" size={16} />
          </button>
          <div className="iterations-menu-wrapper">
            <button
              className="add-button secondary"
              onClick={() => setShowIterationsMenu((v) => !v)}
            >
              View Iterations ({iterations.length})
            </button>
            {showIterationsMenu && (
              <>
                <div className="menu-backdrop" onClick={() => setShowIterationsMenu(false)} />
                <div className="managed-row-dropdown iterations-dropdown">
                  {iterations.length === 0 ? (
                    <div className="dropdown-item dropdown-empty">No iterations yet</div>
                  ) : (
                    iterations.map((iter) => (
                      <button
                        key={iter.id}
                        className="dropdown-item"
                        onClick={() => {
                          setShowIterationsMenu(false);
                          onNavigate({
                            type: "recipe-detail",
                            categoryId,
                            categoryName,
                            recipeId: iter.id,
                          });
                        }}
                      >
                        {iter.name}
                      </button>
                    ))
                  )}
                </div>
              </>
            )}
          </div>
          <button className="add-button" onClick={handleCreateIteration} disabled={creatingIteration}>
            {creatingIteration ? "Creating…" : "Create Iteration"}
          </button>
        </div>
      </div>

      {parentRecipe && (
        <button
          className="parent-link"
          onClick={() =>
            onNavigate({
              type: "recipe-detail",
              categoryId,
              categoryName,
              recipeId: parentRecipe.id,
            })
          }
        >
          ← Iteration of "{parentRecipe.name}"
        </button>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={handleImageSelected}
      />

      {recipe.imageData ? (
        <div className="cover-image-wrapper">
          <img src={recipe.imageData} alt={recipe.name} className="cover-image" />
          <div className="cover-image-actions">
            <button className="add-button" onClick={() => fileInputRef.current?.click()}>
              Change
            </button>
            <button className="add-button danger" onClick={handleRemoveImage}>
              Remove
            </button>
          </div>
        </div>
      ) : (
        <button
          className="cover-image-placeholder"
          onClick={() => fileInputRef.current?.click()}
        >
          + Add cover image
        </button>
      )}

      <div className="recipe-flags">
        <label className="flag-checkbox">
          <input
            type="checkbox"
            checked={!!recipe.isProven}
            onChange={() => handleToggleFlag("isProven", true)}
          />
          Proven
        </label>
        <label className="flag-checkbox">
          <input
            type="checkbox"
            checked={!recipe.isProven}
            onChange={() => handleToggleFlag("isProven", false)}
          />
          Unproven
        </label>
        <label className="flag-checkbox">
          <input
            type="checkbox"
            checked={!!recipe.isFrozen}
            onChange={(e) => handleToggleFlag("isFrozen", e.target.checked)}
          />
          Frozen
        </label>
        <label className="flag-checkbox">
          <input
            type="checkbox"
            checked={!!recipe.isHomegrown}
            onChange={(e) => handleToggleFlag("isHomegrown", e.target.checked)}
          />
          Homegrown
        </label>
        <label className="flag-checkbox">
          <input
            type="checkbox"
            checked={!!recipe.isFavorite}
            onChange={(e) => handleToggleFlag("isFavorite", e.target.checked)}
          />
          Favorite
        </label>
      </div>

      {recipe.parentRecipeId && (
        <label className="iteration-diff-label">
          What's different in this iteration
          <input
            className="inline-add-input"
            value={iterationDiff}
            onChange={(e) => setIterationDiff(e.target.value)}
            onBlur={handleSaveIterationDiff}
            placeholder='e.g. "Used almond flour instead of wheat"'
          />
        </label>
      )}

      <RecipeEditor
        key={recipe.id}
        content={instructions}
        onChange={(html) => {
          setInstructions(html);
          updateRecipeInstructions(recipe.id, html);
        }}
        onOpenRecipeLink={handleOpenRecipeLink}
      />
    </div>
  );
}
