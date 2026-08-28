import { SaveStatus } from "../hooks/useSaveFeedback";

export function SaveStatusIndicator({ status }: { status: SaveStatus }) {
  if (status === "idle") return null;
  return (
    <span className={`save-status${status === "saved" ? " save-status-success" : ""}`}>
      {status === "saving" ? "Saving…" : "✓ Saved"}
    </span>
  );
}
