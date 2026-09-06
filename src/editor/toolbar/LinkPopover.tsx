// src/editor/toolbar/LinkPopover.tsx
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/core";

export interface LinkTarget {
  id: number;
  name: string;
  groupLabel: string;
}

export interface LinkTargetProvider {
  tabKey: string;
  tabLabel: string;
  hrefScheme: string; // e.g. "app://recipe/"
  searchPlaceholder: string;
  fetchTargets: () => Promise<LinkTarget[]>;
}

// A floating link-insert panel, opened from the editor's right-click
// menu at the click position (Link/Image used to live as toolbar
// buttons — moved into the context menu so the fixed toolbar only
// carries always-relevant formatting). Takes a list of internal-link
// providers (Recipe passes a "recipe" provider, Notes passes a "note"
// provider) plus the always-present external "URL" tab.
export function LinkPanel({
  x,
  y,
  editor,
  providers,
  onClose,
}: {
  x: number;
  y: number;
  editor: Editor;
  providers: LinkTargetProvider[];
  onClose: () => void;
}) {
  const [mode, setMode] = useState<string>(providers[0]?.tabKey ?? "url");
  const [search, setSearch] = useState("");
  const [urlInput, setUrlInput] = useState("");
  const [targets, setTargets] = useState<Record<string, LinkTarget[]>>({});
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  const activeProvider = providers.find((p) => p.tabKey === mode);

  useEffect(() => {
    if (!activeProvider || targets[activeProvider.tabKey]) return;
    activeProvider.fetchTargets().then((fetched) => {
      setTargets((prev) => ({ ...prev, [activeProvider.tabKey]: fetched }));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProvider?.tabKey]);

  useLayoutEffect(() => {
    const el = panelRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    let left = x;
    let top = y;
    if (left + rect.width > window.innerWidth) left = Math.max(0, window.innerWidth - rect.width - 4);
    if (top + rect.height > window.innerHeight) top = Math.max(0, window.innerHeight - rect.height - 4);
    setPos({ left, top });
  }, [x, y]);

  const switchMode = (key: string) => {
    setMode(key);
    setSearch("");
  };

  const insertInternalLink = (provider: LinkTargetProvider, target: LinkTarget) => {
    const { from, to } = editor.state.selection;
    const href = `${provider.hrefScheme}${target.id}`;
    if (from === to) {
      editor
        .chain()
        .focus()
        .insertContent({ type: "text", text: target.name, marks: [{ type: "link", attrs: { href } }] })
        .run();
    } else {
      editor.chain().focus().setLink({ href }).run();
    }
    onClose();
  };

  const insertUrlLink = () => {
    const url = urlInput.trim();
    if (!url) return;
    const { from, to } = editor.state.selection;
    if (from === to) {
      editor
        .chain()
        .focus()
        .insertContent({ type: "text", text: url, marks: [{ type: "link", attrs: { href: url } }] })
        .run();
    } else {
      editor.chain().focus().setLink({ href: url }).run();
    }
    onClose();
  };

  const filteredTargets = (activeProvider ? targets[activeProvider.tabKey] ?? [] : []).filter((t) =>
    t.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      <div className="menu-backdrop" onClick={onClose} onContextMenu={(e) => (e.preventDefault(), onClose())} />
      <div
        ref={panelRef}
        className="toolbar-popover link-popover link-panel-floating"
        style={pos ? { left: pos.left, top: pos.top } : { left: x, top: y, visibility: "hidden" }}
      >
        <div className="link-mode-tabs">
          {providers.map((p) => (
            <button key={p.tabKey} className={mode === p.tabKey ? "active" : ""} onClick={() => switchMode(p.tabKey)}>
              {p.tabLabel}
            </button>
          ))}
          <button className={mode === "url" ? "active" : ""} onClick={() => switchMode("url")}>
            URL
          </button>
        </div>

        {activeProvider ? (
          <>
            <input
              className="link-search-input"
              autoFocus
              placeholder={activeProvider.searchPlaceholder}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div className="link-target-list">
              {filteredTargets.length === 0 ? (
                <div className="link-target-empty">No matches</div>
              ) : (
                filteredTargets.map((t) => (
                  <button
                    key={t.id}
                    className="link-target-item"
                    onClick={() => insertInternalLink(activeProvider, t)}
                  >
                    <span className="link-target-name">{t.name}</span>
                    <span className="link-target-group">{t.groupLabel}</span>
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
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && insertUrlLink()}
            />
            <button className="link-insert-button" onClick={insertUrlLink}>
              Insert
            </button>
          </>
        )}
      </div>
    </>
  );
}
