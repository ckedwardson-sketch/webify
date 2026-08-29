import { useEffect, useState } from "react";
import { useRearrangeMode, isLayoutCompatible } from "./RearrangeModeContext";
import { AddFieldMenu } from "./AddFieldMenu";
import { fetchLayouts, saveLayout, deleteLayout, SavedLayout } from "../db/layouts";
import "./RearrangeToolbar.css";

// The left-side vertical tool rail for rearrange mode (see
// RearrangeModeContext.tsx) — rendered once globally (App.tsx) so it
// works no matter which widget-grid page (Project/Goal Detail today)
// happens to be open; everything it does routes through whatever page
// most recently registered itself as the active `target`.
export function RearrangeToolbar() {
  const {
    active,
    exit,
    deleteToolActive,
    toggleDeleteTool,
    copyToolActive,
    toggleCopyTool,
    clipboard,
    target,
    showAddMenu,
    toggleAddMenu,
    closeAddMenu,
    undoStack,
    redoStack,
    popUndo,
    popRedo,
  } = useRearrangeMode();
  const [showSave, setShowSave] = useState(false);
  const [showLoad, setShowLoad] = useState(false);

  if (!active) return null;

  // Save/Load Layout only ever meant "the widget grid" — a page with no
  // widget system at all (Dream Detail has none) has nothing for them
  // to do, so they're hidden there rather than offering a dead end.
  const hasWidgetSystem = !!target && target.supportedWidgetTypes.length > 0;

  return (
    <div className="rearrange-toolbar">
      <ToolButton
        icon="↩"
        label={undoStack.length > 0 ? `Undo (${undoStack.length})` : "Undo"}
        onClick={popUndo}
        disabled={undoStack.length === 0}
      />
      <ToolButton
        icon="↪"
        label={redoStack.length > 0 ? `Redo (${redoStack.length})` : "Redo"}
        onClick={popRedo}
        disabled={redoStack.length === 0}
      />
      <ToolButton icon="🗑" label="Delete" active={deleteToolActive} danger onClick={toggleDeleteTool} />
      <ToolButton icon="➕" label="Add new area" active={showAddMenu} onClick={toggleAddMenu} />
      <ToolButton
        icon="📋"
        label={clipboard ? `Copy field (holding "${clipboard.label}")` : "Copy field"}
        active={copyToolActive}
        onClick={toggleCopyTool}
      />
      {hasWidgetSystem && (
        <>
          <ToolButton icon="💾" label="Save layout" onClick={() => setShowSave(true)} />
          <ToolButton icon="📂" label="Load layout" onClick={() => setShowLoad(true)} />
        </>
      )}
      <div className="rearrange-toolbar-spacer" />
      <ToolButton icon="✕" label="Exit rearrange mode" onClick={exit} />

      {/* Popovers below are rendered as descendants of .rearrange-toolbar
          (position: relative) specifically so their position: absolute
          anchors to the toolbar itself — it's a normal flex sibling of
          the sidebar now, not a fixed x:0 overlay, so its screen
          position moves with sidebar width/collapse state, and these
          need to track it. */}
      {deleteToolActive && <div className="rearrange-hint">Hover a field/widget — red means it'll delete.</div>}
      {copyToolActive && !clipboard && (
        <div className="rearrange-hint">Click a text field to copy it (widgets duplicate instantly instead).</div>
      )}
      {clipboard && (
        <div className="rearrange-hint">
          Holding "{clipboard.label}" — click any blue line between fields to paste it there, or the green field to
          cancel.
        </div>
      )}
      {showAddMenu && (
        <div className="rearrange-hint">
          Hover the blue line between any two fields for a "+", the thin bar on a field's right edge to place one
          beside it, or pick below to add at the end.
        </div>
      )}

      {showAddMenu && target && (
        <>
          <div className="menu-backdrop" onClick={closeAddMenu} />
          <div className="rearrange-add-menu">
            <AddFieldMenu
              target={target}
              onPickWidget={async (type) => {
                await target.onAddWidget(type);
                closeAddMenu();
              }}
              onPickField={async (type) => {
                await target.onAddField(type);
                closeAddMenu();
              }}
            />
          </div>
        </>
      )}

      {showSave && target && <SaveLayoutDialog onClose={() => setShowSave(false)} />}
      {showLoad && target && <LoadLayoutBrowser onClose={() => setShowLoad(false)} />}
    </div>
  );
}

function ToolButton({
  icon,
  label,
  active,
  danger,
  disabled,
  onClick,
}: {
  icon: string;
  label: string;
  active?: boolean;
  danger?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={`rearrange-tool-button${active ? ` rearrange-tool-button-active${danger ? " rearrange-tool-button-danger" : ""}` : ""}`}
      onClick={onClick}
      disabled={disabled}
      title={label}
    >
      <span className="rearrange-tool-icon">{icon}</span>
      <span className="rearrange-tool-tooltip">{label}</span>
    </button>
  );
}

function SaveLayoutDialog({ onClose }: { onClose: () => void }) {
  const { target } = useRearrangeMode();
  const [name, setName] = useState("");
  const [includeContent, setIncludeContent] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!target || !name.trim()) return;
    setSaving(true);
    try {
      await saveLayout(name.trim(), target.category, includeContent, target.widgets);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="menu-backdrop" onClick={onClose} />
      <div className="rearrange-dialog">
        <h3 style={{ marginTop: 0 }}>Save Layout</h3>
        <label className="project-field-label">
          Name
          <input
            className="inline-add-input"
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSave()}
          />
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
          <input type="checkbox" checked={includeContent} onChange={(e) => setIncludeContent(e.target.checked)} />
          Include the text/content in the boxes
        </label>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 14 }}>
          <button className="add-button secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="add-button" onClick={handleSave} disabled={!name.trim() || saving}>
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </>
  );
}

