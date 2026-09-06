import { useEffect, useState } from "react";
import "./tests.css";

const SEQUENCE_LENGTH = 7;
const DIGIT_MS = 700;

function buildSequence(): number[] {
  return Array.from({ length: SEQUENCE_LENGTH }, () => Math.floor(Math.random() * 10));
}

export function ShortTermMemoryTest({ onComplete }: { onComplete: (score: Record<string, unknown>) => void }) {
  const [sequence] = useState(buildSequence);
  const [showIndex, setShowIndex] = useState(0);
  const [phase, setPhase] = useState<"showing" | "recall">("showing");
  const [answer, setAnswer] = useState("");

  useEffect(() => {
    if (phase !== "showing") return;
    if (showIndex >= sequence.length) {
      setPhase("recall");
      return;
    }
    const id = setTimeout(() => setShowIndex((i) => i + 1), DIGIT_MS);
    return () => clearTimeout(id);
  }, [phase, showIndex, sequence.length]);

  const handleSubmit = () => {
    const digits = answer.replace(/\D/g, "").split("").map(Number);
    let correct = 0;
    for (let i = 0; i < sequence.length; i++) {
      if (digits[i] === sequence[i]) correct++;
    }
    onComplete({ correct, total: sequence.length, exactMatch: correct === sequence.length });
  };

  if (phase === "showing") {
    return (
      <div className="quick-test">
        <div className="quick-test-progress">Memorize the sequence…</div>
        <div className="stm-digit">{showIndex < sequence.length ? sequence[showIndex] : ""}</div>
      </div>
    );
  }

  return (
    <div className="quick-test">
      <div className="quick-test-progress">Type the {sequence.length} digits back, in order</div>
      <input
        className="raft-dog-input"
        style={{ textAlign: "center", fontSize: "1.2rem", maxWidth: 220 }}
        autoFocus
        inputMode="numeric"
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleSubmit();
        }}
      />
      <button className="add-button" style={{ marginTop: 10 }} onClick={handleSubmit}>
        Submit
      </button>
    </div>
  );
}
