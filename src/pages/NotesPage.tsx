import React, { useEffect, useMemo, useRef, useState } from "react";
import { View } from "../types/nav";
import { NotePage } from "../types/notes";
import { Category } from "../types/models";
import {
  fetchAllPages,
  fetchAllCategories,
  addPage,
  deletePage,
  updatePageTitle,
  updatePageIcon,
  updatePageContent,
  updatePageCategory,
  updatePageParent,
  reorderPages,
} from "../db/notes";
import { NoteContentEditor } from "../editor/NoteContentEditor";
import { fetchRecipe, addRecipe, updateRecipeInstructions } from "../db/recipes";
import { fetchCategories, addCategory } from "../db/categories";
import { NOTE_ICON_CHOICES } from "../notes/iconChoices";
import { extractDocsFromFiles } from "../notes/notionImport";
import { ContextMenu, ContextMenuSection } from "../components/ContextMenu";
import "../components/ManagedListRow.css"; // reusing .menu-backdrop
import { usePageBackground, pageSurfaceStyle } from "../theme/PageBackgroundContext";
import { useTheme } from "../theme/ThemeContext";
import { useUiPreferences } from "../context/UiPreferencesContext";
import "./Page.css";
import "./NotesPage.css";

const NEW_CATEGORY_SENTINEL = "__new__";

// Manual hit-testing for the notes-tree drag (pointer-capture based, not
// native HTML5 DnD — see ManagedListRow/hooks/dragReorder for the same
// convention elsewhere in the app). `.closest` walks up from whatever's
// physically under the pointer, so hovering any row inside a category
// still resolves to that category as the drop target.
function categoryAtPoint(x: number, y: number): string | null {
  const el = document.elementFromPoint(x, y);
  return el?.closest<HTMLElement>("[data-category-drop]")?.dataset.categoryDrop ?? null;
}

// Same convention as categoryAtPoint, for dropping onto another row to
// reorder relative to it (as opposed to dropping on a category header,
// which moves category instead).
function rowIdAtPoint(x: number, y: number): number | null {
  const el = document.elementFromPoint(x, y);
  const raw = el?.closest<HTMLElement>("[data-row-drop]")?.dataset.rowDrop;
  return raw !== undefined ? Number(raw) : null;
}

const LONG_PRESS_MS = 500;

