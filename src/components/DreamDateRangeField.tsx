// src/components/DreamDateRangeField.tsx
import { useEffect, useState } from "react";
import { useSaveFeedback } from "../hooks/useSaveFeedback";
import { SaveStatusIndicator } from "./SaveStatusIndicator";
import "./DreamDateRangeField.css";

type Precision = "none" | "day" | "month" | "year" | "range";

function daysInMonth(year: number, month0: number): number {
  return new Date(year, month0 + 1, 0).getDate();
}

// Best-effort guess at which precision produced a given start/end pair,
// so re-opening an existing dream's date shows the picker mode that
// made sense of it (a whole calendar month, a whole calendar year,
// etc) rather than always falling back to "custom range".
function inferPrecision(start?: string, end?: string): Precision {
  if (!start) return "none";
  if (!end || start === end) return "day";
  const s = new Date(`${start}T00:00:00`);
  const e = new Date(`${end}T00:00:00`);
  const isMonthSpan =
    s.getDate() === 1 &&
    e.getFullYear() === s.getFullYear() &&
    e.getMonth() === s.getMonth() &&
    e.getDate() === daysInMonth(s.getFullYear(), s.getMonth());
  if (isMonthSpan) return "month";
  const isYearSpan =
    s.getMonth() === 0 && s.getDate() === 1 && e.getMonth() === 11 && e.getDate() === 31 && e.getFullYear() === s.getFullYear();
  if (isYearSpan) return "year";
  return "range";
}

function computeRange(
  mode: Precision,
  day: string,
  month: string,
  year: string,
  rangeStart: string,
  rangeEnd: string
): { start: string | null; end: string | null } {
  if (mode === "none") return { start: null, end: null };
  if (mode === "day") return day ? { start: day, end: day } : { start: null, end: null };
  if (mode === "month") {
    if (!month) return { start: null, end: null };
    const [y, m] = month.split("-").map(Number);
    const last = daysInMonth(y, m - 1);
    return { start: `${month}-01`, end: `${month}-${String(last).padStart(2, "0")}` };
  }
  if (mode === "year") {
    if (!year) return { start: null, end: null };
    return { start: `${year}-01-01`, end: `${year}-12-31` };
  }
  if (!rangeStart) return { start: null, end: null };
  return { start: rangeStart, end: rangeEnd || rangeStart };
}

export function DreamDateRangeField({
  start,
  end,
  resetToken,
  onSave,
}: {
  start?: string;
  end?: string;
  resetToken: number;
  onSave: (start: string | null, end: string | null) => void | Promise<void>;
}) {
  const { status, run } = useSaveFeedback();
  const [mode, setMode] = useState<Precision>(() => inferPrecision(start, end));
  const [day, setDay] = useState(start && start === end ? start : "");
  const [month, setMonth] = useState(start ? start.slice(0, 7) : "");
  const [year, setYear] = useState(start ? start.slice(0, 4) : "");
  const [rangeStart, setRangeStart] = useState(start ?? "");
  const [rangeEnd, setRangeEnd] = useState(end ?? "");

  // Re-syncs the picker from the committed value whenever it actually
  // changes (a save landed) or the parent explicitly asked for a reset
  // (the user cancelled out of the reason prompt) — not on every
  // keystroke, since the fields below are this component's own draft.
  useEffect(() => {
    setMode(inferPrecision(start, end));
    setDay(start && start === end ? start : "");
    setMonth(start ? start.slice(0, 7) : "");
    setYear(start ? start.slice(0, 4) : "");
    setRangeStart(start ?? "");
    setRangeEnd(end ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [start, end, resetToken]);

  const handleSave = () => {
    const computed = computeRange(mode, day, month, year, rangeStart, rangeEnd);
    run(() => onSave(computed.start, computed.end));
  };

  return (
    <div className="dream-date-field">
      <div className="dream-date-precision">
        {(["none", "day", "month", "year", "range"] as Precision[]).map((p) => (
          <button
            key={p}
            className={`dream-date-precision-option${mode === p ? " active" : ""}`}
            onClick={() => setMode(p)}
          >
            {p === "none" ? "No date" : p === "day" ? "Exact day" : p === "range" ? "Custom range" : p}
          </button>
        ))}
      </div>

      {mode === "day" && (
        <input type="date" className="inline-add-input" value={day} onChange={(e) => setDay(e.target.value)} />
      )}
      {mode === "month" && (
        <input type="month" className="inline-add-input" value={month} onChange={(e) => setMonth(e.target.value)} />
      )}
      {mode === "year" && (
        <input
          type="number"
          className="inline-add-input"
          placeholder="e.g. 2030"
          value={year}
          onChange={(e) => setYear(e.target.value)}
        />
      )}
      {mode === "range" && (
        <div className="dream-date-range-inputs">
          <input
            type="date"
            className="inline-add-input"
            value={rangeStart}
            onChange={(e) => setRangeStart(e.target.value)}
          />
          <span>to</span>
          <input
            type="date"
            className="inline-add-input"
            value={rangeEnd}
            onChange={(e) => setRangeEnd(e.target.value)}
          />
        </div>
      )}

      <div className="save-row">
        <button className="add-button secondary" onClick={handleSave} disabled={status === "saving"}>
          {status === "saving" ? "Saving…" : "Save date"}
        </button>
        <SaveStatusIndicator status={status === "saving" ? "idle" : status} />
      </div>
    </div>
  );
}
