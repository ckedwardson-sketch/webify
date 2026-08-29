// src/editor/toolbar/LinkPopover.tsx
import { useState } from "react";
import type { Editor } from "@tiptap/core";
import { Icon } from "../../icons/Icon";

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

// Generalized from Recipe editor's original recipe-only link popover:
// takes a list of internal-link providers (Recipe passes a "recipe"
// provider, Notes passes a "note" provider) plus the always-present
// external "URL" tab.
export function LinkPopover({ editor, providers }: { editor: Editor; providers: LinkTargetProvider[] }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<string>(providers[0]?.tabKey ?? "url");
  const [search, setSearch] = useState("");
  const [urlInput, setUrlInput] = useState("");
  const [targets, setTargets] = useState<Record<string, LinkTarget[]>>({});

  const activeProvider = providers.find((p) => p.tabKey === mode);

  const openMenu = async () => {
    setOpen(true);
    if (activeProvider && !targets[activeProvider.tabKey]) {
      const fetched = await activeProvider.fetchTargets();
      setTargets((prev) => ({ ...prev, [activeProvider.tabKey]: fetched }));
    }
  };

  const switchMode = async (key: string) => {
    setMode(key);
    setSearch("");
    const provider = providers.find((p) => p.tabKey === key);
    if (provider && !targets[provider.tabKey]) {
      const fetched = await provider.fetchTargets();
      setTargets((prev) => ({ ...prev, [provider.tabKey]: fetched }));
    }
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
    setOpen(false);
    setSearch("");
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
    setOpen(false);
    setUrlInput("");
  };

  const filteredTargets = (activeProvider ? targets[activeProvider.tabKey] ?? [] : []).filter((t) =>
    t.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="toolbar-popover-wrapper">
      <button onClick={openMenu} title="Link">
        <Icon iconKey="link" size={15} />
      </button>
      {open && (
        <>
          <div className="toolbar-backdrop" onClick={() => setOpen(false)} />
          <div className="toolbar-popover link-popover">
            <div className="link-mode-tabs">
              {providers.map((p) => (
                <button key={p.tabKey} className={mode === p.tabKey ? "active" : ""} onClick={() => switchMode(p.tabKey)}>
                  {p.tabLabel}
                </button>
              ))}
              <button className={mode === "url" ? "active" : ""} onClick={() => setMode("url")}>
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
      )}
    </div>
  );
}
