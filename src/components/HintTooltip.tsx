import "./HintTooltip.css";

// A small "?" icon that reveals a hint on hover/focus instead of an
// always-visible text box permanently taking up screen space in a
// canvas corner (Dream Web / Goal Web's old always-on hint panels).
export function HintTooltip({ text }: { text: string }) {
  return (
    <div className="hint-tooltip">
      <button type="button" className="hint-tooltip-trigger" aria-label="Help" title="">
        ?
      </button>
      <div className="hint-tooltip-bubble" role="tooltip">
        {text}
      </div>
    </div>
  );
}
