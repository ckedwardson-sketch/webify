import { useEffect, useRef, useState } from "react";
import "./tests.css";

const LETTERS = ["B", "F", "K", "M", "R", "T"];
const SEQUENCE_LENGTH = 20;
const LETTER_MS = 1800;

function buildSequence(): string[] {
  const seq: string[] = [];
  for (let i = 0; i < SEQUENCE_LENGTH; i++) {
    if (i >= 2 && Math.random() < 0.35) {
      seq.push(seq[i - 2]);
    } else {
      seq.push(LETTERS[Math.floor(Math.random() * LETTERS.length)]);
    }
  }
  return seq;
}

export function TwoBackTest({ onComplete }: { onComplete: (score: Record<string, unknown>) => void }) {
  const [sequence] = useState(buildSequence);
  const [index, setIndex] = useState(0);
  const [responded, setResponded] = useState(false);
  const shownAtRef = useRef(0);
  const respondedRef = useRef(false);
  const statsRef = useRef({ hits: 0, misses: 0, falseAlarms: 0, correctRejections: 0, hitRts: [] as number[] });

  useEffect(() => {
    shownAtRef.current = performance.now();
    respondedRef.current = false;
    setResponded(false);
    const id = setTimeout(() => {
      const isMatch = index >= 2 && sequence[index] === sequence[index - 2];
      if (index >= 2) {
        if (isMatch && respondedRef.current) statsRef.current.hits++;
        else if (isMatch && !respondedRef.current) statsRef.current.misses++;
        else if (!isMatch && respondedRef.current) statsRef.current.falseAlarms++;
        else statsRef.current.correctRejections++;
      }
      if (index + 1 >= sequence.length) {
        const s = statsRef.current;
        const decisions = s.hits + s.misses + s.falseAlarms + s.correctRejections;
        const accuracy = decisions === 0 ? 0 : Math.round(((s.hits + s.correctRejections) / decisions) * 100);
        const meanRt = s.hitRts.length ? Math.round(s.hitRts.reduce((a, b) => a + b, 0) / s.hitRts.length) : null;
        onComplete({ hits: s.hits, misses: s.misses, falseAlarms: s.falseAlarms, correctRejections: s.correctRejections, accuracy, meanRt });
      } else {
        setIndex((i) => i + 1);
      }
    }, LETTER_MS);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  const handleMatch = () => {
    if (respondedRef.current) return;
    respondedRef.current = true;
    setResponded(true);
    if (index >= 2 && sequence[index] === sequence[index - 2]) {
      statsRef.current.hitRts.push(Math.round(performance.now() - shownAtRef.current));
    }
  };

  return (
    <div className="quick-test">
      <div className="quick-test-progress">
        Letter {index + 1} / {sequence.length}
      </div>
      <div className="two-back-letter">{sequence[index]}</div>
      <button
        className={`add-button${responded ? " secondary" : ""}`}
        onClick={handleMatch}
        disabled={index < 2 || responded}
      >
        {responded ? "✓ Marked" : "Match (same as 2 back)"}
      </button>
      <p className="quick-test-hint">Press Match when the current letter is the same as the one shown two letters ago.</p>
    </div>
  );
}
