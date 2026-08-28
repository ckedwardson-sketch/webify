import { useRef, useState } from "react";

export type SaveStatus = "idle" | "saving" | "saved";

// A small, reusable "did that actually save?" indicator. run() wraps an
// async save call: shows "saving" for its duration, then "saved" for a
// couple seconds, then fades back to idle. Built because several save
// actions in the app (a date field, a schedule/alarm edit) fire off an
// async write with no visible confirmation, leaving no way to tell
// whether anything happened.
export function useSaveFeedback(savedDurationMs = 1800) {
  const [status, setStatus] = useState<SaveStatus>("idle");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const run = async (action: () => void | Promise<void>) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setStatus("saving");
    try {
      await action();
      setStatus("saved");
      timerRef.current = setTimeout(() => setStatus("idle"), savedDurationMs);
    } catch (err) {
      setStatus("idle");
      throw err;
    }
  };

  return { status, run };
}
