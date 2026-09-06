import { useEffect, useRef, useState } from "react";
import { useMobileLayout } from "../theme/useMobileLayout";
import "./HintTooltip.css";

// Desktop: hover or focus reveals the hint. Mobile: tap ? to open, tap
// X or outside to close — hover is not required. Same copy, two
// interaction models, and the bubble overlays rather than resizing the
// canvas.
export function HintTooltip({ text }: { text: string }) {
  const mobile = useMobileLayout();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, [open]);

  return (
    <div
      ref={rootRef}
      className={`hint-tooltip${open ? " is-open" : ""}${mobile ? " is-mobile" : ""}`}
    >
      <button
        type="button"
        className="hint-tooltip-trigger"
        aria-label="Help"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {open && mobile ? "×" : "?"}
      </button>
      <div className="hint-tooltip-bubble" role="tooltip">
        {text}
      </div>
    </div>
  );
}