export function NotesPage({
  pageId,
  onNavigate,
  onEnterDualPane,
  dualPaneActive = false,
  treeOnly = false,
}: {
  pageId?: number;
  onNavigate: (view: View) => void;
  onEnterDualPane?: () => void;
  dualPaneActive?: boolean;
  treeOnly?: boolean;
}) {
  const { overrides: pageBgOverrides } = usePageBackground();
  const { theme } = useTheme();
  const [pages, setPages] = useState<NotePage[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [newCategoryDraft, setNewCategoryDraft] = useState("");
  const [creating, setCreating] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [showIconPicker, setShowIconPicker] = useState(false);

  // Transmogify — pick one or more notes here, then a recipe category,
  // without deleting the source note(s).
  const [transmogifyMode, setTransmogifyMode] = useState(false);
  const [selectedNoteIds, setSelectedNoteIds] = useState<Set<number>>(new Set());
  const [categoryMenu, setCategoryMenu] = useState<{ x: number; y: number } | null>(null);
  const [recipeCategories, setRecipeCategories] = useState<Category[]>([]);
  const [transmogifying, setTransmogifying] = useState(false);
  const [transmogifyStatus, setTransmogifyStatus] = useState<string | null>(null);

  // Notion import — .md/.html/.csv files, or a .zip bundling them.
  const importInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);

  // Move-to-category / reorder — the drag handle, the "📂" dropdown, and
  // multi-select (shift-click / long-press, below) all land here.
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [dragOverCategory, setDragOverCategory] = useState<string | null>(null);
  const [dragOverRowId, setDragOverRowId] = useState<number | null>(null);
  const draggingIdRef = useRef<number | null>(null);
  const dragOverCategoryRef = useRef<string | null>(null);
  const dragOverRowIdRef = useRef<number | null>(null);
  const [moveMenu, setMoveMenu] = useState<{ pageId: number; x: number; y: number } | null>(null);

  // Collapsible category groups — plain in-memory state, same convention
  // as `expanded` above. Persisted only when the "Remember expanded
  // notes folders" master toggle (Settings > Panel & Layout Memory) is
  // on — see the restore/save effects below.
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());

  const { preferences: uiPreferences, setPreference: setUiPreference } = useUiPreferences();
  const notesTreeRemember = uiPreferences["notesTreeRemember"] === "1";
  const restoredTreeStateRef = useRef(false);

  // Multi-select (shift-click range / long-press to toggle) + drag the
  // whole selection to reorder or move category. Independent of
  // transmogify's own selection, which is a separate bulk-action mode.
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [selectionAnchor, setSelectionAnchor] = useState<number | null>(null);

  const load = () => {
    Promise.all([fetchAllPages(), fetchAllCategories()]).then(([p, c]) => {
      setPages(p);
      setCategories(c);
      setLoading(false);
    });
  };

  useEffect(load, []);

  const pageById = useMemo(() => new Map(pages.map((p) => [p.id, p])), [pages]);
  const childrenOf = useMemo(() => {
    const map = new Map<number | null, NotePage[]>();
    for (const p of pages) {
      const list = map.get(p.parentId) ?? [];
      list.push(p);
      map.set(p.parentId, list);
    }
    // "manual" (default) leaves fetch order (sortOrder) untouched. The
    // other modes re-sort each parent's children in place — this runs
    // before pages get bucketed by category below, so it applies evenly
    // to top-level pages and nested children alike.
    const sortOrder = theme.notesSortOrder;
    if (sortOrder && sortOrder !== "manual") {
      const compare: (a: NotePage, b: NotePage) => number =
        sortOrder === "name"
          ? (a, b) => a.title.localeCompare(b.title)
          : sortOrder === "created"
          ? (a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? "")
          : (a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? "");
      for (const list of map.values()) list.sort(compare);
    }
    return map;
  }, [pages, theme.notesSortOrder]);

  // Flat, visually-ordered list of every currently-visible row id
  // (categories in their rendered order, each top-level page then its
  // expanded children) — used to resolve a shift-click range.
  const visibleOrder = useMemo(() => {
    const order: number[] = [];
    const topLevelByCat = new Map<string, NotePage[]>();
    for (const p of childrenOf.get(null) ?? []) {
      const list = topLevelByCat.get(p.category) ?? [];
      list.push(p);
      topLevelByCat.set(p.category, list);
    }
    const walk = (p: NotePage) => {
      order.push(p.id);
      if (expanded.has(p.id)) {
        for (const child of childrenOf.get(p.id) ?? []) walk(child);
      }
    };
    for (const [category, catPages] of topLevelByCat) {
      if (collapsedCategories.has(category)) continue;
      for (const p of catPages) walk(p);
    }
    return order;
  }, [childrenOf, expanded, collapsedCategories]);

  const selected = pageId !== undefined ? pageById.get(pageId) ?? null : null;

  useEffect(() => {
    setTitleDraft(selected?.title ?? "");
    setEditingTitle(false);
  }, [selected?.id]);

  // Auto-reveal the ancestor chain of whichever page is selected, so
  // deep-linking (or just navigating back here) doesn't land on a
  // collapsed, hidden row.
  useEffect(() => {
    if (!selected) return;
    setExpanded((prev) => {
      const next = new Set(prev);
      let cur: NotePage | undefined = selected;
      while (cur && cur.parentId !== null) {
        next.add(cur.parentId);
        cur = pageById.get(cur.parentId);
      }
      return next;
    });
  }, [selected, pageById]);

  const toggleExpanded = (id: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleCategoryCollapsed = (category: string) => {
    setCollapsedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });
  };

  // Restore the persisted expand/collapse state once, the first time
  // the master toggle is (or becomes) on — guarded so it doesn't
  // clobber in-session changes on every ui_preferences refresh.
  useEffect(() => {
    if (!notesTreeRemember || restoredTreeStateRef.current) return;
    restoredTreeStateRef.current = true;
    const raw = uiPreferences["notesTreeExpandedState"];
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as { expandedIds?: number[]; collapsedCategories?: string[] };
      if (Array.isArray(parsed.expandedIds)) setExpanded(new Set(parsed.expandedIds));
      if (Array.isArray(parsed.collapsedCategories)) setCollapsedCategories(new Set(parsed.collapsedCategories));
    } catch (err) {
      console.warn("Failed to parse stored notes tree expand-state:", err);
    }
  }, [notesTreeRemember, uiPreferences]);

  // Persist the actual expand/collapse state, debounced, only while the
  // master toggle is on — when it's off this is a no-op and behavior is
  // exactly as before (in-memory only, reset every mount).
  useEffect(() => {
    if (!notesTreeRemember) return;
    const timer = setTimeout(() => {
      const blob = JSON.stringify({
        expandedIds: Array.from(expanded),
        collapsedCategories: Array.from(collapsedCategories),
      });
      setUiPreference("notesTreeExpandedState", blob).catch((err) =>
        console.warn("Failed to persist notes tree expand-state:", err)
      );
    }, 500);
    return () => clearTimeout(timer);
  }, [notesTreeRemember, expanded, collapsedCategories, setUiPreference]);

  const startAddForm = () => {
    setNewTitle("");
    setNewCategory(categories[0] ?? NEW_CATEGORY_SENTINEL);
    setNewCategoryDraft("");
    setShowAddForm(true);
  };

  const confirmAdd = async () => {
    const category = newCategory === NEW_CATEGORY_SENTINEL ? newCategoryDraft.trim() || "General" : newCategory;
    setCreating(true);
    try {
      const id = await addPage(null, category, newTitle.trim() || "Untitled");
      setShowAddForm(false);
      load();
      onNavigate({ type: "notes", pageId: id });
    } finally {
      setCreating(false);
    }
  };

  const addChildPage = async (parent: NotePage) => {
    const id = await addPage(parent.id, parent.category, "Untitled");
    setExpanded((prev) => new Set(prev).add(parent.id));
    load();
    onNavigate({ type: "notes", pageId: id });
  };

  const handleDeletePage = async (page: NotePage) => {
    if (!confirm(`Delete "${page.title || "Untitled"}"? Any sub-pages go with it.`)) return;
    await deletePage(page.id);
    if (selected && (selected.id === page.id || isDescendantOf(selected.id, page.id, pages))) {
      onNavigate({ type: "notes" });
    }
    load();
  };

  const confirmRenameTitle = async () => {
    const trimmed = titleDraft.trim();
    setEditingTitle(false);
    if (!selected || !trimmed || trimmed === selected.title) return;
    await updatePageTitle(selected.id, trimmed);
    setPages((prev) => prev.map((p) => (p.id === selected.id ? { ...p, title: trimmed } : p)));
  };

  const handleOpenRecipeLink = async (recipeId: number) => {
    const target = await fetchRecipe(recipeId);
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

  const pickIcon = async (icon: string) => {
    if (!selected) return;
    setShowIconPicker(false);
    setPages((prev) => prev.map((p) => (p.id === selected.id ? { ...p, icon } : p)));
    await updatePageIcon(selected.id, icon);
  };

  // Moving to a new category only means something at the top level —
  // nested pages are grouped under their parent, not their own category
  // header — so a cross-category move also promotes the page to the top.
  const moveNoteToCategory = async (id: number, category: string) => {
    const note = pageById.get(id);
    if (!note || (note.category === category && note.parentId === null)) return;
    await updatePageCategory(id, category);
    if (note.parentId !== null) await updatePageParent(id, null);
    load();
  };

  // All pages sharing a reorder scope (siblings under the same parent,
  // or — at the top level — the same category), in their current
  // sort_order — i.e. exactly the array reorderPages() needs once
  // spliced into a new order.
  const scopeSiblings = (parentId: number | null, category: string): NotePage[] =>
    pages.filter((p) => p.parentId === parentId && (parentId !== null || p.category === category));

  const handleRowDragStart = (id: number) => {
    draggingIdRef.current = id;
    setDraggingId(id);
    // Starting a drag from a row that's part of the current selection
    // drags the whole selection; otherwise it's just this one row (and
    // any stale selection is cleared so it doesn't linger unexpectedly).
    if (!selectedIds.has(id)) {
      setSelectedIds(new Set());
      setSelectionAnchor(null);
    }
  };

  const handleRowDragOverCategory = (category: string | null) => {
    dragOverCategoryRef.current = category;
    setDragOverCategory(category);
    if (category !== null) {
      dragOverRowIdRef.current = null;
      setDragOverRowId(null);
    }
  };

  const handleRowDragOverRow = (rowId: number | null) => {
    dragOverRowIdRef.current = rowId;
    setDragOverRowId(rowId);
    if (rowId !== null) {
      dragOverCategoryRef.current = null;
      setDragOverCategory(null);
    }
  };

  const handleRowDragEnd = async () => {
    const draggedId = draggingIdRef.current;
    const category = dragOverCategoryRef.current;
    const targetRowId = dragOverRowIdRef.current;
    draggingIdRef.current = null;
    dragOverCategoryRef.current = null;
    dragOverRowIdRef.current = null;
    setDraggingId(null);
    setDragOverCategory(null);
    setDragOverRowId(null);
    if (draggedId === null) return;

    const ids = selectedIds.has(draggedId) ? Array.from(selectedIds) : [draggedId];

    if (category !== null) {
      for (const id of ids) await moveNoteToCategory(id, category);
      setSelectedIds(new Set());
      setSelectionAnchor(null);
      return;
    }

    if (targetRowId !== null && !ids.includes(targetRowId)) {
      const target = pageById.get(targetRowId);
      if (target) {
        const sameScope = ids.every((id) => {
          const p = pageById.get(id);
          return p && p.parentId === target.parentId && (target.parentId !== null || p.category === target.category);
        });
        if (sameScope) {
          const siblings = scopeSiblings(target.parentId, target.category);
          const remaining = siblings.filter((p) => !ids.includes(p.id));
          const targetIdx = remaining.findIndex((p) => p.id === targetRowId);
          const insertAt = targetIdx === -1 ? remaining.length : targetIdx;
          const finalOrder = [
            ...remaining.slice(0, insertAt).map((p) => p.id),
            ...ids,
            ...remaining.slice(insertAt).map((p) => p.id),
          ];
          await reorderPages(finalOrder);
        } else {
          for (const id of ids) {
            await updatePageCategory(id, target.category);
            await updatePageParent(id, target.parentId);
          }
        }
        load();
      }
      setSelectedIds(new Set());
      setSelectionAnchor(null);
    }
  };

  const openMoveMenu = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setMoveMenu({ pageId: id, x: e.clientX, y: e.clientY });
  };

  // Plain click opens the note and drops any selection. Shift-click
  // extends/creates a range from the last anchor to this row without
  // opening it (standard file-explorer-style range select). Long-press
  // (touch) toggles just this row into the selection — see
  // NoteTreeRow's onPointerDown/onPointerUp below.
  const handleRowClick = (id: number, shiftKey: boolean) => {
    if (shiftKey && selectionAnchor !== null) {
      const from = visibleOrder.indexOf(selectionAnchor);
      const to = visibleOrder.indexOf(id);
      if (from !== -1 && to !== -1) {
        const [lo, hi] = from < to ? [from, to] : [to, from];
        setSelectedIds(new Set(visibleOrder.slice(lo, hi + 1)));
        return;
      }
    }
    if (shiftKey) {
      setSelectionAnchor(id);
      setSelectedIds(new Set([id]));
      return;
    }
    setSelectedIds(new Set());
    setSelectionAnchor(null);
    onNavigate({ type: "notes", pageId: id });
  };

  const handleRowLongPressToggle = (id: number) => {
    setSelectionAnchor(id);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const moveMenuSections: ContextMenuSection[] = moveMenu
    ? [
        {
          label: "Move to category",
          items: [
            ...categories.map((c) => ({
              key: c,
              label: c,
              onSelect: () => {
                moveNoteToCategory(moveMenu.pageId, c);
                setMoveMenu(null);
              },
            })),
            {
              key: NEW_CATEGORY_SENTINEL,
              label: "+ New category…",
              onSelect: async () => {
                const name = window.prompt("New category name:");
                const trimmed = name?.trim();
                setMoveMenu(null);
                if (trimmed) await moveNoteToCategory(moveMenu.pageId, trimmed);
              },
            },
          ],
        },
      ]
    : [];

  const startTransmogify = () => {
    setTransmogifyMode(true);
    setSelectedNoteIds(new Set());
    setTransmogifyStatus(null);
  };

  const cancelTransmogify = () => {
    setTransmogifyMode(false);
    setSelectedNoteIds(new Set());
    setCategoryMenu(null);
  };

  const toggleNoteSelected = (id: number) => {
    setSelectedNoteIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const openCategoryPicker = async (e: React.MouseEvent) => {
    if (selectedNoteIds.size === 0) return;
    const cats = await fetchCategories();
    setRecipeCategories(cats);
    setCategoryMenu({ x: e.clientX, y: e.clientY });
  };

  const runTransmogify = async (categoryId: number, categoryName: string) => {
    setCategoryMenu(null);
    setTransmogifying(true);
    try {
      const notes = Array.from(selectedNoteIds)
        .map((id) => pageById.get(id))
        .filter((n): n is NotePage => !!n);
      for (const note of notes) {
        const recipeId = await addRecipe(categoryId, note.title || "Untitled");
        await updateRecipeInstructions(recipeId, note.content);
      }
      setTransmogifyStatus(
        `Created ${notes.length} recipe${notes.length === 1 ? "" : "s"} in "${categoryName}" — original note${
          notes.length === 1 ? "" : "s"
        } kept as-is.`
      );
      setTransmogifyMode(false);
      setSelectedNoteIds(new Set());
    } finally {
      setTransmogifying(false);
    }
  };

  const pickNewCategoryAndTransmogify = async () => {
    const name = window.prompt("New recipe category name:");
    const trimmed = name?.trim();
    if (!trimmed) return;
    await addCategory(trimmed);
    const cats = await fetchCategories();
    const created = cats.find((c) => c.name === trimmed) ?? cats[cats.length - 1];
    if (created) await runTransmogify(created.id, created.name);
  };

  const categoryMenuSections: ContextMenuSection[] = [
    {
      label: "Send to category",
      items: [
        ...recipeCategories.map((c) => ({
          key: String(c.id),
          label: c.name,
          onSelect: () => runTransmogify(c.id, c.name),
        })),
        {
          key: NEW_CATEGORY_SENTINEL,
          label: "+ New category…",
          onSelect: pickNewCategoryAndTransmogify,
        },
      ],
    },
  ];

  const triggerImport = () => importInputRef.current?.click();

  const handleImportFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setImporting(true);
    setImportStatus(null);
    try {
      const docs = await extractDocsFromFiles(files);
      for (const doc of docs) {
        const id = await addPage(null, "Imported", doc.title);
        await updatePageContent(id, doc.html);
      }
      load();
      setImportStatus(
        docs.length > 0
          ? `Imported ${docs.length} note${docs.length === 1 ? "" : "s"} from Notion into "Imported".`
          : "No .md/.html/.csv files were found in that selection."
      );
    } catch (err) {
      console.error("Notion import failed:", err);
      setImportStatus("Import failed — check the console for details.");
    } finally {
      setImporting(false);
      e.target.value = "";
    }
  };

  if (loading) {
    return (
      <div className="page">
        <p className="page-text">Loading…</p>
      </div>
    );
  }

  const topLevelByCategory = new Map<string, NotePage[]>();
  for (const p of childrenOf.get(null) ?? []) {
    const list = topLevelByCategory.get(p.category) ?? [];
    list.push(p);
    topLevelByCategory.set(p.category, list);
  }

  return (
    <div
      className={`notes-shell${treeOnly ? " notes-tree-only" : ""}`}
      data-color-surface="page-bg"
      style={pageSurfaceStyle(pageBgOverrides["page-bg"])}
    >
      <aside className="notes-tree">
        <div className="notes-tree-header">
          <h2 className="notes-tree-title">Notes</h2>
          <button className="icon-button" onClick={startAddForm} title="New page">
            +
          </button>
        </div>

        <div className="notes-tree-toolbar">
          {!transmogifyMode ? (
            <>
              <button className="notes-tool-btn" onClick={startTransmogify} title="Pick notes to turn into recipes">
                🍳 Transmogify
              </button>
              {!dualPaneActive && onEnterDualPane && (
                <button className="notes-tool-btn" onClick={onEnterDualPane} title="Split screen: notes list + any page">
                  ⛶ Multi-pane
                </button>
              )}
              <button className="notes-tool-btn" onClick={triggerImport} disabled={importing} title="Import Notion export (.md, .html, .csv, or .zip)">
                {importing ? "Importing…" : "⇩ Import Notion"}
              </button>
              <input
                ref={importInputRef}
                type="file"
                multiple
                accept=".md,.markdown,.html,.htm,.csv,.zip"
                style={{ display: "none" }}
                onChange={handleImportFiles}
              />
            </>
          ) : (
            <>
              <span className="notes-tool-status">{selectedNoteIds.size} selected</span>
              <button
                className="notes-tool-btn"
                disabled={selectedNoteIds.size === 0 || transmogifying}
                onClick={openCategoryPicker}
              >
                {transmogifying ? "Creating…" : "Create Recipe"}
              </button>
              <button className="notes-tool-btn secondary" onClick={cancelTransmogify}>
                Cancel
              </button>
            </>
          )}
        </div>
        {(transmogifyStatus || importStatus) && (
          <div className="notes-tool-status-banner">{transmogifyStatus || importStatus}</div>
        )}
        {categoryMenu && <ContextMenu x={categoryMenu.x} y={categoryMenu.y} sections={categoryMenuSections} onClose={() => setCategoryMenu(null)} />}
        {moveMenu && <ContextMenu x={moveMenu.x} y={moveMenu.y} sections={moveMenuSections} onClose={() => setMoveMenu(null)} />}

        {showAddForm && (
          <div className="notes-add-form">
            <input
              className="inline-add-input"
              autoFocus
              placeholder="Page title"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && newCategory !== NEW_CATEGORY_SENTINEL && confirmAdd()}
            />
            <select className="inline-add-input" value={newCategory} onChange={(e) => setNewCategory(e.target.value)}>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
              <option value={NEW_CATEGORY_SENTINEL}>+ New category…</option>
            </select>
            {newCategory === NEW_CATEGORY_SENTINEL && (
              <input
                className="inline-add-input"
                autoFocus={categories.length === 0}
                placeholder="Category name"
                value={newCategoryDraft}
                onChange={(e) => setNewCategoryDraft(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && confirmAdd()}
              />
            )}
            <div className="notes-add-form-actions">
              <button className="add-button secondary" onClick={() => setShowAddForm(false)}>
                Cancel
              </button>
              <button className="add-button" onClick={confirmAdd} disabled={creating}>
                {creating ? "Adding…" : "Add"}
              </button>
            </div>
          </div>
        )}

        {topLevelByCategory.size === 0 ? (
          <p className="page-text notes-tree-empty">No pages yet — use "+" to start one.</p>
        ) : (
          Array.from(topLevelByCategory.entries()).map(([category, catPages]) => {
            const isCollapsed = collapsedCategories.has(category);
            return (
              <div
                key={category}
                className={`notes-tree-category${dragOverCategory === category ? " notes-tree-category-drop-target" : ""}`}
                data-category-drop={category}
              >
                <button className="notes-tree-category-title" onClick={() => toggleCategoryCollapsed(category)}>
                  <span className="notes-tree-category-caret">{isCollapsed ? "▸" : "▾"}</span>
                  {category}
                </button>
                {!isCollapsed &&
                  catPages.map((p) => (
                    <NoteTreeRow
                      key={p.id}
                      page={p}
                      depth={0}
                      childrenOf={childrenOf}
                      expanded={expanded}
                      selectedId={pageId}
                      onToggleExpanded={toggleExpanded}
                      onSelect={handleRowClick}
                      onLongPressToggle={handleRowLongPressToggle}
                      onAddChild={addChildPage}
                      onDelete={handleDeletePage}
                      transmogifyMode={transmogifyMode}
                      selectedNoteIds={selectedNoteIds}
                      onToggleSelected={toggleNoteSelected}
                      multiSelectedIds={selectedIds}
                      draggingId={draggingId}
                      draggingSelectedIds={selectedIds}
                      dragOverRowId={dragOverRowId}
                      onRowDragStart={handleRowDragStart}
                      onRowDragOverCategory={handleRowDragOverCategory}
                      onRowDragOverRow={handleRowDragOverRow}
                      onRowDragEnd={handleRowDragEnd}
                      onOpenMoveMenu={openMoveMenu}
                    />
                  ))}
              </div>
            );
          })
        )}
      </aside>

      {!treeOnly && (
      <div className="notes-editor-pane">
        {!selected ? (
          <div className="notes-empty-state">
            <p className="page-text">Select a page on the left, or create a new one.</p>
          </div>
        ) : (
          <div className="notes-editor-scroll">
            <div className="notes-editor-header">
              <div className="notes-icon-picker-wrapper">
                <button className="notes-icon-button" onClick={() => setShowIconPicker((v) => !v)}>
                  {selected.icon}
                </button>
                {showIconPicker && (
                  <>
                    <div className="menu-backdrop" onClick={() => setShowIconPicker(false)} />
                    <div className="notes-icon-grid">
                      {NOTE_ICON_CHOICES.map((icon) => (
                        <button key={icon} className="notes-icon-choice" onClick={() => pickIcon(icon)}>
                          {icon}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
              {editingTitle ? (
                <input
                  className="notes-title-input"
                  autoFocus
                  value={titleDraft}
                  onChange={(e) => setTitleDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") confirmRenameTitle();
                    if (e.key === "Escape") setEditingTitle(false);
                  }}
                  onBlur={confirmRenameTitle}
                />
              ) : (
                <h1
                  className="notes-title"
                  onDoubleClick={() => {
                    setTitleDraft(selected.title);
                    setEditingTitle(true);
                  }}
                  title="Double-click to rename"
                >
                  {selected.title || "Untitled"}
                </h1>
              )}
            </div>
            <NoteContentEditor
              key={selected.id}
              content={selected.content}
              onChange={(html) => updatePageContent(selected.id, html)}
              onOpenNoteLink={(id) => onNavigate({ type: "notes", pageId: id })}
              onOpenRecipeLink={handleOpenRecipeLink}
            />
          </div>
        )}
      </div>
      )}
    </div>
  );
}

function isDescendantOf(candidateId: number, ancestorId: number, pages: NotePage[]): boolean {
  const byId = new Map(pages.map((p) => [p.id, p]));
  let cur = byId.get(candidateId);
  while (cur && cur.parentId !== null) {
    if (cur.parentId === ancestorId) return true;
    cur = byId.get(cur.parentId);
  }
  return false;
}

function NoteTreeRow({
  page,
  depth,
  childrenOf,
  expanded,
  selectedId,
  onToggleExpanded,
  onSelect,
  onLongPressToggle,
  onAddChild,
  onDelete,
  transmogifyMode = false,
  selectedNoteIds,
  onToggleSelected,
  multiSelectedIds,
  draggingId = null,
  draggingSelectedIds,
  dragOverRowId = null,
  onRowDragStart,
  onRowDragOverCategory,
  onRowDragOverRow,
  onRowDragEnd,
  onOpenMoveMenu,
}: {
  page: NotePage;
  depth: number;
  childrenOf: Map<number | null, NotePage[]>;
  expanded: Set<number>;
  selectedId: number | undefined;
  onToggleExpanded: (id: number) => void;
  onSelect: (id: number, shiftKey: boolean) => void;
  onLongPressToggle?: (id: number) => void;
  onAddChild: (page: NotePage) => void;
  onDelete: (page: NotePage) => void;
  transmogifyMode?: boolean;
  selectedNoteIds?: Set<number>;
  onToggleSelected?: (id: number) => void;
  multiSelectedIds?: Set<number>;
  draggingId?: number | null;
  draggingSelectedIds?: Set<number>;
  dragOverRowId?: number | null;
  onRowDragStart?: (id: number) => void;
  onRowDragOverCategory?: (category: string | null) => void;
  onRowDragOverRow?: (id: number | null) => void;
  onRowDragEnd?: () => void;
  onOpenMoveMenu?: (id: number, e: React.MouseEvent) => void;
}) {
  const kids = childrenOf.get(page.id) ?? [];
  const isExpanded = expanded.has(page.id);
  const isPicked = transmogifyMode && (selectedNoteIds?.has(page.id) ?? false);
  const isMultiSelected = multiSelectedIds?.has(page.id) ?? false;
  const isDragSource =
    draggingId === page.id || (draggingId !== null && (draggingSelectedIds?.has(draggingId) ?? false) && isMultiSelected);
  const isRowDropTarget = dragOverRowId === page.id;
  const longPressTimer = useRef<number | null>(null);

  // Pointer-capture drag (mirrors ManagedListRow's convention, not
  // native HTML5 DnD) — reports whichever of category-header / another
  // row is currently under the pointer up to NotesPage, which resolves
  // the drop on pointer-up.
  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button !== undefined && e.button !== 0 && e.pointerType === "mouse") return;
    e.currentTarget.setPointerCapture(e.pointerId);
    onRowDragStart?.(page.id);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (draggingId === null) return;
    e.preventDefault();
    // Rows are nested inside their category container, so a row match
    // (the more specific target) must win over the category it happens
    // to sit inside — only fall back to a category-level move when the
    // pointer is over the category header itself, not any of its rows.
    const rowId = rowIdAtPoint(e.clientX, e.clientY);
    if (rowId !== null) {
      onRowDragOverRow?.(rowId);
    } else {
      onRowDragOverCategory?.(categoryAtPoint(e.clientX, e.clientY));
    }
  };

  const endDrag = (e: React.PointerEvent) => {
    if (draggingId === null) return;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    onRowDragEnd?.();
  };

  // Long-press to select (touch) — same 500ms press-and-hold convention
  // as the editor's right-click/long-press menu (useEditorContextMenu).
  const handleRowTouchStart = () => {
    if (transmogifyMode) return;
    longPressTimer.current = window.setTimeout(() => {
      longPressTimer.current = null;
      onLongPressToggle?.(page.id);
    }, LONG_PRESS_MS);
  };

  const cancelLongPress = () => {
    if (longPressTimer.current !== null) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  return (
    <div className="notes-tree-node">
      <div
        className={`notes-tree-row${selectedId === page.id ? " notes-tree-row-active" : ""}${
          isPicked || isMultiSelected ? " notes-tree-row-picked" : ""
        }${isDragSource ? " notes-tree-row-dragging" : ""}${isRowDropTarget ? " notes-tree-row-drop-target" : ""}`}
        style={{ paddingLeft: `${8 + depth * 16}px` }}
        data-row-drop={page.id}
      >
        {!transmogifyMode && (
          <span
            className="notes-tree-drag-handle"
            title="Drag to reorder, or onto a category to move this page"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
          >
            ⠿
          </span>
        )}
        <button
          className="notes-tree-caret"
          onClick={() => onToggleExpanded(page.id)}
          style={{ visibility: kids.length > 0 ? "visible" : "hidden" }}
        >
          {isExpanded ? "▾" : "▸"}
        </button>
        <button
          className="notes-tree-row-main"
          onClick={(e) => (transmogifyMode ? onToggleSelected?.(page.id) : onSelect(page.id, e.shiftKey))}
          onTouchStart={handleRowTouchStart}
          onTouchMove={cancelLongPress}
          onTouchEnd={cancelLongPress}
          title={!transmogifyMode ? "Click to open · Shift-click to select a range · Long-press to select" : undefined}
        >
          {transmogifyMode && (
            <span className="notes-tree-row-checkbox">{isPicked ? "☑" : "☐"}</span>
          )}
          {!transmogifyMode && isMultiSelected && <span className="notes-tree-row-checkbox">☑</span>}
          <span className="notes-tree-row-icon">{page.icon}</span>
          <span className="notes-tree-row-title">{page.title || "Untitled"}</span>
        </button>
        {!transmogifyMode && (
          <span className="notes-tree-row-actions">
            <button className="notes-tree-row-btn" title="Move to category" onClick={(e) => onOpenMoveMenu?.(page.id, e)}>
              📂
            </button>
            <button className="notes-tree-row-btn" title="Add sub-page" onClick={() => onAddChild(page)}>
              +
            </button>
            <button className="notes-tree-row-btn" title="Delete" onClick={() => onDelete(page)}>
              ✕
            </button>
          </span>
        )}
      </div>
      {isExpanded &&
        kids.map((child) => (
          <NoteTreeRow
            key={child.id}
            page={child}
            depth={depth + 1}
            childrenOf={childrenOf}
            expanded={expanded}
            selectedId={selectedId}
            onToggleExpanded={onToggleExpanded}
            onSelect={onSelect}
            onLongPressToggle={onLongPressToggle}
            onAddChild={onAddChild}
            onDelete={onDelete}
            transmogifyMode={transmogifyMode}
            selectedNoteIds={selectedNoteIds}
            onToggleSelected={onToggleSelected}
            multiSelectedIds={multiSelectedIds}
            draggingId={draggingId}
            draggingSelectedIds={draggingSelectedIds}
            dragOverRowId={dragOverRowId}
            onRowDragStart={onRowDragStart}
            onRowDragOverCategory={onRowDragOverCategory}
            onRowDragOverRow={onRowDragOverRow}
            onRowDragEnd={onRowDragEnd}
            onOpenMoveMenu={onOpenMoveMenu}
          />
        ))}
    </div>
  );
}
