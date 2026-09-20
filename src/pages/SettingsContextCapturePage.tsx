import { useEffect, useState } from "react";
import { View } from "../types/nav";
import { Breadcrumb } from "../components/Breadcrumb";
import { fetchContextCaptureSelection, setContextCaptureTargetSelected } from "../db/contextCaptureTargets";
import { buildContextCaptureTargets, ContextGroup, ContextTarget, downloadContextReport, generateContextReport } from "../capture/contextReport";
import "./Page.css";
import "./SettingsShared.css";

const GROUPS: ContextGroup[] = ["Categories", "Recipes", "Dreams", "Goals", "Projects", "Responsibilities"];

export function SettingsContextCapturePage({ onNavigate }: { onNavigate: (view: View) => void }) {
  const [targets, setTargets] = useState<ContextTarget[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([buildContextCaptureTargets(), fetchContextCaptureSelection()]).then(([built, keys]) => {
      setTargets(built);
      setSelected(new Set(keys));
      setLoading(false);
    });
  }, []);

  const toggleTarget = (key: string) => {
    const isSelected = selected.has(key);
    setContextCaptureTargetSelected(key, !isSelected).catch((err) =>
      console.error("Failed to persist capture-context selection:", err)
    );
    setSelected((prev) => {
      const next = new Set(prev);
      if (isSelected) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const runGenerate = async () => {
    const selectedTargets = targets.filter((t) => selected.has(t.key));
    if (selectedTargets.length === 0 || running) return;

    setRunning(true);
    setError(null);
    setResult(null);
    setProgress("Starting…");

    try {
      const { blob, sectionCount, errors } = await generateContextReport(selectedTargets, setProgress);
      const filename = `webify-capture-context-${new Date().toISOString().slice(0, 10)}.pdf`;
      downloadContextReport(blob, filename);
      setResult(`Saved ${filename} (${sectionCount} item(s)).`);
      if (errors.length > 0) {
        setError(`${errors.length} item(s) couldn't be read and were left out: ${errors.map((e) => e.label).join(", ")}`);
      }
    } catch (err) {
      console.error("Capture Context generation failed:", err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRunning(false);
      setProgress(null);
    }
  };

  return (
    <div className="page">
      <Breadcrumb
        crumbs={[
          { label: "Settings", onClick: () => onNavigate({ type: "settings-home" }) },
          { label: "Capture Context" },
        ]}
      />
      <h1 className="page-title">Capture Context</h1>
      <p className="page-text">
        Choose what to include, then generate one PDF report: each item gets its title, its actual
        fields (goals, reasoning, journal entries, cost logs, etc.) as plain readable text, and any
        photos or images attached to it — pulled straight from your data, not a picture of the app.
        Images are compressed so the file stays a reasonable size.
      </p>

      {loading ? (
        <p className="page-text">Loading…</p>
      ) : (
        <div className="theme-section">
          <h2 className="theme-section-title">Items to include ({selected.size} selected)</h2>
          <div className="theme-color-list" style={{ maxHeight: 360, overflowY: "auto" }}>
            {GROUPS.map((group) => {
              const groupTargets = targets.filter((t) => t.group === group);
              if (groupTargets.length === 0) return null;
              return (
                <div key={group} style={{ marginBottom: 10 }}>
                  <div
                    style={{
                      fontSize: "0.75rem",
                      fontWeight: 600,
                      color: "var(--color-text-secondary)",
                      marginBottom: 4,
                      textTransform: "uppercase",
                      letterSpacing: "0.03em",
                    }}
                  >
                    {group}
                  </div>
                  {groupTargets.map((t) => (
                    <label
                      key={t.key}
                      style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.85rem", padding: "3px 0" }}
                    >
                      <input
                        type="checkbox"
                        checked={selected.has(t.key)}
                        onChange={() => toggleTarget(t.key)}
                        disabled={running}
                      />
                      {t.label}
                    </label>
                  ))}
                </div>
              );
            })}
            {targets.length === 0 && <p className="page-text">Nothing to capture yet — add a dream, goal, project, recipe, or responsibility first.</p>}
          </div>
        </div>
      )}

      <div style={{ marginTop: "16px", display: "flex", gap: "8px", alignItems: "center" }}>
        <button className="add-button" onClick={runGenerate} disabled={selected.size === 0 || running}>
          {running ? progress ?? "Working…" : `Generate PDF Report (${selected.size})`}
        </button>
      </div>

      {result && (
        <p style={{ marginTop: "12px", fontSize: "0.85rem", color: "var(--color-text-secondary)" }}>{result}</p>
      )}
      {error && <p style={{ marginTop: "8px", fontSize: "0.85rem", color: "#b91c1c" }}>{error}</p>}
    </div>
  );
}
