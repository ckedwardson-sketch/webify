import { useEffect, useRef, useState } from "react";
import "./tests.css";

const SYMBOLS = ["▲", "◆", "●", "■", "★", "▼", "◐", "✚", "◇"];
const TIME_LIMIT_SECONDS = 60;

function shuffled<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function randomDigit(exclude: number): number {
  let d = exclude;
  while (d === exclude) d = 1 + Math.floor(Math.random() * 9);
  return d;
}

export function DigitSymbolTest({ onComplete }: { onComplete: (score: Record<string, unknown>) => void }) {
  // Which symbol stands for which digit, AND the on-screen order of the
  // answer buttons, are both re-shuffled fresh every time this test
  // starts — otherwise the digit-to-symbol key and its screen position
  // stay fixed across days and become memorizable by location rather
  // than by actually reading the key, skewing results over the study.
  const [keySymbols] = useState(() => shuffled(SYMBOLS)); // index = digit-1
  const [answerOrder] = useState(() => shuffled([1, 2, 3, 4, 5, 6, 7, 8, 9]));
  const [digit, setDigit] = useState(() => randomDigit(0));
  const [correct, setCorrect] = useState(0);
  const [total, setTotal] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(TIME_LIMIT_SECONDS);
  const finishedRef = useRef(false);

  const finish = (finalCorrect: number, finalTotal: number) => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    onComplete({ correct: finalCorrect, total: finalTotal, seconds: TIME_LIMIT_SECONDS - secondsLeft });
  };

  useEffect(() => {
    if (secondsLeft <= 0) {
      finish(correct, total);
      return;
    }
    const id = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondsLeft]);

  const handlePick = (pickedDigit: number) => {
    if (finishedRef.current) return;
    const isCorrect = pickedDigit === digit;
    const nextCorrect = correct + (isCorrect ? 1 : 0);
    const nextTotal = total + 1;
    setCorrect(nextCorrect);
    setTotal(nextTotal);
    setDigit(randomDigit(digit));
  };

  return (
    <div className="quick-test">
      <div className="quick-test-progress">
        {secondsLeft}s left — {correct}/{total} correct
      </div>
      <div className="dst-key">
        {keySymbols.map((s, i) => (
          <div key={i} className="dst-key-cell">
            <span className="dst-key-digit">{i + 1}</span>
            <span className="dst-key-symbol">{s}</span>
          </div>
        ))}
      </div>
      <div className="dst-digit">{digit}</div>
      <div className="dst-answers">
        {answerOrder.map((d) => (
          <button key={d} className="dst-answer-btn" onClick={() => handlePick(d)}>
            {keySymbols[d - 1]}
          </button>
        ))}
      </div>
      <p className="quick-test-hint">Click the symbol matching the digit above, as fast as you can, until time runs out.</p>
    </div>
  );
}
