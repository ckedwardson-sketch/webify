import { useEffect, useMemo, useState } from "react";
import { View } from "../types/nav";
import { VaultPage as VaultPageModel } from "../types/vault";
import { useVaultSession } from "../vault/VaultSessionContext";
import {
  fetchAllVaultPages,
  addVaultPage,
  deleteVaultPage,
  updateVaultPageTitle,
  updateVaultPageIcon,
  updateVaultPageContent,
} from "../db/vault";
import { NoteContentEditor } from "../editor/NoteContentEditor";
import { NOTE_ICON_CHOICES } from "../notes/iconChoices";
import "./Page.css";
import "./NotesPage.css";
import "./VaultPage.css";

// The Vault is a deliberately smaller, flatter cousin of Notes (see
// pages/NotesPage.tsx): a plain page tree + the same Tiptap editor, but
// no drag-reorder, categories, or import — every extra surface here is
// one more place plaintext could end up cached or logged, so this stays
// as small as it can while still being a real notes area.
export function VaultPage({ onNavigate }: { onNavigate: (view: View) => void }) {
  const { isSetUp, isUnlocked, cryptoKey, error, setupVault, unlockVault, lockVault, noteActivity } =
    useVaultSession();

  if (isSetUp === null) {
    return (
      <div className="page">
        <p className="page-text">Checking vault…</p>
      </div>
    );
  }

  if (!isUnlocked || !cryptoKey) {
    return isSetUp ? (
      <VaultUnlockScreen error={error} onUnlock={unlockVault} />
    ) : (
      <VaultSetupScreen error={error} onSetup={setupVault} />
    );
  }

  return <VaultWorkspace cryptoKey={cryptoKey} onLock={lockVault} onActivity={noteActivity} onNavigate={onNavigate} />;
}

function VaultSetupScreen({
  error,
  onSetup,
}: {
  error: string | null;
  onSetup: (keyString: string) => Promise<void>;
}) {
  const [key, setKey] = useState("");
  const [confirmKey, setConfirmKey] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);

  const submit = async () => {
    setLocalError(null);
    if (key.length !== 20) {
      setLocalError("Key must be exactly 20 characters.");
      return;
    }
    if (key !== confirmKey) {
      setLocalError("The two entries don't match.");
      return;
    }
    if (!acknowledged) {
      setLocalError("Check the box confirming you understand there's no recovery.");
      return;
    }
    setBusy(true);
    try {
      await onSetup(key);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page">
      <div className="vault-lock-screen">
        <div className="vault-lock-icon">🔒</div>
        <h1 className="page-title">Set up the Vault</h1>
        <p className="page-text">
          Type the 20-character key you've already generated for your decryption cards. It's used to derive the
          encryption key — Webify never stores it anywhere, in any form.
        </p>
        <div className="vault-setup-warning">
          <strong>There is no recovery.</strong> If you lose both cards, this vault's contents are gone for good.
          As long as you still hold at least one card, you can always make a replacement copy of it yourself — but
          Webify has no "forgot key" option and no backup of it anywhere.
        </div>
        <input
          className="vault-key-input"
          type="text"
          maxLength={20}
          placeholder="20-character key"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          autoComplete="off"
          spellCheck={false}
        />
        <input
          className="vault-key-input"
          type="text"
          maxLength={20}
          placeholder="Confirm key"
          value={confirmKey}
          onChange={(e) => setConfirmKey(e.target.value)}
          autoComplete="off"
          spellCheck={false}
          onKeyDown={(e) => e.key === "Enter" && submit()}
        />
        <label style={{ display: "flex", gap: "8px", alignItems: "flex-start", textAlign: "left", fontSize: "0.85rem", margin: "10px 0" }}>
          <input type="checkbox" checked={acknowledged} onChange={(e) => setAcknowledged(e.target.checked)} />
          <span>I understand this key is the only way in, and Webify cannot recover it for me.</span>
        </label>
        {(localError || error) && <p className="vault-key-error">{localError || error}</p>}
        <button className="add-button" onClick={submit} disabled={busy} style={{ width: "100%" }}>
          {busy ? "Setting up…" : "Create Vault"}
        </button>
      </div>
    </div>
  );
}

function VaultUnlockScreen({
  error,
  onUnlock,
}: {
  error: string | null;
  onUnlock: (keyString: string) => Promise<boolean>;
}) {
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      await onUnlock(key);
    } finally {
      setBusy(false);
      setKey("");
    }
  };

  return (
    <div className="page">
      <div className="vault-lock-screen">
        <div className="vault-lock-icon">🔒</div>
        <h1 className="page-title">Vault Locked</h1>
        <p className="page-text">Enter your 20-character key from either decryption card.</p>
        <input
          className="vault-key-input"
          type="password"
          maxLength={20}
          placeholder="20-character key"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          autoComplete="off"
          spellCheck={false}
          autoFocus
          onKeyDown={(e) => e.key === "Enter" && submit()}
        />
        {error && <p className="vault-key-error">{error}</p>}
        <button className="add-button" onClick={submit} disabled={busy || key.length === 0} style={{ width: "100%" }}>
          {busy ? "Unlocking…" : "Unlock"}
        </button>
      </div>
    </div>
  );
}

