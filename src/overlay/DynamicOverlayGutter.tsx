import { useEffect, useState } from "react";
import { View } from "../types/nav";
import { useDynamicOverlay } from "./DynamicOverlayContext";

// Renders a thin tick mark on the scrollbar-side gutter for each pinned
// item that belongs to the page currently on screen, positioned at that
// element's relative scroll offset. Reduced scope: computed against
// `.app-content` (the app's one scrollable content column) rather than
// arbitrary nested scroll containers, which is the only scrollable
// region settings pages render into.
export function DynamicOverlayGutter({ view }: { view: View }) {
  const { active, pins, requestFocus, panelSide } = useDynamicOverlay();
  const [positions, setPositions] = useState<{ key: string; label: string; top: number }[]>([]);

  const currentPins = pins.filter((p) => p.pageType === view.type);

  useEffect(() => {
    if (!active || currentPins.length === 0) {
      setPositions([]);
      return;
    }

    const compute = () => {
      const container = document.querySelector(".app-content") as HTMLElement | null;
      if (!container) return;
      const containerRect = container.getBoundingClientRect();
      const next = currentPins
        .map((p) => {
          const el = document.querySelector(`[data-settings-key="${CSS.escape(p.key)}"]`) as HTMLElement | null;
          if (!el) return null;
          const rect = el.getBoundingClientRect();
          const relTop = rect.top - containerRect.top + container.scrollTop;
          const ratio = container.scrollHeight > 0 ? relTop / container.scrollHeight : 0;
          return { key: p.key, label: p.label, top: Math.min(Math.max(ratio, 0), 1) * 100 };
        })
        .filter((x): x is { key: string; label: string; top: number } => x !== null);
      setPositions(next);
    };

    compute();
    window.addEventListener("resize", compute);
    const container = document.querySelector(".app-content");
    container?.addEventListener("scroll", compute);
    const timer = setTimeout(compute, 300); // catch late-mounting rows

    return () => {
      window.removeEventListener("resize", compute);
      container?.removeEventListener("scroll", compute);
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, view.type, pins]);

  if (!active || positions.length === 0) return null;

  return (
    <div className={`dyn-overlay-gutter${panelSide === "left" ? " side-left" : ""}`}>
      {positions.map((p) => (
        <button
          key={p.key}
          className="dyn-overlay-gutter-tick"
          style={{ top: `${p.top}%` }}
          title={p.label}
          onClick={() => requestFocus(p.key)}
        />
      ))}
    </div>
  );
}
