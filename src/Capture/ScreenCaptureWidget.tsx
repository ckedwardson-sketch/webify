import { useEffect, useState } from "react";
import { View } from "../types/nav";
import { buildCaptureTargets, CaptureTarget } from "./captureTargetList";
import { fetchCaptureSelection, setCaptureTargetSelected } from "../db/captureTargets";
import { ReportIssueModal } from "../components/ReportIssueModal";
import {
  CAPTURE_WIDGET_HIDE_ID,
  Capture,
  capturesToPdfBlob,
  captureViewport,
  downloadBlob,
  runCaptureBatch,
} from "./captureEngine";

export function ScreenCaptureWidget({
  view,
  onNavigate,
}: {
  view: View;
  onNavigate: (view: View) => void;
}) {
  const [open, setOpen] = useState(false);
  const [showChecklist, setShowChecklist] = useState(false);
  const [targets, setTargets] = useState<CaptureTarget[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [captures, setCaptures] = useState<Capture[]>([]);
  const [batchProgress, setBatchProgress] = useState<string | null>(null);
  const [showReportIssue, setShowReportIssue] = useState(false);

  useEffect(() => {
    if (!open) return;
    buildCaptureTargets().then(setTargets);
    fetchCaptureSelection().then((keys) => setSelected(new Set(keys)));
  }, [open]);

  const toggleTarget = async (key: string) => {
    const isSelected = selected.has(key);
    await setCaptureTargetSelected(key, !isSelected);
    setSelected((prev) => {
      const next = new Set(prev);
      if (isSelected) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const [batchError, setBatchError] = useState<string | null>(null);

  const captureCurrentPage = async (label: string) => {
    const shot = await captureViewport();
    setCaptures((prev) => [...prev, { ...shot, label }]);
  };

  const captureThisPageNow = async () => {
    setBatchError(null);
    try {
      await captureCurrentPage(`Current page (${new Date().toLocaleTimeString()})`);
    } catch (err) {
      console.error("Capture failed:", err);
      setBatchError(err instanceof Error ? err.message : String(err));
    }
  };

  // Same raw screenshot mechanism as captureCurrentPage, just handed
  // to the ReportIssueModal instead of added to the batch list.
  const captureForIssueReport = async (): Promise<string> => {
    const shot = await captureViewport();
    return shot.dataUrl;
  };

  const runBatchCapture = async () => {
    const selectedTargets = targets.filter((t) => selected.has(t.key));
    if (selectedTargets.length === 0) return;

    setBatchError(null);
    setCaptures([]);
    setBatchProgress(`Capturing 1 / ${selectedTargets.length}...`);

    const { captures: results, errors } = await runCaptureBatch({
      targets: selectedTargets,
      currentView: view,
      onNavigate,
      onProgress: (message) => setBatchProgress(message),
    });

    setCaptures(results);
    setBatchProgress(null);
    if (errors.length > 0) {
      setBatchError(
        `${errors.length} of ${selectedTargets.length} page(s) failed to capture: ${errors
          .map((e) => e.label)
          .join(", ")}`
      );
    }
  };

  const removeCapture = (idx: number) => {
    setCaptures((prev) => prev.filter((_, i) => i !== idx));
  };

  const clearAll = () => setCaptures([]);

  const exportPdf = () => {
    if (captures.length === 0) return;
    const blob = capturesToPdfBlob(captures);
    downloadBlob(blob, `webify-screenshots-${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  const groups: CaptureTarget["group"][] = [
    "App Pages",
    "Categories",
    "Recipes",
    "Dreams",
    "Goals",
    "Projects",
    "Responsibilities",
  ];

  return (
    <div
      id={CAPTURE_WIDGET_HIDE_ID}
      style={{
        position: "fixed",
        bottom: "calc(16px + env(safe-area-inset-bottom))",
        right: "calc(16px + env(safe-area-inset-right))",
        zIndex: 9999,
      }}
    >
      {open && (
        <div
          style={{
            width: 300,
            maxHeight: 500,
            overflowY: "auto",
            background: "#fff",
            border: "1px solid #ccc",
            borderRadius: 8,
            boxShadow: "0 6px 20px rgba(0,0,0,0.25)",
            padding: 10,
            marginBottom: 8,
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: "#222" }}>
            Screen Capture
          </div>

          <button
            onClick={() => setShowChecklist((v) => !v)}
            style={{
              width: "100%",
              padding: "6px",
              marginBottom: 6,
              background: "#f5f5f5",
              border: "1px solid #ccc",
              borderRadius: 4,
              cursor: "pointer",
              fontSize: 12,
            }}
          >
            {showChecklist ? "Hide checklist" : `Choose pages (${selected.size} selected)`}
          </button>

          {showChecklist && (
            <div
              style={{
                border: "1px solid #eee",
                borderRadius: 4,
                padding: 6,
                marginBottom: 8,
                maxHeight: 200,
                overflowY: "auto",
              }}
            >
              {groups.map((group) => {
                const groupTargets = targets.filter((t) => t.group === group);
                if (groupTargets.length === 0) return null;
                return (
                  <div key={group} style={{ marginBottom: 6 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "#888", marginBottom: 2 }}>
                      {group}
                    </div>
                    {groupTargets.map((t) => (
                      <label
                        key={t.key}
                        style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, padding: "2px 0" }}
                      >
                        <input
                          type="checkbox"
                          checked={selected.has(t.key)}
                          onChange={() => toggleTarget(t.key)}
                        />
                        {t.label}
                      </label>
                    ))}
                  </div>
                );
              })}
            </div>
          )}

          <button
            onClick={runBatchCapture}
            disabled={selected.size === 0 || batchProgress !== null}
            style={{
              width: "100%",
              padding: "8px",
              marginBottom: 6,
              background: "#2563eb",
              color: "#fff",
              border: "none",
              borderRadius: 4,
              cursor: "pointer",
              fontSize: 12,
            }}
          >
            {batchProgress ?? `Batch Capture (${selected.size})`}
          </button>

          {batchError && (
            <div
              style={{
                fontSize: 11,
                color: "#b91c1c",
                background: "#fef2f2",
                border: "1px solid #fca5a5",
                borderRadius: 4,
                padding: 6,
                marginBottom: 6,
              }}
            >
              {batchError}
            </div>
          )}

          <button
            onClick={captureThisPageNow}
            disabled={batchProgress !== null}
            style={{
              width: "100%",
              padding: "6px",
              marginBottom: 6,
              background: "#f5f5f5",
              border: "1px solid #ccc",
              borderRadius: 4,
              cursor: "pointer",
              fontSize: 12,
            }}
          >
            Capture Just This Page
          </button>

          <button
            onClick={() => setShowReportIssue(true)}
            disabled={batchProgress !== null}
            style={{
              width: "100%",
              padding: "6px",
              marginBottom: 8,
              background: "#fef2f2",
              border: "1px solid #fca5a5",
              color: "#b91c1c",
              borderRadius: 4,
              cursor: "pointer",
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            Report Issue
          </button>

          {captures.length > 0 && (
            <div style={{ fontSize: 12, color: "#444", marginBottom: 6 }}>
              {captures.length} captured
            </div>
          )}

          {captures.map((cap, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                marginBottom: 4,
                border: "1px solid #eee",
                borderRadius: 4,
                padding: 4,
              }}
            >
              <img
                src={cap.dataUrl}
                alt={cap.label}
                style={{ width: 40, height: 30, objectFit: "cover", borderRadius: 3 }}
              />
              <span style={{ flex: 1, fontSize: 11, color: "#444" }}>{cap.label}</span>
              <button
                onClick={() => removeCapture(i)}
                style={{ border: "none", background: "none", color: "#c00", cursor: "pointer", fontSize: 12 }}
              >
                ✕
              </button>
            </div>
          ))}

          {captures.length > 0 && (
            <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
              <button
                onClick={exportPdf}
                style={{
                  flex: 1,
                  padding: "6px",
                  background: "#333",
                  color: "#fff",
                  border: "none",
                  borderRadius: 4,
                  cursor: "pointer",
                  fontSize: 12,
                }}
              >
                Export PDF
              </button>
              <button
                onClick={clearAll}
                style={{
                  padding: "6px 10px",
                  background: "#f5f5f5",
                  border: "1px solid #ccc",
                  borderRadius: 4,
                  cursor: "pointer",
                  fontSize: 12,
                }}
              >
                Clear
              </button>
            </div>
          )}
        </div>
      )}

      <button
        onClick={() => setOpen((v) => !v)}
        title="Screen capture"
        style={{
          width: 44,
          height: 44,
          borderRadius: "50%",
          background: "#333",
          color: "#fff",
          border: "none",
          fontSize: 18,
          cursor: "pointer",
          boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
        }}
      >
        📷
      </button>

      {showReportIssue && (
        <ReportIssueModal
          onCapture={captureForIssueReport}
          onClose={() => setShowReportIssue(false)}
        />
      )}
    </div>
  );
}
