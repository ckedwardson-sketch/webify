import { ReactionTimeTest } from "./ReactionTimeTest";
import { DigitSymbolTest } from "./DigitSymbolTest";
import { TwoBackTest } from "./TwoBackTest";
import { StroopTest } from "./StroopTest";
import { ShortTermMemoryTest } from "./ShortTermMemoryTest";
import { KssTest } from "./KssTest";

export function renderSleepStudyTest(testKey: string, onComplete: (score: Record<string, unknown>) => void) {
  switch (testKey) {
    case "pvt":
      return <ReactionTimeTest variant="pvt" onComplete={onComplete} />;
    case "simple_rt":
      return <ReactionTimeTest variant="simple" onComplete={onComplete} />;
    case "digit_symbol":
      return <DigitSymbolTest onComplete={onComplete} />;
    case "two_back":
      return <TwoBackTest onComplete={onComplete} />;
    case "stroop":
      return <StroopTest onComplete={onComplete} />;
    case "short_term_memory":
      return <ShortTermMemoryTest onComplete={onComplete} />;
    case "kss":
      return <KssTest onComplete={onComplete} />;
    default:
      return null;
  }
}