function VaultWorkspace({
  cryptoKey,
  onLock,
  onActivity,
  onNavigate,
}: {
  cryptoKey: CryptoKey;
  onLock: () => void;
  onActivity: () => void;
  onNavigate: (view: View) => void;
}) {
  const [pages, setPages] = useState<VaultPageModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [showIconPicker, setShowIconPicker] = useState(false);

  const load = () => {
    fetchAllVaultPages(cryptoKey).then((p) => {
      setPages(p);
      setLoading(false);
    });
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cryptoKey]);

  const pageById = useMemo(() => new Map(pages.map((p) => [p.id, p])), [pages]);
  const childrenOf = useMemo(() => {
    const map = new Map<number | null, VaultPageModel[]>();
    for (const p of pages) {
      const list = map.get(p.parentId) ?? [];
      list.push(p);
      map.set(p.parentId, list);
    }
    return map;
  }, [pages]);

  const selected = selectedId !== null ? pageById.get(selectedId) ?? null : null;

  useEffect(() => {
    setTitleDraft(selected?.title ?? "");
    setEditingTitle(false);
  }, [selected?.id]);

  const withActivity = async <T,>(fn: () => Promise<T>): Promise<T> => {
    onActivity();
    return fn();
  };

  const addTopLevelPage = () =>
    withActivity(async () => {
      const id = await addVaultPage(cryptoKey, null, "Untitled");
      load();
      setSelectedId(id);
    });

  const addChildPage = (parent: VaultPageModel) =>
    withActivity(async () => {
      const id = await addVaultPage(cryptoKey, parent.id, "Untitled");
      setExpanded((prev) => new Set(prev).add(parent.id));
      load();
      setSelectedId(id);
    });

  const handleDelete = (page: VaultPageModel) =>
    withActivity(async () => {
      if (!confirm(`Delete "${page.title || "Untitled"}"? Any sub-pages go with it.`)) return;
      await deleteVaultPage(page.id);
      if (selected && (selected.id === page.id || isDescendantOf(selected.id, page.id, pages))) {
        setSelectedId(null);
      }
      load();
    });

  const confirmRenameTitle = () =>
    withActivity(async () => {
      const trimmed = titleDraft.trim();
      setEditingTitle(false);
      if (!selected || !trimmed || trimmed === selected.title) return;
      await updateVaultPageTitle(cryptoKey, selected.id, trimmed);
      setPages((prev) => prev.map((p) => (p.id === selected.id ? { ...p, title: trimmed } : p)));
    });

  const pickIcon = (icon: string) =>
    withActivity(async () => {
      if (!selected) return;
      setShowIconPicker(false);
      setPages((prev) => prev.map((p) => (p.id === selected.id ? { ...p, icon } : p)));
      await updateVaultPageIcon(selected.id, icon);
    });

  const toggleExpanded = (id: number) => {
    onActivity();
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (loading) {
    return (
      <div className="page">
        <p className="page-text">Decrypting…</p>
      </div>
    );
  }

  const topLevel = childrenOf.get(null) ?? [];

  return (
    <div className="notes-shell">
      <aside className="notes-tree">
        <div className="notes-tree-header">
          <h2 className="notes-tree-title">🔒 Vault</h2>
          <button className="icon-button" onClick={addTopLevelPage} title="New page">
            +
          </button>
        </div>
        <div className="notes-tree-toolbar">
          <button className="notes-tool-btn secondary" onClick={onLock} title="Forget the key and re-lock now">
            🔒 Lock now
          </button>
        </div>

        {topLevel.length === 0 ? (
          <p className="page-text notes-tree-empty">No pages yet — use "+" to start one.</p>
        ) : (
          topLevel.map((p) => (
            <VaultTreeRow
              key={p.id}
              page={p}
              depth={0}
              childrenOf={childrenOf}
              expanded={expanded}
              selectedId={selectedId}
              onToggleExpanded={toggleExpanded}
              onSelect={(id) => {
                onActivity();
                setSelectedId(id);
              }}
              onAddChild={addChildPage}
              onDelete={handleDelete}
            />
          ))
        )}
      </aside>

      <div className="notes-editor-pane">
        {!selected ? (
          <div className="notes-empty-state">
            <p className="page-text">Select a page on the left, or create a new one.</p>
          </div>
        ) : (
          <div className="notes-editor-scroll" onClick={onActivity} onKeyDown={onActivity}>
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
              onChange={(html) => withActivity(() => updateVaultPageContent(cryptoKey, selected.id, html))}
              onOpenNoteLink={(id) => onNavigate({ type: "notes", pageId: id })}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function isDescendantOf(candidateId: number, ancestorId: number, pages: VaultPageModel[]): boolean {
  const byId = new Map(pages.map((p) => [p.id, p]));
  let cur = byId.get(candidateId);
  while (cur && cur.parentId !== null) {
    if (cur.parentId === ancestorId) return true;
    cur = byId.get(cur.parentId);
  }
  return false;
}

function VaultTreeRow({
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
  page: VaultPageModel;
  depth: number;
  childrenOf: Map<number | null, VaultPageModel[]>;
  expanded: Set<number>;
  selectedId: number | null;
  onToggleExpanded: (id: number) => void;
  onSelect: (id: number) => void;
  onAddChild: (page: VaultPageModel) => void;
  onDelete: (page: VaultPageModel) => void;
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
          <VaultTreeRow
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
