import { useState } from "react";
import { addIssue } from "../db/issues";
import "./ReportIssueModal.css";

export function ReportIssueModal({
  onCapture,
  onClose,
}: {
  onCapture: () => Promise<string>; // returns a base64 screenshot data URL
  onClose: () => void;
}) {
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!note.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const screenshotData = await onCapture();
      await addIssue(note.trim(), screenshotData);
      onClose();
    } catch (err) {
      setError(String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="report-issue-backdrop" onClick={onClose} />
      <div className="report-issue-modal">
        <h3 className="report-issue-title">Report Issue</h3>
        <textarea
          className="report-issue-textarea"
          autoFocus
          placeholder="What's wrong?"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={4}
        />
        {error && <p className="report-issue-error">{error}</p>}
        <div className="report-issue-actions">
          <button className="add-button secondary" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button className="add-button" onClick={handleSubmit} disabled={saving || !note.trim()}>
            {saving ? "Saving…" : "Capture & Save"}
          </button>
        </div>
      </div>
    </>
  );
}
