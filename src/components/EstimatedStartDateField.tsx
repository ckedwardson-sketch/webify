import { useEffect, useState } from "react";
import { useSaveFeedback } from "../hooks/useSaveFeedback";
import { SaveStatusIndicator } from "./SaveStatusIndicator";

// A single rough date, not a range — deliberately simpler than
// DreamDateRangeField's precision modes, since "estimated start" is
// meant to be a quick guess, not something worth picking a month/year
// span for the way a done-by date is.
export function EstimatedStartDateField({
  value,
  onSave,
}: {
  value?: string;
  onSave: (date: string | null) => void | Promise<void>;
}) {
  const [draft, setDraft] = useState(value ?? "");
  const { status, run } = useSaveFeedback();

  useEffect(() => {
    setDraft(value ?? "");
  }, [value]);

  const handleSave = () => {
    run(() => onSave(draft || null));
  };

  return (
    <div className="save-row">
      <input
        type="date"
        className="inline-add-input"
        style={{ width: "auto", marginBottom: 0 }}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
      />
      <button className="add-button secondary" onClick={handleSave} disabled={status === "saving"}>
        {status === "saving" ? "Saving…" : "Save"}
      </button>
      <SaveStatusIndicator status={status === "saving" ? "idle" : status} />
    </div>
  );
}
