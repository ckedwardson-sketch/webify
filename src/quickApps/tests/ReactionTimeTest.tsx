import { useEffect, useRef, useState } from "react";
import "./tests.css";

// PVT and Simple RT share the same "wait for the stimulus, react as
// fast as possible" mechanic, but they aren't meant to be the same
// test end to end: a real Psychomotor Vigilance Task runs for a fixed
// stretch of time with a wide, slow-paced inter-stimulus interval (so
// attention can lapse) and reports lapses (RT > 500ms) on top of mean
// RT — Simple RT is just a short, fixed number of fast-paced trials
// measuring baseline response speed, nothing else.
const VARIANT_CONFIG = {
  pvt: { isiMin: 2000, isiMax: 8000, durationMs: 180_000 },
  simple: { isiMin: 1000, isiMax: 3000, trialCount: 8 },
} as const;

type Variant = keyof typeof VARIANT_CONFIG;

export function ReactionTimeTest({
  variant,
  onComplete,
}: {
  variant: Variant;
  onComplete: (score: Record<string, unknown>) => void;
}) {
  const cfg = VARIANT_CONFIG[variant];
  const [phase, setPhase] = useState<"waiting" | "go">("waiting");
  const [restartKey, setRestartKey] = useState(0);
  const [rts, setRts] = useState<number[]>([]);
  const [falseStarts, setFalseStarts] = useState(0);
  const [stimulusAt, setStimulusAt] = useState(0);
  const [, setTick] = useState(0);
  const startTimeRef = useRef(performance.now());

  // Keeps the "Xs left" countdown live during PVT's long waiting gaps,
  // which otherwise wouldn't re-render between stimuli.
  useEffect(() => {
    if (variant !== "pvt") return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [variant]);

  useEffect(() => {
    if (phase !== "waiting") return;
    const delay = cfg.isiMin + Math.random() * (cfg.isiMax - cfg.isiMin);
    const id = setTimeout(() => {
      setStimulusAt(performance.now());
      setPhase("go");
    }, delay);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, restartKey]);

  const isDone = (nextRts: number[]) =>
    variant === "pvt"
      ? performance.now() - startTimeRef.current >= VARIANT_CONFIG.pvt.durationMs
      : nextRts.length >= VARIANT_CONFIG.simple.trialCount;

  const finish = (nextRts: number[]) => {
    const meanRt = Math.round(nextRts.reduce((a, b) => a + b, 0) / nextRts.length);
    const score: Record<string, unknown> = {
      trials: nextRts.map((r) => Math.round(r)),
      meanRt,
      falseStarts,
      trialCount: nextRts.length,
    };
    if (variant === "pvt") score.lapses = nextRts.filter((r) => r > 500).length;
    onComplete(score);
  };

  const handleClick = () => {
    if (phase === "waiting") {
      setFalseStarts((f) => f + 1);
      setRestartKey((k) => k + 1);
      return;
    }
    const rt = performance.now() - stimulusAt;
    const nextRts = [...rts, rt];
    setRts(nextRts);
    if (isDone(nextRts)) {
      finish(nextRts);
      return;
    }
    setPhase("waiting");
  };

  const progress =
    variant === "pvt"
      ? `${Math.max(0, Math.round((VARIANT_CONFIG.pvt.durationMs - (performance.now() - startTimeRef.current)) / 1000))}s left`
      : `Trial ${rts.length + 1} / ${VARIANT_CONFIG.simple.trialCount}`;

  return (
    <div className="quick-test">
      <div className="quick-test-progress">
        {progress}
        {falseStarts > 0 ? ` — ${falseStarts} false start${falseStarts === 1 ? "" : "s"}` : ""}
      </div>
      <button className={`quick-test-stimulus-box${phase === "go" ? " go" : ""}`} onClick={handleClick}>
        {phase === "go" ? "CLICK NOW" : "Wait…"}
      </button>
      <p className="quick-test-hint">
        {variant === "pvt"
          ? "Click as fast as you can whenever the box turns green — keep going until time runs out. Clicking early counts as a false start."
          : "Click as fast as you can once the box turns green — clicking too early counts as a false start."}
      </p>
    </div>
  );
}
