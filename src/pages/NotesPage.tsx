import { useEffect, useMemo, useState } from "react";
import { View } from "../types/nav";
import { NotePage } from "../types/notes";
import {
  fetchAllPages,
  fetchAllCategories,
  addPage,
  deletePage,
  updatePageTitle,
  updatePageIcon,
} from "../db/notes";
import { NoteEditor } from "../components/NoteEditor";
import { NOTE_ICON_CHOICES } from "../notes/iconChoices";
import "../components/ManagedListRow.css"; // reusing .menu-backdrop
import "./Page.css";
import "./NotesPage.css";

const NEW_CATEGORY_SENTINEL = "__new__";

export function NotesPage({ pageId, onNavigate }: { pageId?: number; onNavigate: (view: View) => void }) {
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
    return map;
  }, [pages]);

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

  const pickIcon = async (icon: string) => {
    if (!selected) return;
    setShowIconPicker(false);
    setPages((prev) => prev.map((p) => (p.id === selected.id ? { ...p, icon } : p)));
    await updatePageIcon(selected.id, icon);
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
    <div className="notes-shell">
      <aside className="notes-tree">
        <div className="notes-tree-header">
          <h2 className="notes-tree-title">Notes</h2>
          <button className="icon-button" onClick={startAddForm} title="New page">
            +
          </button>
        </div>

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
          Array.from(topLevelByCategory.entries()).map(([category, catPages]) => (
            <div key={category} className="notes-tree-category">
              <div className="notes-tree-category-title">{category}</div>
              {catPages.map((p) => (
                <NoteTreeRow
                  key={p.id}
                  page={p}
                  depth={0}
                  childrenOf={childrenOf}
                  expanded={expanded}
                  selectedId={pageId}
                  onToggleExpanded={toggleExpanded}
                  onSelect={(id) => onNavigate({ type: "notes", pageId: id })}
                  onAddChild={addChildPage}
                  onDelete={handleDeletePage}
                />
              ))}
            </div>
          ))
        )}
      </aside>

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
            <NoteEditor pageId={selected.id} />
          </div>
        )}
      </div>
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
  onAddChild,
  onDelete,
}: {
  page: NotePage;
  depth: number;
  childrenOf: Map<number | null, NotePage[]>;
  expanded: Set<number>;
  selectedId: number | undefined;
  onToggleExpanded: (id: number) => void;
  onSelect: (id: number) => void;
  onAddChild: (page: NotePage) => void;
  onDelete: (page: NotePage) => void;
}) {
  const kids = childrenOf.get(page.id) ?? [];
  const isExpanded = expanded.has(page.id);

  return (
    <div className="notes-tree-node">
      <div
        className={`notes-tree-row${selectedId === page.id ? " notes-tree-row-active" : ""}`}
        style={{ paddingLeft: `${8 + depth * 16}px` }}
      >
        <button
          className="notes-tree-caret"
          onClick={() => onToggleExpanded(page.id)}
          style={{ visibility: kids.length > 0 ? "visible" : "hidden" }}
        >
          {isExpanded ? "▾" : "▸"}
        </button>
        <button className="notes-tree-row-main" onClick={() => onSelect(page.id)}>
          <span className="notes-tree-row-icon">{page.icon}</span>
          <span className="notes-tree-row-title">{page.title || "Untitled"}</span>
        </button>
        <span className="notes-tree-row-actions">
          <button className="notes-tree-row-btn" title="Add sub-page" onClick={() => onAddChild(page)}>
            +
          </button>
          <button className="notes-tree-row-btn" title="Delete" onClick={() => onDelete(page)}>
            ✕
          </button>
        </span>
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
            onAddChild={onAddChild}
            onDelete={onDelete}
          />
        ))}
    </div>
  );
}
