import { useState } from "react";
import "./CalculatorWidget.css";

type Operator = "+" | "-" | "×" | "÷";

function applyOperator(a: number, b: number, op: Operator): number | null {
  switch (op) {
    case "+":
      return a + b;
    case "-":
      return a - b;
    case "×":
      return a * b;
    case "÷":
      if (b === 0) return null;
      return a / b;
  }
}

// Left-to-right evaluation, no operator precedence (e.g. 5 + 3 × 2 = 16,
// not 11) — matches the behavior of a simple standalone desk calculator.
export function CalculatorWidget({ widgetId: _widgetId }: { widgetId?: number }) {
  const [display, setDisplay] = useState("0");
  const [previousValue, setPreviousValue] = useState<number | null>(null);
  const [pendingOperator, setPendingOperator] = useState<Operator | null>(null);
  const [justEvaluated, setJustEvaluated] = useState(false);
  const [isError, setIsError] = useState(false);

  const handleClear = () => {
    setDisplay("0");
    setPreviousValue(null);
    setPendingOperator(null);
    setJustEvaluated(false);
    setIsError(false);
  };

  const handleDigit = (digit: string) => {
    if (isError) return;
    if (justEvaluated) {
      setDisplay(digit);
      setJustEvaluated(false);
      return;
    }
    setDisplay((prev) => (prev === "0" ? digit : prev + digit));
  };

  const handleDecimal = () => {
    if (isError) return;
    if (justEvaluated) {
      setDisplay("0.");
      setJustEvaluated(false);
      return;
    }
    setDisplay((prev) => (prev.includes(".") ? prev : prev + "."));
  };

  const handleOperator = (op: Operator) => {
    if (isError) return;
    const current = Number(display);

    if (pendingOperator && previousValue !== null && !justEvaluated) {
      const result = applyOperator(previousValue, current, pendingOperator);
      if (result === null) {
        setIsError(true);
        setDisplay("Error");
        setPreviousValue(null);
        setPendingOperator(null);
        return;
      }
      setPreviousValue(result);
      setDisplay(String(result));
    } else {
      setPreviousValue(current);
    }

    setPendingOperator(op);
    setJustEvaluated(false);
  };

  const handleEquals = () => {
    if (isError) return;
    if (pendingOperator === null || previousValue === null) return;
    const current = Number(display);
    const result = applyOperator(previousValue, current, pendingOperator);
    if (result === null) {
      setIsError(true);
      setDisplay("Error");
      setPreviousValue(null);
      setPendingOperator(null);
      return;
    }
    setDisplay(String(result));
    setPreviousValue(null);
    setPendingOperator(null);
    setJustEvaluated(true);
  };

  return (
    <div className="calculator-widget">
      <div className="calculator-display">{display}</div>
      <div className="calculator-grid">
        <button className="calculator-button calculator-button-function" onClick={handleClear}>
          C
        </button>
        <button className="calculator-button calculator-button-operator" onClick={() => handleOperator("÷")}>
          ÷
        </button>
        <button className="calculator-button calculator-button-operator" onClick={() => handleOperator("×")}>
          ×
        </button>
        <button className="calculator-button calculator-button-operator" onClick={() => handleOperator("-")}>
          -
        </button>

        <button className="calculator-button" onClick={() => handleDigit("7")}>7</button>
        <button className="calculator-button" onClick={() => handleDigit("8")}>8</button>
        <button className="calculator-button" onClick={() => handleDigit("9")}>9</button>
        <button className="calculator-button calculator-button-operator calculator-button-tall" onClick={() => handleOperator("+")}>
          +
        </button>

        <button className="calculator-button" onClick={() => handleDigit("4")}>4</button>
        <button className="calculator-button" onClick={() => handleDigit("5")}>5</button>
        <button className="calculator-button" onClick={() => handleDigit("6")}>6</button>

        <button className="calculator-button" onClick={() => handleDigit("1")}>1</button>
        <button className="calculator-button" onClick={() => handleDigit("2")}>2</button>
        <button className="calculator-button" onClick={() => handleDigit("3")}>3</button>
        <button className="calculator-button calculator-button-equals calculator-button-tall" onClick={handleEquals}>
          =
        </button>

        <button className="calculator-button calculator-button-wide" onClick={() => handleDigit("0")}>0</button>
        <button className="calculator-button" onClick={handleDecimal}>.</button>
      </div>
      <button className="calculator-saved-equations-button" disabled title="Coming soon">
        Saved Equations
      </button>
    </div>
  );
}
