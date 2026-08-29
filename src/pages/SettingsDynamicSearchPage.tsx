import { useMemo, useState } from "react";
import { View } from "../types/nav";
import { Breadcrumb } from "../components/Breadcrumb";
import { buildSettingsByLocation, SettingsLocationGroup } from "./settingsSearchIndex";
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
  const allGroups = useMemo(() => buildSettingsByLocation(), []);
  const pageGroups = useMemo(() => groupByPage(allGroups), [allGroups]);
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
        Every individually customizable setting in the app, organized by the page it lives on rather than by
        category. Click one to edit it inline in the Dynamic Search overlay — nothing here navigates you away.
      </p>

      <input
        className="settings-search"
        placeholder="Filter settings by page, location, or name..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

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
    </div>
  );
}
