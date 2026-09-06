import { useMemo, useState } from "react";
import { View } from "../types/nav";
import { Breadcrumb } from "../components/Breadcrumb";
import { buildSettingsByLocation, buildSettingsSearchIndex, SettingsLocationGroup } from "./settingsSearchIndex";
import { useDynamicOverlay } from "../overlay/DynamicOverlayContext";
import "./Page.css";
import "./SettingsShared.css";
import "./SettingsDynamicSearchPage.css";

// Threshold from the spec: any group with more than this many settings
// must be rendered as a collapsible subsection rather than a flat list.
const COLLAPSE_THRESHOLD = 30;

interface PageGroup {
  page: string;
  locations: SettingsLocationGroup[];
  total: number;
}

function groupByPage(groups: SettingsLocationGroup[]): PageGroup[] {
  const byPage = new Map<string, SettingsLocationGroup[]>();
  for (const g of groups) {
    if (!byPage.has(g.page)) byPage.set(g.page, []);
    byPage.get(g.page)!.push(g);
  }
  return Array.from(byPage.entries()).map(([page, locations]) => ({
    page,
    locations,
    total: locations.reduce((sum, l) => sum + l.items.length, 0),
  }));
}

export function SettingsDynamicSearchPage({ onNavigate }: { onNavigate: (view: View) => void }) {
  const [query, setQuery] = useState("");
  const [viewMode, setViewMode] = useState<"grouped" | "flat">("grouped");
  const allGroups = useMemo(() => buildSettingsByLocation(), []);
  const pageGroups = useMemo(() => groupByPage(allGroups), [allGroups]);
  const flatItems = useMemo(
    () => [...buildSettingsSearchIndex()].sort((a, b) => a.label.localeCompare(b.label)),
    []
  );
  const { requestQuickEdit } = useDynamicOverlay();

  const q = query.trim().toLowerCase();
  const matches = (label: string, key: string) =>
    !q || label.toLowerCase().includes(q) || key.toLowerCase().includes(q);

  return (
    <div className="page">
      <Breadcrumb
        crumbs={[
          { label: "Settings", onClick: () => onNavigate({ type: "settings-home" }) },
          { label: "Dynamic Settings Search" },
        ]}
      />
      <h1 className="page-title">Dynamic Settings Search</h1>
      <p className="page-text">
        Every individually customizable setting in the app. "Grouped by page" organizes them by where
        they live — the same setting can appear under more than one page if it's relevant there.
        "Flat" is a plain alphabetical list. Click any result to edit it inline — nothing here navigates
        you away.
      </p>

      <div className="dyn-search-view-toggle" role="group" aria-label="View mode">
        <button
          type="button"
          className={`add-button${viewMode === "grouped" ? "" : " secondary"}`}
          onClick={() => setViewMode("grouped")}
        >
          Grouped by page
        </button>
        <button
          type="button"
          className={`add-button${viewMode === "flat" ? "" : " secondary"}`}
          onClick={() => setViewMode("flat")}
        >
          Flat list
        </button>
      </div>

      <input
        className="settings-search"
        placeholder="Filter settings by page, location, or name..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      {viewMode === "flat" ? (
        <div className="settings-search-results" style={{ marginTop: "12px" }}>
          {flatItems
            .filter((item) => matches(item.label, item.key))
            .map((item) => (
              <button
                key={`${item.section}:${item.key}`}
                className="settings-search-result"
                onClick={() => requestQuickEdit(item)}
              >
                <span className="settings-search-result-section">{item.section}</span>
                <span>{item.label}</span>
              </button>
            ))}
        </div>
      ) : (
      <div className="dyn-search-pages">
        {pageGroups.map((pg) => {
          // A page group is shown if any of its locations have a match.
          const visibleLocations = pg.locations
            .map((loc) => ({ ...loc, items: loc.items.filter((it) => matches(it.label, it.key)) }))
            .filter((loc) => loc.items.length > 0);
          if (q && visibleLocations.length === 0) return null;

          return (
            <details key={pg.page} className="dyn-search-page-group" open={!!q || pg.total <= COLLAPSE_THRESHOLD}>
              <summary className="dyn-search-page-header">
                <span className="dyn-search-page-title">{pg.page}</span>
                <span className="dyn-search-page-count">{pg.total}</span>
              </summary>
              <div className="dyn-search-page-body">
                {(q ? visibleLocations : pg.locations).map((loc) => {
                  const subdivide = loc.items.length > COLLAPSE_THRESHOLD;
                  const content = (
                    <div className="dyn-search-item-list">
                      {loc.items.map((item) => (
                        <button
                          key={`${loc.location}:${item.key}`}
                          className="settings-search-result"
                          onClick={() => requestQuickEdit(item)}
                        >
                          <span>{item.label}</span>
                        </button>
                      ))}
                    </div>
                  );

                  if (loc.location === pg.page || pg.locations.length === 1) {
                    // Single-location page (e.g. Icons, Buttons) — no need
                    // for a redundant sub-header, unless it's large enough
                    // to require its own collapsible subsection.
                    if (!subdivide) return <div key={loc.location}>{content}</div>;
                  }

                  return (
                    <details key={loc.location} className="dyn-search-location-group" open={!!q || !subdivide}>
                      <summary className="dyn-search-location-header">
                        <span>{loc.location}</span>
                        <span className="dyn-search-page-count">{loc.items.length}</span>
                      </summary>
                      {content}
                    </details>
                  );
                })}
              </div>
            </details>
          );
        })}
      </div>
      )}
    </div>
  );
}
