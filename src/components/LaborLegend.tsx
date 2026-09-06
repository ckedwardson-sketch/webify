// src/components/LaborLegend.tsx
import { useState } from "react";
import { Panel } from "@xyflow/react";
import { useTheme } from "../theme/ThemeContext";
import { CATEGORY_LABELS, categoryColorFor } from "./ProgressGraphNodes";
import { ProgressCategory } from "../types/models";
import "./LaborLegend.css";

const CATEGORIES = Object.keys(CATEGORY_LABELS) as ProgressCategory[];

// A collapsed swatch button that expands into the labor-type key —
// colors/labels are read straight from categoryColorFor/CATEGORY_LABELS
// (ProgressGraphNodes.tsx), the same central mapping every task node on
// the web already renders from, so this never drifts out of sync and
// nothing is hardcoded a second time here. Collapsed by default so it
// never eats permanent canvas space.
export function LaborLegend() {
  const { theme } = useTheme();
  const [open, setOpen] = useState(false);

  return (
    <Panel position="bottom-left" className="labor-legend-panel">
      {open ? (
        <div className="labor-legend-card">
          <div className="labor-legend-header">
            <span>Labor type key</span>
            <button className="labor-legend-close" onClick={() => setOpen(false)} title="Collapse">
              ✕
            </button>
          </div>
          {CATEGORIES.map((c) => (
            <div key={c} className="labor-legend-row">
              <span className="labor-legend-swatch" style={{ background: categoryColorFor(theme, c) }} />
              <span>{CATEGORY_LABELS[c]}</span>
            </div>
          ))}
        </div>
      ) : (
        <button className="labor-legend-toggle" onClick={() => setOpen(true)} title="Show labor type key">
          🎨 Key
        </button>
      )}
    </Panel>
  );
}
