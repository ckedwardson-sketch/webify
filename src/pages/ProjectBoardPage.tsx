import React, { useEffect, useRef, useState } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { View } from "../types/nav";
import { ProjectBoardItem } from "../types/project";
import {
  fetchBoardItems,
  addTextBoardItem,
  addLinkBoardItem,
  addImageBoardItem,
  deleteBoardItem,
} from "../db/projects";
import { fetchAllRecipesFlat, fetchRecipe, RecipeLinkTarget } from "../db/recipes";
import { fetchCategories } from "../db/categories";
import "./Page.css";
import "../editor/RecipeEditor.css"; // reusing .link-popover / .link-mode-tabs / .link-search-input / etc.
import "./ProjectBoardPage.css";

export function ProjectBoardPage({
  widgetId,
  projectId,
  onNavigate,
}: {
  widgetId: number;
  projectId: number;
  onNavigate: (view: View) => void;
}) {
  const [items, setItems] = useState<ProjectBoardItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [addingText, setAddingText] = useState(false);
  const [textDraft, setTextDraft] = useState("");
  const [showLinkPicker, setShowLinkPicker] = useState(false);
  const [linkMode, setLinkMode] = useState<"recipe" | "url">("recipe");
  const [linkSearch, setLinkSearch] = useState("");
  const [linkUrlInput, setLinkUrlInput] = useState("");
  const [linkRecipes, setLinkRecipes] = useState<RecipeLinkTarget[]>([]);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    setItems(await fetchBoardItems(widgetId));
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [widgetId]);

  const openLinkPicker = async () => {
    setShowAddMenu(false);
    if (linkRecipes.length === 0) setLinkRecipes(await fetchAllRecipesFlat());
    setShowLinkPicker(true);
  };

  const handleAddTextItem = async () => {
    const text = textDraft.trim();
    if (!text) return;
    await addTextBoardItem(widgetId, text);
    setTextDraft("");
    setAddingText(false);
    await load();
  };

  const handlePickRecipeLink = async (target: RecipeLinkTarget) => {
    await addLinkBoardItem(widgetId, `app://recipe/${target.id}`, target.name);
    setShowLinkPicker(false);
    setLinkSearch("");
    await load();
  };

  const handleAddUrlLink = async () => {
    const url = linkUrlInput.trim();
    if (!url) return;
    await addLinkBoardItem(widgetId, url, url);
    setShowLinkPicker(false);
    setLinkUrlInput("");
    await load();
  };

  const handleImageSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      await addImageBoardItem(widgetId, reader.result as string);
      await load();
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleDeleteItem = async (id: number) => {
    if (!confirm("Remove this item from the board?")) return;
    await deleteBoardItem(id);
    await load();
  };

  const handleOpenLink = async (href: string) => {
    if (href.startsWith("app://recipe/")) {
      const id = parseInt(href.replace("app://recipe/", ""), 10);
      if (isNaN(id)) return;
      const target = await fetchRecipe(id);
      if (!target) return;
      const categories = await fetchCategories();
      const targetCategory = categories.find((c) => c.id === target.categoryId);
      onNavigate({
        type: "recipe-detail",
        categoryId: target.categoryId,
        categoryName: targetCategory?.name ?? "",
        recipeId: target.id,
      });
    } else {
      openUrl(href).catch(() => {});
    }
  };

  const filteredLinkRecipes = linkRecipes.filter((r) =>
    r.name.toLowerCase().includes(linkSearch.toLowerCase())
  );

  if (loading) {
    return (
      <div className="page">
        <p className="page-text">Loading…</p>
      </div>
    );
  }

  return (
    <div className="page project-board-page">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1 className="page-title">Board</h1>
        <div style={{ display: "flex", gap: 8, position: "relative" }}>
          <button
            className="add-button secondary"
            onClick={() => onNavigate({ type: "project-detail", projectId })}
          >
            ← Back to Project
          </button>
          <button className="add-button" onClick={() => setShowAddMenu((v) => !v)}>
            + Add
          </button>
          {showAddMenu && (
            <>
              <div className="menu-backdrop" onClick={() => setShowAddMenu(false)} />
              <div className="managed-row-dropdown" style={{ top: "100%", right: 0 }}>
                <button
                  className="dropdown-item"
                  onClick={() => {
                    setShowAddMenu(false);
                    setAddingText(true);
                  }}
                >
                  Text box
                </button>
                <button className="dropdown-item" onClick={openLinkPicker}>
                  Link
                </button>
                <button
                  className="dropdown-item"
                  onClick={() => {
                    setShowAddMenu(false);
                    imageInputRef.current?.click();
                  }}
                >
                  Image
                </button>
              </div>
            </>
          )}
          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={handleImageSelected}
          />
        </div>
      </div>

      {addingText && (
        <div className="journal-add-row">
          <textarea
            className="instructions-textarea"
            rows={3}
            placeholder="Text box content…"
            value={textDraft}
            onChange={(e) => setTextDraft(e.target.value)}
            autoFocus
          />
          <div style={{ display: "flex", gap: 8 }}>
            <button className="add-button" onClick={handleAddTextItem}>
              Add
            </button>
            <button className="add-button secondary" onClick={() => setAddingText(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {showLinkPicker && (
        <>
          <div className="menu-backdrop" onClick={() => setShowLinkPicker(false)} />
          <div
            className="toolbar-popover link-popover"
            style={{ position: "fixed", top: "20%", left: "50%", transform: "translateX(-50%)" }}
          >
            <div className="link-mode-tabs">
              <button className={linkMode === "recipe" ? "active" : ""} onClick={() => setLinkMode("recipe")}>
                Recipe
              </button>
              <button className={linkMode === "url" ? "active" : ""} onClick={() => setLinkMode("url")}>
                URL
              </button>
            </div>
            {linkMode === "recipe" ? (
              <>
                <input
                  className="link-search-input"
                  autoFocus
                  placeholder="Search recipes…"
                  value={linkSearch}
                  onChange={(e) => setLinkSearch(e.target.value)}
                />
                <div className="link-recipe-list">
                  {filteredLinkRecipes.length === 0 ? (
                    <div className="link-recipe-empty">No matches</div>
                  ) : (
                    filteredLinkRecipes.map((r) => (
                      <button key={r.id} className="link-recipe-item" onClick={() => handlePickRecipeLink(r)}>
                        <span className="link-recipe-name">{r.name}</span>
                        <span className="link-recipe-category">{r.categoryName}</span>
                      </button>
                    ))
                  )}
                </div>
              </>
            ) : (
              <>
                <input
                  className="link-search-input"
                  autoFocus
                  placeholder="https://…"
                  value={linkUrlInput}
                  onChange={(e) => setLinkUrlInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddUrlLink()}
                />
                <button className="link-insert-button" onClick={handleAddUrlLink}>
                  Add
                </button>
              </>
            )}
          </div>
        </>
      )}

      <div className="project-board-grid">
        {items.length === 0 && <p className="page-text">Nothing on this board yet.</p>}
        {items.map((item) => (
          <div key={item.id} className="project-board-item">
            <button className="project-board-item-delete" onClick={() => handleDeleteItem(item.id)}>
              ✕
            </button>
            {item.itemType === "text" && <div className="project-board-item-text">{item.textContent}</div>}
            {item.itemType === "image" && item.imageData && (
              <img src={item.imageData} alt="" className="project-board-item-image" />
            )}
            {item.itemType === "link" && (
              <button
                className="project-board-item-link"
                onClick={() => item.linkHref && handleOpenLink(item.linkHref)}
              >
                🔗 {item.linkLabel || item.linkHref}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
