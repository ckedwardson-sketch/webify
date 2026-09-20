import { useState } from "react";
import { useTheme } from "../theme/ThemeContext";
import { CATEGORY_LABELS, categoryColorFor } from "./ProgressGraphNodes";
import { ProgressCategory } from "../types/models";
import "./ManagedListRow.css"; // .menu-backdrop
import "./TaskCategoryKeyPopover.css";

const CATEGORIES = Object.keys(CATEGORY_LABELS) as ProgressCategory[];

// The hold-to-complete button's background now shows each task's labor
// type(s) (see categoryBackgroundFor), so the board needs a key
// explaining the colors — but a legend sitting on permanently would be
// "over-intrusion" on a page that's supposed to stay quick and tidy.
// One small toggle button, same source of truth (categoryColorFor/
// CATEGORY_LABELS) the Goal/Project Web's own LaborLegend reads from,
// so the colors can never drift out of sync between the two.
export function TaskCategoryKeyPopover() {
  const { theme } = useTheme();
  const [open, setOpen] = useState(false);

  return (
    <div className="task-category-key">
      <button type="button" className="add-button secondary" onClick={() => setOpen((v) => !v)}>
        🎨 Key
      </button>
      {open && (
        <>
          <div className="menu-backdrop" onClick={() => setOpen(false)} />
          <div className="task-category-key-popover">
            {CATEGORIES.map((c) => (
              <div key={c} className="task-category-key-row">
                <span className="task-category-key-swatch" style={{ background: categoryColorFor(theme, c) }} />
                <span>{CATEGORY_LABELS[c]}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
