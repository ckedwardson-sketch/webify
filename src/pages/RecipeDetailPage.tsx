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
  fetchAllRecipesFlat,
  updateRecipeInspiration,
  updateFutureSlotRecipeLinks,
  convertFutureSlotToRecipe,
  RecipeLinkTarget,
} from "../db/recipes";
import { fetchCategories } from "../db/categories";
import { RecipeEditor } from "../editor/RecipeEditor";
import { Icon } from "../icons/Icon";
import { Recipe } from "../types/models";
import { View } from "../types/nav";
import { Breadcrumb } from "../components/Breadcrumb";
import { usePageBackground, pageSurfaceStyle } from "../theme/PageBackgroundContext";
import "./Page.css";
import "./FutureSlot.css";
import "../components/ManagedListRow.css"; // reusing .managed-row-dropdown / .dropdown-item / .menu-backdrop

// SQLite's CURRENT_TIMESTAMP is UTC with no offset marker — append Z so
// the browser parses it as UTC instead of assuming local time.
function formatTimestamp(iso: string): string {
  const d = new Date(iso.replace(" ", "T") + "Z");
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

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
  const { overrides: pageBgOverrides } = usePageBackground();
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

  // Future Slot state
  const [allRecipes, setAllRecipes] = useState<RecipeLinkTarget[]>([]);
  const [inspiration, setInspiration] = useState("");
  const [inspirationExpanded, setInspirationExpanded] = useState(false);
  const [linkPickerOpen, setLinkPickerOpen] = useState(false);
  const [linkSearch, setLinkSearch] = useState("");
  const [converting, setConverting] = useState(false);
  const [originExpanded, setOriginExpanded] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const data = await fetchRecipe(recipeId);
      if (data) {
        setRecipe(data);
        setInstructions(data.instructions || "");
        setIterationDiff(data.iterationDifference || "");
        setInspiration(data.inspiration || "");
        setInspirationExpanded(!!data.inspiration);
        setParentRecipe(data.parentRecipeId ? await fetchRecipe(data.parentRecipeId) : null);
      }
      setIterations(await fetchIterations(recipeId));
      setAllRecipes(await fetchAllRecipesFlat());
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

  const handleSaveInspiration = async () => {
    if (recipe) {
      await updateRecipeInspiration(recipe.id, inspiration);
      setRecipe((prev) => (prev ? { ...prev, inspiration } : prev));
    }
  };

  const handleAddLink = async (targetId: number) => {
    if (!recipe) return;
    const next = [...(recipe.futureSlotRecipeLinks ?? []), targetId];
    await updateFutureSlotRecipeLinks(recipe.id, next);
    setRecipe((prev) => (prev ? { ...prev, futureSlotRecipeLinks: next } : prev));
    setLinkPickerOpen(false);
    setLinkSearch("");
  };

  const handleRemoveLink = async (targetId: number) => {
    if (!recipe) return;
    const next = (recipe.futureSlotRecipeLinks ?? []).filter((id) => id !== targetId);
    await updateFutureSlotRecipeLinks(recipe.id, next);
    setRecipe((prev) => (prev ? { ...prev, futureSlotRecipeLinks: next } : prev));
  };

  const handleConvertToRecipe = async () => {
    if (!recipe) return;
    setConverting(true);
    try {
      await convertFutureSlotToRecipe(recipe.id);
      setRecipe((prev) => (prev ? { ...prev, isFutureSlot: false, futureSlotOrigin: true } : prev));
    } finally {
      setConverting(false);
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

  const linkedIds = recipe.futureSlotRecipeLinks ?? [];
  const linkedRecipes = allRecipes.filter((r) => linkedIds.includes(r.id));
  const linkCandidates = allRecipes
    .filter((r) => r.id !== recipe.id && !linkedIds.includes(r.id))
    .filter((r) => r.name.toLowerCase().includes(linkSearch.trim().toLowerCase()))
    .slice(0, 20);
  // Stands out once it was ever a Future Slot, even after conversion —
  // the "still just a normal recipe, but with a glow" look.
  const showFutureSlotGlow = !recipe.isFutureSlot && !!recipe.futureSlotOrigin;

  return (
    <div
      className={`page${showFutureSlotGlow ? " recipe-future-slot-glow" : ""}`}
      data-color-surface="page-bg"
      style={pageSurfaceStyle(pageBgOverrides["page-bg"])}
    >
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
          {!recipe.isFutureSlot && (
            <>
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
            </>
          )}
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

      {recipe.isFutureSlot ? (
        <div className="future-slot-panel">
          <div className="future-slot-meta-row">
            <span className="future-slot-pill">
              <Icon iconKey="future-slot" size={13} /> Future Slot
            </span>
            {recipe.createdAt && (
              <span className="future-slot-date">Created {formatTimestamp(recipe.createdAt)}</span>
            )}
          </div>

          <div className="future-slot-section">
            <div className="future-slot-section-label">Recipe Links</div>
            <div className="future-slot-links-row">
              {linkedRecipes.map((r) => (
                <span key={r.id} className="future-slot-link-chip">
                  <button
                    className="future-slot-link-chip-label"
                    onClick={() => handleOpenRecipeLink(r.id)}
                  >
                    {r.name}
                  </button>
                  <button
                    className="future-slot-link-chip-remove"
                    onClick={() => handleRemoveLink(r.id)}
                    title="Remove link"
                  >
                    ×
                  </button>
                </span>
              ))}
              <div className="future-slot-add-link-wrapper">
                <button
                  className="future-slot-add-link-button"
                  onClick={() => setLinkPickerOpen((v) => !v)}
                >
                  + Add link
                </button>
                {linkPickerOpen && (
                  <>
                    <div className="menu-backdrop" onClick={() => setLinkPickerOpen(false)} />
                    <div className="managed-row-dropdown future-slot-link-picker">
                      <input
                        className="future-slot-link-search"
                        autoFocus
                        placeholder="Search recipes…"
                        value={linkSearch}
                        onChange={(e) => setLinkSearch(e.target.value)}
                      />
                      {linkCandidates.length === 0 ? (
                        <div className="dropdown-item dropdown-empty">No matches</div>
                      ) : (
                        linkCandidates.map((r) => (
                          <button
                            key={r.id}
                            className="dropdown-item"
                            onClick={() => handleAddLink(r.id)}
                          >
                            {r.name}{" "}
                            <span className="future-slot-link-category">— {r.categoryName}</span>
                          </button>
                        ))
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="future-slot-section">
            <button
              className="future-slot-inspiration-toggle"
              onClick={() => setInspirationExpanded((v) => !v)}
            >
              <span className="future-slot-toggle-caret">{inspirationExpanded ? "▾" : "▸"}</span>{" "}
              Inspiration
            </button>
            {inspirationExpanded && (
              <textarea
                className="future-slot-inspiration-box"
                value={inspiration}
                onChange={(e) => setInspiration(e.target.value)}
                onBlur={handleSaveInspiration}
                placeholder="What sparked this idea? A dish you had, an ingredient you want to use, a technique to try…"
              />
            )}
          </div>

          <div className="future-slot-main-editor">
            <RecipeEditor
              key={recipe.id}
              content={instructions}
              onChange={(html) => {
                setInstructions(html);
                updateRecipeInstructions(recipe.id, html);
              }}
              onOpenRecipeLink={handleOpenRecipeLink}
              onOpenNoteLink={(noteId) => onNavigate({ type: "notes", pageId: noteId })}
            />
          </div>

          <div className="future-slot-convert-row">
            <button
              className="future-slot-convert-button"
              onClick={handleConvertToRecipe}
              disabled={converting}
            >
              {converting ? "Converting…" : "Make it a Real Recipe"}
            </button>
          </div>
        </div>
      ) : (
        <>
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

          {recipe.futureSlotOrigin && (
            <div className="future-slot-origin-section">
              <button
                className="future-slot-origin-toggle"
                onClick={() => setOriginExpanded((v) => !v)}
              >
                <Icon iconKey="future-slot" size={13} />{" "}
                {originExpanded ? "Hide" : "Show"} planning notes
              </button>
              {originExpanded && (
                <div className="future-slot-origin-content">
                  {recipe.createdAt && (
                    <div className="future-slot-date">
                      Originally planned {formatTimestamp(recipe.createdAt)}
                    </div>
                  )}
                  {linkedRecipes.length > 0 && (
                    <div className="future-slot-links-row">
                      {linkedRecipes.map((r) => (
                        <button
                          key={r.id}
                          className="future-slot-link-chip-label future-slot-link-chip-readonly"
                          onClick={() => handleOpenRecipeLink(r.id)}
                        >
                          {r.name}
                        </button>
                      ))}
                    </div>
                  )}
                  {recipe.inspiration && (
                    <p className="future-slot-inspiration-readonly">{recipe.inspiration}</p>
                  )}
                </div>
              )}
            </div>
          )}

          <RecipeEditor
            key={recipe.id}
            content={instructions}
            onChange={(html) => {
              setInstructions(html);
              updateRecipeInstructions(recipe.id, html);
            }}
            onOpenRecipeLink={handleOpenRecipeLink}
            onOpenNoteLink={(noteId) => onNavigate({ type: "notes", pageId: noteId })}
          />
        </>
      )}
    </div>
  );
}
