import { useState } from "react";
import "./tests.css";

const COLORS = [
  { key: "red", label: "Red", css: "#ef4444" },
  { key: "green", label: "Green", css: "#22c55e" },
  { key: "blue", label: "Blue", css: "#3b82f6" },
  { key: "yellow", label: "Yellow", css: "#eab308" },
];
const TRIAL_COUNT = 20;

function randomColorIndex(exclude?: number): number {
  let i = Math.floor(Math.random() * COLORS.length);
  while (i === exclude) i = Math.floor(Math.random() * COLORS.length);
  return i;
}

export function StroopTest({ onComplete }: { onComplete: (score: Record<string, unknown>) => void }) {
  const [trial, setTrial] = useState(0);
  const [wordIdx, setWordIdx] = useState(() => randomColorIndex());
  const [inkIdx, setInkIdx] = useState(() => randomColorIndex());
  const [shownAt, setShownAt] = useState(() => performance.now());
  const [rts, setRts] = useState<number[]>([]);
  const [errors, setErrors] = useState(0);

  const nextTrial = () => {
    setWordIdx(randomColorIndex());
    setInkIdx(randomColorIndex());
    setShownAt(performance.now());
  };

  const handleAnswer = (colorIdx: number) => {
    const rt = performance.now() - shownAt;
    const isCorrect = colorIdx === inkIdx;
    const nextRts = [...rts, rt];
    const nextErrors = errors + (isCorrect ? 0 : 1);
    setRts(nextRts);
    setErrors(nextErrors);
    if (trial + 1 >= TRIAL_COUNT) {
      const meanRt = Math.round(nextRts.reduce((a, b) => a + b, 0) / nextRts.length);
      onComplete({ meanRt, errors: nextErrors, trials: TRIAL_COUNT });
      return;
    }
    setTrial((t) => t + 1);
    nextTrial();
  };

  return (
    <div className="quick-test">
      <div className="quick-test-progress">
        Trial {trial + 1} / {TRIAL_COUNT} — {errors} error{errors === 1 ? "" : "s"}
      </div>
      <div className="stroop-word" style={{ color: COLORS[inkIdx].css }}>
        {COLORS[wordIdx].label}
      </div>
      <div className="stroop-answers">
        {COLORS.map((c, i) => (
          <button key={c.key} className="stroop-answer-btn" style={{ background: c.css }} onClick={() => handleAnswer(i)} />
        ))}
      </div>
      <p className="quick-test-hint">Click the button matching the INK COLOR the word is printed in — not the word itself.</p>
    </div>
  );
}
