import { useEffect, useRef, useState } from "react";
import "./ConfirmDeleteIconButton.css";

// "Subtle but not too subtle" delete affordance (Tasks page) — first
// click arms it (shows a red "Confirm?" for a few seconds), a second
// click while armed actually deletes. Clicking anything else, or just
// waiting, disarms it with no effect. Deliberately not the page-wide
// RearrangeModeContext delete-arm pattern, which requires switching the
// whole page into rearrange mode first — overkill for a single card's
// delete button.
const ARM_TIMEOUT_MS = 3000;

export function ConfirmDeleteIconButton({ onConfirm, title = "Delete" }: { onConfirm: () => void; title?: string }) {
  const [armed, setArmed] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!armed) return;
    timerRef.current = setTimeout(() => setArmed(false), ARM_TIMEOUT_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [armed]);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (armed) {
      setArmed(false);
      onConfirm();
    } else {
      setArmed(true);
    }
  };

  return (
    <button
      type="button"
      className={`confirm-delete-icon-button${armed ? " armed" : ""}`}
      onClick={handleClick}
      title={armed ? "Click again to confirm" : title}
    >
      {armed ? "Confirm?" : "🗑"}
    </button>
  );
}
