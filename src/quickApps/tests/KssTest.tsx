import { useState } from "react";
import "./tests.css";

const ANCHORS: Record<number, string> = {
  1: "Extremely alert",
  3: "Alert",
  5: "Neither alert nor sleepy",
  7: "Sleepy, but no effort to stay awake",
  9: "Extremely sleepy, fighting sleep",
};

export function KssTest({ onComplete }: { onComplete: (score: Record<string, unknown>) => void }) {
  const [rating, setRating] = useState<number | null>(null);

  return (
    <div className="quick-test">
      <p className="quick-test-hint">How sleepy do you feel right now?</p>
      <div className="kss-scale">
        {Array.from({ length: 9 }, (_, i) => i + 1).map((n) => (
          <button
            key={n}
            className={`kss-option${rating === n ? " selected" : ""}`}
            onClick={() => setRating(n)}
            title={ANCHORS[n] || ""}
          >
            {n}
          </button>
        ))}
      </div>
      {rating !== null && <div className="quick-test-progress">{ANCHORS[rating] || ""}</div>}
      <button className="add-button" style={{ marginTop: 10 }} disabled={rating === null} onClick={() => onComplete({ rating })}>
        Save
      </button>
    </div>
  );
}
