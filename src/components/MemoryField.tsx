import { useEffect, useRef, useState } from "react";
import "./MemoryField.css";

export interface MemoryEntry {
  id: number;
  field: string; // already display-ready — caller maps its own field-key labels
  oldValue: string | null;
  newValue: string | null;
  reason: string | null;
  changedAt: string;
}

function formatTimestamp(raw: string): string {
  const iso = raw.includes("T") ? raw : `${raw.replace(" ", "T")}Z`;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return raw;
  return d.toLocaleString(undefined, { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

const DEFAULT_HEIGHT = 220;
const MIN_HEIGHT = 90;

// Generalized "Memory" box — a scrollable, resizable log of field
// changes. Originally Dream Detail's own hardcoded section (reading
// dream_history); now shared by any page that can carry a portable
// Memory field (see db/fieldLayout.ts's FieldType), fed either Dream's
// dream_history or the generalized entity_history (db/entityHistory.ts).
export function MemoryField({
  entries,
  heightPx,
  editable,
  onResize,
}: {
  entries: MemoryEntry[];
  heightPx: number | null;
  // Resize handle only really makes sense once rearrange mode is off (or
  // is at least not fighting the field's own dashed rearrange outline
  // for the same screen space) — see the bottom resize bar below, whose
  // hit target the caller can still reach either way, just with less
  // visual competition when `editable` (rearranging) is false.
  editable: boolean;
  onResize: (heightPx: number) => void;
}) {
  const [showFilter, setShowFilter] = useState(false);
  const allFields = Array.from(new Set(entries.map((e) => e.field)));
  const [fieldFilter, setFieldFilter] = useState<Record<string, boolean>>({});
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const isChecked = (field: string) => fieldFilter[field] ?? true;

  const filtered = entries.filter((e) => {
    if (!isChecked(e.field)) return false;
    if (dateFrom || dateTo) {
      const entryDate = e.changedAt.slice(0, 10);
      if (dateFrom && entryDate < dateFrom) return false;
      if (dateTo && entryDate > dateTo) return false;
    }
    return true;
  });

  const [liveHeight, setLiveHeight] = useState(heightPx ?? DEFAULT_HEIGHT);
  const dragging = useRef(false);

  useEffect(() => {
    if (!dragging.current) setLiveHeight(heightPx ?? DEFAULT_HEIGHT);
  }, [heightPx]);

  const startResize = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragging.current = true;
    const startY = e.clientY;
    const startHeight = liveHeight;
    const onMove = (ev: PointerEvent) => {
      setLiveHeight(Math.max(MIN_HEIGHT, startHeight + (ev.clientY - startY)));
    };
    const onUp = (ev: PointerEvent) => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      dragging.current = false;
      onResize(Math.max(MIN_HEIGHT, startHeight + (ev.clientY - startY)));
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  return (
    <div className="memory-field">
      <div className="dream-memory-header">
        <h2 className="theme-section-title">Memory</h2>
        {entries.length > 0 && (
          <div style={{ position: "relative" }}>
            <button className="add-button secondary" onClick={() => setShowFilter((v) => !v)}>
              Filter
            </button>
            {showFilter && (
              <div className="dream-filter-dropdown">
                <div className="dream-filter-section">
                  {allFields.map((f) => (
                    <label key={f} className="dream-filter-checkbox">
                      <span>{f}</span>
                      <input
                        type="checkbox"
                        checked={isChecked(f)}
                        onChange={(e) => setFieldFilter({ ...fieldFilter, [f]: e.target.checked })}
                      />
                    </label>
                  ))}
                </div>
                <hr />
                <div className="dream-filter-section">
                  <label className="dream-filter-date">
                    From
                    <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
                  </label>
                  <label className="dream-filter-date">
                    To
                    <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
                  </label>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="memory-field-scroll" style={{ maxHeight: liveHeight }}>
        {entries.length === 0 ? (
          <p className="page-text">No edits yet — changes will build up here.</p>
        ) : filtered.length === 0 ? (
          <p className="page-text">No changes match this filter.</p>
        ) : (
          <ul className="dream-history-list">
            {filtered.map((entry) => (
              <li key={entry.id} className="dream-history-entry">
                <span className="dream-history-field">{entry.field}</span>
                <span className="dream-history-change">
                  "{entry.oldValue || "—"}" → "{entry.newValue || "—"}"
                </span>
                {entry.reason && <span className="dream-history-reason">"{entry.reason}"</span>}
                <span className="dream-history-time">{formatTimestamp(entry.changedAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div
        className={`memory-field-resize-handle${editable ? "" : " memory-field-resize-handle-prominent"}`}
        onPointerDown={startResize}
        title="Drag to resize"
      >
        <span className="memory-field-resize-grip" />
      </div>
    </div>
  );
}
