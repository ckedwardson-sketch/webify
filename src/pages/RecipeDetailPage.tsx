// src/pages/RecipeDetailPage.tsx
import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import {
  fetchRecipe,
  updateRecipeInstructions,
  updateRecipeImage,
  updateRecipeFlag,
  createIteration,
  fetchIterations,
  updateIterationDifference,
  renameRecipe,
  updateRecipeInspiration,
  updateFutureSlotLinks,
  updateReferenceContent,
  convertFutureSlotToRecipe,
  updateRecipeEditorWidth,
} from "../db/recipes";
import { fetchCategories } from "../db/categories";
import { RecipeEditor } from "../editor/RecipeEditor";
import { Icon } from "../icons/Icon";
import { Recipe, FutureSlotLink } from "../types/models";
import { View } from "../types/nav";
import { Breadcrumb } from "../components/Breadcrumb";
import { usePageBackground, pageSurfaceStyle } from "../theme/PageBackgroundContext";
import { useTheme } from "../theme/ThemeContext";
import "./Page.css";
import "./FutureSlot.css";
import "./RecipeResize.css";
import "../components/ManagedListRow.css"; // reusing .managed-row-dropdown / .dropdown-item / .menu-backdrop

// SQLite's CURRENT_TIMESTAMP is UTC with no offset marker — append Z so
// the browser parses it as UTC instead of assuming local time.
function formatTimestamp(iso: string): string {
  const d = new Date(iso.replace(" ", "T") + "Z");
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

interface ExtractedRecipe {
  title: string;
  text: string;
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
  const { theme } = useTheme();
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
  const [inspiration, setInspiration] = useState("");
  const [inspirationExpanded, setInspirationExpanded] = useState(false);
  const [converting, setConverting] = useState(false);
  const [originExpanded, setOriginExpanded] = useState(false);

  // Recipe links (external URLs) + the dual-pane reference editor
  const [addingLink, setAddingLink] = useState(false);
  const [linkUrlDraft, setLinkUrlDraft] = useState("");
  const [activatingLinkId, setActivatingLinkId] = useState<string | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [referenceContent, setReferenceContent] = useState("");
  // "smart" dual-pane mode starts closed and only opens for this
  // session once a link is actually clicked — see themeDefaults.ts's
  // recipeDualPaneMode. "permanent"/"none" ignore this and just always
  // render split/single below.
  const [smartPaneOpen, setSmartPaneOpen] = useState(false);

  // User-draggable width (px) of this recipe's page/editor column on
  // desktop — null means "use the theme's default max-width". Persisted
  // per recipe (see updateRecipeEditorWidth) so each recipe remembers
  // its own preferred width.
  const [editorWidth, setEditorWidth] = useState<number | null>(null);
  const pageRef = useRef<HTMLDivElement>(null);

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
        setReferenceContent(data.referenceContent || "");
        setEditorWidth(data.editorWidth ?? null);
        setParentRecipe(data.parentRecipeId ? await fetchRecipe(data.parentRecipeId) : null);
      }
      setIterations(await fetchIterations(recipeId));
      setSmartPaneOpen(false);
      setLoading(false);
    }
    load();
  }, [recipeId]);

  // Drag-to-resize: grabbing the handle on the page's right edge widens
  // or narrows the whole page (title, flags, editor — everything), up to
  // however much blank space .app-content actually has, then saves the
  // result once the drag ends.
  const handleResizeStart = (e: React.MouseEvent) => {
    if (!pageRef.current || !recipe) return;
    e.preventDefault();
    const recipeId = recipe.id;
    const startX = e.clientX;
    const startWidth = pageRef.current.getBoundingClientRect().width;
    const parent = pageRef.current.parentElement;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    let finalWidth = startWidth;
    const onMove = (moveEvent: MouseEvent) => {
      const delta = moveEvent.clientX - startX;
      const maxWidth = parent ? parent.clientWidth : startWidth + delta;
      finalWidth = Math.round(Math.max(420, Math.min(maxWidth, startWidth + delta)));
      setEditorWidth(finalWidth);
    };
    const onUp = () => {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      updateRecipeEditorWidth(recipeId, finalWidth);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

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

  const handleAddLink = async () => {
    const raw = linkUrlDraft.trim();
    if (!recipe || !raw) {
      setAddingLink(false);
      return;
    }
    const url = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    const newLink: FutureSlotLink = { id: crypto.randomUUID(), url };
    const next = [...(recipe.futureSlotLinks ?? []), newLink];
    await updateFutureSlotLinks(recipe.id, next);
    setRecipe((prev) => (prev ? { ...prev, futureSlotLinks: next } : prev));
    setLinkUrlDraft("");
    setAddingLink(false);
  };

  const handleRemoveLink = async (linkId: string) => {
    if (!recipe) return;
    const next = (recipe.futureSlotLinks ?? []).filter((l) => l.id !== linkId);
    await updateFutureSlotLinks(recipe.id, next);
    setRecipe((prev) => (prev ? { ...prev, futureSlotLinks: next } : prev));
  };

  const handleOpenLinkInBrowser = (url: string) => {
    openUrl(url).catch(() => {});
  };

  // Fetches the link's page, pulls out its schema.org Recipe data (see
  // src-tauri/src/recipe_extract.rs), and hands the result to the
  // second column per theme.recipeLinkClickMode.
  const handleActivateLink = async (link: FutureSlotLink) => {
    if (!recipe) return;
    setLinkError(null);
    setActivatingLinkId(link.id);
    try {
      const extracted = await invoke<ExtractedRecipe>("fetch_recipe_from_url", { url: link.url });

      if (extracted.title && extracted.title !== link.title) {
        const nextLinks = (recipe.futureSlotLinks ?? []).map((l) =>
          l.id === link.id ? { ...l, title: extracted.title } : l
        );
        await updateFutureSlotLinks(recipe.id, nextLinks);
        setRecipe((prev) => (prev ? { ...prev, futureSlotLinks: nextLinks } : prev));
      }

      if (theme.recipeLinkClickMode === "copy") {
        try {
          await navigator.clipboard.writeText(extracted.text);
        } catch {
          // Clipboard access can be denied by the webview — extraction still succeeded either way.
        }
      } else if (theme.recipeLinkClickMode === "replace") {
        setReferenceContent(extracted.text);
        await updateReferenceContent(recipe.id, extracted.text);
        setRecipe((prev) => (prev ? { ...prev, referenceContent: extracted.text } : prev));
      } else {
        setReferenceContent((prev) => {
          const next = prev.trim() ? `${prev}\n\n———\n\n${extracted.text}` : extracted.text;
          updateReferenceContent(recipe.id, next);
          setRecipe((r) => (r ? { ...r, referenceContent: next } : r));
          return next;
        });
      }

      setSmartPaneOpen(true);
    } catch (err) {
      setLinkError(typeof err === "string" ? err : "Couldn't extract a recipe from that link.");
    } finally {
      setActivatingLinkId(null);
    }
  };

  const handleSaveReferenceContent = async () => {
    if (!recipe) return;
    await updateReferenceContent(recipe.id, referenceContent);
    setRecipe((prev) => (prev ? { ...prev, referenceContent } : prev));
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

  const futureSlotLinks = recipe.futureSlotLinks ?? [];
  // "permanent"/"none" ignore session state; "smart" only opens once a
  // link's been clicked this visit (see smartPaneOpen above).
  const dualPaneOpen =
    theme.recipeDualPaneMode === "permanent"
      ? true
      : theme.recipeDualPaneMode === "none"
      ? false
      : smartPaneOpen;
  // Stands out once it was ever a Future Slot, even after conversion —
  // the "still just a normal recipe, but with a glow" look.
  const showFutureSlotGlow = !recipe.isFutureSlot && !!recipe.futureSlotOrigin;

  return (
    <div
      ref={pageRef}
      className={`page${showFutureSlotGlow ? " recipe-future-slot-glow" : ""}`}
      data-color-surface="page-bg"
      style={{
        ...pageSurfaceStyle(pageBgOverrides["page-bg"]),
        ...(editorWidth ? { maxWidth: `${editorWidth}px` } : {}),
      }}
    >
      <div
        className="recipe-width-handle"
        onMouseDown={handleResizeStart}
        title="Drag to resize this recipe's width"
      />
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
              {futureSlotLinks.map((link) => (
                <span key={link.id} className="future-slot-link-chip">
                  <button
                    className="future-slot-link-chip-open"
                    onClick={() => handleOpenLinkInBrowser(link.url)}
                    title="Open the original page"
                  >
                    <Icon iconKey="open-external" size={11} />
                  </button>
                  <button
                    className="future-slot-link-chip-label"
                    onClick={() => handleActivateLink(link)}
                    disabled={activatingLinkId === link.id}
                    title={link.url}
                  >
                    {activatingLinkId === link.id ? "Pulling…" : link.title || hostnameOf(link.url)}
                  </button>
                  <button
                    className="future-slot-link-chip-remove"
                    onClick={() => handleRemoveLink(link.id)}
                    title="Remove link"
                  >
                    ×
                  </button>
                </span>
              ))}
              {addingLink ? (
                <input
                  className="future-slot-link-url-input"
                  autoFocus
                  placeholder="Paste a recipe URL…"
                  value={linkUrlDraft}
                  onChange={(e) => setLinkUrlDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleAddLink();
                    if (e.key === "Escape") {
                      setLinkUrlDraft("");
                      setAddingLink(false);
                    }
                  }}
                  onBlur={handleAddLink}
                />
              ) : (
                <button className="future-slot-add-link-button" onClick={() => setAddingLink(true)}>
                  + Add link
                </button>
              )}
            </div>
            {linkError && <div className="future-slot-link-error">{linkError}</div>}
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

          <div className={`future-slot-editor-grid${dualPaneOpen ? " future-slot-editor-grid--split" : ""}`}>
            <div className="future-slot-editor-main future-slot-main-editor">
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
            <div className="future-slot-editor-reference">
              <div className="future-slot-section-label">Recipe Reference</div>
              <textarea
                className="future-slot-reference-box"
                value={referenceContent}
                onChange={(e) => setReferenceContent(e.target.value)}
                onBlur={handleSaveReferenceContent}
                placeholder="Click a recipe link above to pull its recipe in here…"
              />
            </div>
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
                  {futureSlotLinks.length > 0 && (
                    <div className="future-slot-links-row">
                      {futureSlotLinks.map((link) => (
                        <button
                          key={link.id}
                          className="future-slot-link-chip-label future-slot-link-chip-readonly"
                          onClick={() => handleOpenLinkInBrowser(link.url)}
                          title={link.url}
                        >
                          {link.title || hostnameOf(link.url)}
                        </button>
                      ))}
                    </div>
                  )}
                  {recipe.inspiration && (
                    <p className="future-slot-inspiration-readonly">{recipe.inspiration}</p>
                  )}
                  {recipe.referenceContent && (
                    <p className="future-slot-inspiration-readonly">{recipe.referenceContent}</p>
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
