import { useRef, useState } from "react";
import "./TaskHoldToCompleteButton.css";

// Hold long enough and it completes — HOLD_MS is how long that takes.
const HOLD_MS = 900;

export function TaskHoldToCompleteButton({
  onComplete,
  background,
  disabled,
  disabledLabel,
}: {
  onComplete: () => void;
  // The task's labor-type color(s) (see categoryBackgroundFor) — shown
  // as the button's resting background so the board reads its colors
  // at a glance, same as every task node on the Web canvas already
  // does. The growing hold-fill sits on top of it, semi-transparent so
  // the labor color still shows through underneath.
  background?: string;
  // A skill-linked task cooling down (see src/tasks/taskCooldown.ts) —
  // holding does nothing, and disabledLabel ("Available tomorrow", "Available in 3h", …)
  // replaces the usual "Hold to complete" text.
  disabled?: boolean;
  disabledLabel?: string;
}) {
  const [progress, setProgress] = useState(0); // 0-1
  const [holding, setHolding] = useState(false);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number>(0);
  const firedRef = useRef(false);

  const stop = () => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    setProgress(0);
    setHolding(false);
  };

  const tick = () => {
    const elapsed = performance.now() - startRef.current;
    const p = Math.min(1, elapsed / HOLD_MS);
    setProgress(p);
    if (p >= 1) {
      if (!firedRef.current) {
        firedRef.current = true;
        onComplete();
      }
      stop();
      return;
    }
    rafRef.current = requestAnimationFrame(tick);
  };

  const start = (e: React.MouseEvent | React.TouchEvent) => {
    if (disabled) return;
    e.stopPropagation();
    firedRef.current = false;
    startRef.current = performance.now();
    setHolding(true);
    rafRef.current = requestAnimationFrame(tick);
  };

  const label = disabled
    ? disabledLabel ?? "Cooling down"
    : progress >= 0.999
      ? "Released!"
      : holding
        ? "Keep holding…"
        : "Hold to complete";

  return (
    <button
      type="button"
      className={`task-hold-complete-button${holding ? " holding" : ""}${disabled ? " disabled" : ""}`}
      style={{ background: disabled ? undefined : background }}
      disabled={disabled}
      onMouseDown={start}
      onMouseUp={stop}
      onMouseLeave={stop}
      onTouchStart={start}
      onTouchEnd={stop}
      onTouchCancel={stop}
      title={disabled ? label : "Hold to complete"}
    >
      <span className="task-hold-complete-fill" style={{ width: `${progress * 100}%` }} />
      <span className="task-hold-complete-label">{label}</span>
    </button>
  );
}
