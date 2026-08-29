import { useEffect, useMemo, useState } from "react";
import type { MouseEvent } from "react";
import { View } from "../types/nav";
import { buildSettingsByLocation, SettingsSearchItem } from "../pages/settingsSearchIndex";
import { useDynamicOverlay } from "./DynamicOverlayContext";
import { OverlayQuickEdit } from "./OverlayQuickEdit";
import { ColorModePanel } from "./ColorModePanel";
import { FieldStyleQuickEdit } from "./FieldStyleQuickEdit";
import "./DynamicOverlayPanel.css";

// Three overlapping colored circles in a triangular arrangement — the
// Color Mode toggle's icon (see DynamicOverlayContext's colorModeOpen).
function ColorModeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="4.5" r="4" fill="#ef4444" opacity="0.85" />
      <circle cx="5" cy="10.5" r="4" fill="#3b82f6" opacity="0.85" />
      <circle cx="11" cy="10.5" r="4" fill="#eab308" opacity="0.85" />
    </svg>
  );
}

// Very small emoji-based icon so quick-edit boxes reading "no live
// control yet, opening the real page" don't look like a silent failure —
// this is the one legitimate exit-to-a-real-page path left in the
// overlay flow, so it should read as an intentional fallback, not a bug.

// Reduced scope (see task notes): the overlay shows the full
// grouped-by-page tree from Part 1 so items on other pages stay
// navigable, but only auto-expands / DOM-checks the group matching the
// page currently on screen — data-settings-key markers only exist while
// that page is actually mounted, so presence can't be checked for pages
// that aren't the current one.
function isKeyInDom(key: string): boolean {
  return !!document.querySelector(`[data-settings-key="${CSS.escape(key)}"]`);
}