function LoadLayoutBrowser({ onClose }: { onClose: () => void }) {
  const { target } = useRearrangeMode();
  const [layouts, setLayouts] = useState<SavedLayout[] | null>(null);
  const [applying, setApplying] = useState<number | null>(null);

  useEffect(() => {
    fetchLayouts().then(setLayouts);
  }, []);

  const byCategory = new Map<string, SavedLayout[]>();
  for (const l of layouts ?? []) {
    const list = byCategory.get(l.category) ?? [];
    list.push(l);
    byCategory.set(l.category, list);
  }

  const handleApply = async (layout: SavedLayout) => {
    if (!target) return;
    setApplying(layout.id);
    try {
      await target.onApplyLayout(layout);
      onClose();
    } finally {
      setApplying(null);
    }
  };

  const handleDelete = async (id: number) => {
    await deleteLayout(id);
    setLayouts((prev) => (prev ? prev.filter((l) => l.id !== id) : prev));
  };

  return (
    <>
      <div className="menu-backdrop" onClick={onClose} />
      <div className="rearrange-dialog rearrange-load-browser">
        <h3 style={{ marginTop: 0 }}>Load Layout</h3>
        {!layouts ? (
          <p className="page-text">Loading…</p>
        ) : layouts.length === 0 ? (
          <p className="page-text">No saved layouts yet.</p>
        ) : (
          Array.from(byCategory.entries()).map(([category, items]) => (
            <div key={category} className="rearrange-load-category">
              <div className="rearrange-load-category-title">{category}</div>
              {items.map((layout) => {
                const compatible = target ? isLayoutCompatible(layout, target.supportedWidgetTypes) : false;
                return (
                  <div key={layout.id} className="rearrange-load-item">
                    <button
                      className="rearrange-load-item-button"
                      disabled={!compatible || applying !== null}
                      onClick={() => handleApply(layout)}
                    >
                      <span>{layout.name}</span>
                      <span className="rearrange-load-item-meta">
                        {layout.widgets.length} widget{layout.widgets.length === 1 ? "" : "s"}
                        {layout.includeContent ? " · with content" : ""}
                      </span>
                      {!compatible && <span className="rearrange-load-item-unavailable">Not available here</span>}
                    </button>
                    <button className="rearrange-load-item-delete" onClick={() => handleDelete(layout.id)} title="Delete layout">
                      ✕
                    </button>
                  </div>
                );
              })}
            </div>
          ))
        )}
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}>
          <button className="add-button secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </>
  );
}