export function DynamicOverlayPanel({
  view,
  onNavigate,
}: {
  view: View;
  onNavigate: (view: View) => void;
}) {
  const {
    active,
    exit,
    pins,
    addPin,
    removePin,
    requestFocus,
    focusRequest,
    panelSide,
    togglePanelSide,
    quickEditItem,
    requestQuickEdit,
    closeQuickEdit,
    colorModeOpen,
    toggleColorMode,
    fieldStyleTarget,
    closeFieldStyle,
  } = useDynamicOverlay();

  // Applies the same scroll+highlight behavior as useSettingsFocus, but
  // triggered from the overlay context instead of a focusKey prop — used
  // for in-place jumps (clicking an item already on screen, or a pinned
  // tick mark) where nothing navigates.
  useEffect(() => {
    if (!focusRequest) return;
    const el = document.querySelector(`[data-settings-key="${CSS.escape(focusRequest)}"]`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("settings-highlight");
    const timer = setTimeout(() => el.classList.remove("settings-highlight"), 1600);
    return () => clearTimeout(timer);
  }, [focusRequest]);

  // Whichever entry point opened the quick edit (this panel's own tree,
  // the Settings-home search box, the Dynamic Settings Search page, or a
  // hover+jump on a live element), give it the same "also highlight it in
  // place if it happens to already be on screen" bonus — this only needs
  // to live in one place since quickEditItem is shared context state now.
  useEffect(() => {
    if (!quickEditItem) return;
    if (quickEditItem.view.type === view.type && isKeyInDom(quickEditItem.key)) {
      requestFocus(quickEditItem.key);
    }
  }, [quickEditItem, view.type]);
  const groups = useMemo(() => buildSettingsByLocation(), []);
  const [query, setQuery] = useState("");

  const byPage = useMemo(() => {
    const map = new Map<string, typeof groups>();
    for (const g of groups) {
      if (!map.has(g.page)) map.set(g.page, []);
      map.get(g.page)!.push(g);
    }
    return Array.from(map.entries());
  }, [groups]);

  // Whenever the route changes, auto-expand the group owning the
  // current page (per spec: "entering a page automatically opens that
  // dropdown").
  const currentPageName = useMemo(() => {
    for (const [page, locs] of byPage) {
      if (locs.some((l) => l.items.some((it) => it.view.type === view.type))) return page;
    }
    return null;
  }, [byPage, view.type]);

  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (currentPageName) setExpanded((prev) => new Set(prev).add(currentPageName));
  }, [currentPageName]);

  if (!active) return null;

  const q = query.trim().toLowerCase();
  const matches = (item: SettingsSearchItem) =>
    !q || item.label.toLowerCase().includes(q) || item.key.toLowerCase().includes(q);

  // Search results open an inline quick-edit right here instead of
  // navigating away — the whole point is to watch the change land without
  // leaving the current page. (The on-page highlight bonus is handled by
  // the quickEditItem effect above, so it applies no matter which entry
  // point opened this item.)
  const handleClick = (item: SettingsSearchItem, evt: MouseEvent) => {
    if (evt.shiftKey) {
      addPin({ key: item.key, label: item.label, pageType: item.view.type });
      return;
    }
    requestQuickEdit(item);
  };

  return (
    <div className={`dyn-overlay-panel${panelSide === "left" ? " side-left" : ""}`}>
      <div className="dyn-overlay-header">
        <span className="dyn-overlay-title">Dynamic Search</span>
        <div className="dyn-overlay-header-actions">
          <button
            className={`dyn-overlay-side-toggle${colorModeOpen ? " active" : ""}`}
            onClick={toggleColorMode}
            aria-label={colorModeOpen ? "Close Color Mode" : "Open Color Mode"}
            title={colorModeOpen ? "Close Color Mode" : "Color Mode — pick backgrounds for the page, sidebar, fields, and webs"}
          >
            <ColorModeIcon />
          </button>
          <button
            className="dyn-overlay-side-toggle"
            onClick={togglePanelSide}
            aria-label={`Move panel to the ${panelSide === "left" ? "right" : "left"}`}
            title={`Move panel to the ${panelSide === "left" ? "right" : "left"}`}
          >
            {panelSide === "left" ? "⇥" : "⇤"}
          </button>
          <button className="dyn-overlay-close" onClick={exit} aria-label="Close overlay">
            ✕
          </button>
        </div>
      </div>
      {colorModeOpen ? (
        <>
          <p className="dyn-overlay-hint">
            Ctrl+hover any highlighted background out in the app to edit it in place, or pick a
            surface below.
          </p>
          <ColorModePanel />
        </>
      ) : fieldStyleTarget != null ? (
        <p className="dyn-overlay-hint">
          Ctrl+click any field on a Project/Goal/Dream page to style it — or ctrl+click a web card's
          node to choose what it shows.
        </p>
      ) : (
        <>
          <input
            className="dyn-overlay-filter"
            placeholder="Filter settings..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <p className="dyn-overlay-hint">
            Click to quick-edit here. Shift-click to pin. Out in the app, hover a tagged element and
            press Ctrl (or "J") to jump — shift+Ctrl also pins it. Ctrl+click a field to style it, or a
            web card's node to choose what it shows.
          </p>
        </>
      )}

      {!colorModeOpen && quickEditItem && (
        <div className="dyn-overlay-quickedit">
          <div className="dyn-overlay-quickedit-header">
            <span>{quickEditItem.label}</span>
            <button
              className="dyn-overlay-close"
              onClick={closeQuickEdit}
              aria-label="Close quick edit"
            >
              ✕
            </button>
          </div>
          <OverlayQuickEdit
            item={quickEditItem}
            onFallback={() => {
              onNavigate(quickEditItem.view);
              closeQuickEdit();
            }}
          />
        </div>
      )}

      {!colorModeOpen && fieldStyleTarget != null && (
        <div className="dyn-overlay-quickedit">
          <div className="dyn-overlay-quickedit-header">
            <span>Field style</span>
            <button className="dyn-overlay-close" onClick={closeFieldStyle} aria-label="Close field style">
              ✕
            </button>
          </div>
          <FieldStyleQuickEdit fieldId={fieldStyleTarget} />
        </div>
      )}

      <div className="dyn-overlay-tree" style={colorModeOpen || fieldStyleTarget != null ? { display: "none" } : undefined}>
        {byPage.map(([page, locs]) => {
          const visibleLocs = locs
            .map((l) => ({ ...l, items: l.items.filter(matches) }))
            .filter((l) => l.items.length > 0);
          if (q && visibleLocs.length === 0) return null;
          const isOpen = expanded.has(page) || (!!q && visibleLocs.length > 0);
          const isCurrent = page === currentPageName;

          return (
            <div key={page} className={`dyn-overlay-page${isCurrent ? " current" : ""}`}>
              <button
                className="dyn-overlay-page-header"
                onClick={() =>
                  setExpanded((prev) => {
                    const next = new Set(prev);
                    if (next.has(page)) next.delete(page);
                    else next.add(page);
                    return next;
                  })
                }
              >
                <span>{isOpen ? "▾" : "▸"}</span>
                <span>{page}</span>
              </button>
              {isOpen && (
                <div className="dyn-overlay-page-body">
                  {(q ? visibleLocs : locs).map((loc) => (
                    <div key={loc.location} className="dyn-overlay-location">
                      {loc.location !== page && (
                        <div className="dyn-overlay-location-title">{loc.location}</div>
                      )}
                      {loc.items.map((item) => {
                        const pinned = pins.some((p) => p.key === item.key);
                        return (
                          <button
                            key={item.key}
                            className={`dyn-overlay-item${pinned ? " pinned" : ""}`}
                            onClick={(e) => handleClick(item, e)}
                            title={pinned ? "Pinned — click to jump, shift-click to unpin" : "Click to jump, shift-click to pin"}
                            onContextMenu={(e) => {
                              if (pinned) {
                                e.preventDefault();
                                removePin(item.key);
                              }
                            }}
                          >
                            {item.label}
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
