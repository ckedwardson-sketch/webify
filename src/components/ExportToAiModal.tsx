import { useEffect, useMemo, useState } from "react";
import JSZip from "jszip";
import { View } from "../types/nav";
import { useTheme } from "../theme/ThemeContext";
import { ThemeExport } from "../theme/themeExport";
import { buildThemeReferenceDoc } from "../theme/themeReference";
import { buildAiDesignerInstructions } from "../theme/aiDesignerInstructions";
import { buildCaptureTargets, CaptureTarget } from "../capture/captureTargetList";
import { fetchCaptureSelection, setCaptureTargetSelected } from "../db/captureTargets";
import { capturesToPdfBlob, downloadBlob, runCaptureBatch } from "../capture/captureEngine";
import "./ExportToAiModal.css";

const GROUPS: CaptureTarget["group"][] = [
  "App Pages",
  "Categories",
  "Recipes",
  "Dreams",
  "Goals",
  "Projects",
  "Responsibilities",
];

// The "Export to AI" flow: pick which pages to screenshot (preference
// is persisted via the same capture_targets table the floating capture
// widget uses, so the two stay in sync), describe the theme idea in
// plain English, then bundle a screenshot PDF + the current theme state
// + a fully-annotated reference of every theme variable + a written
// brief for the AI designer into one .zip.
export function ExportToAiModal({
  getThemeExport,
  onNavigate,
  onClose,
}: {
  getThemeExport: () => ThemeExport;
  onNavigate: (view: View) => void;
  onClose: () => void;
}) {
  const { theme } = useTheme();
  const [targets, setTargets] = useState<CaptureTarget[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loadingTargets, setLoadingTargets] = useState(true);
  const [ideaText, setIdeaText] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    buildCaptureTargets()
      .then(setTargets)
      .finally(() => setLoadingTargets(false));
    fetchCaptureSelection().then((keys) => setSelected(new Set(keys)));
  }, []);

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

  const groupedTargets = useMemo(
    () => GROUPS.map((group) => ({ group, items: targets.filter((t) => t.group === group) })).filter((g) => g.items.length > 0),
    [targets]
  );

  const handleGenerate = async () => {
    setBusy(true);
    setError(null);
    setStatus("Starting…");

    try {
      const selectedTargets = targets.filter((t) => selected.has(t.key));
      let pdfBlob: Blob | null = null;
      let errorSummary = "";

      if (selectedTargets.length > 0) {
        const { captures, errors } = await runCaptureBatch({
          targets: selectedTargets,
          currentView: { type: "settings-home" },
          onNavigate,
          onProgress: (message) => setStatus(message),
        });
        if (captures.length > 0) {
          setStatus("Building screenshot PDF…");
          pdfBlob = capturesToPdfBlob(captures);
        }
        if (errors.length > 0) {
          errorSummary = `${errors.length} of ${selectedTargets.length} page(s) failed to capture and were skipped: ${errors
            .map((e) => e.label)
            .join(", ")}.`;
        }
      }

      setStatus("Packaging theme + instructions…");
      const generatedAt = new Date().toISOString();
      const themeExport = getThemeExport();
      const referenceDoc = buildThemeReferenceDoc(theme);
      const instructions = buildAiDesignerInstructions({
        userIdea: ideaText,
        pageLabels: selectedTargets.map((t) => t.label),
        generatedAt,
      });

      const zip = new JSZip();
      zip.file("AI_DESIGNER_INSTRUCTIONS.md", instructions);
      zip.file("theme-current-state.json", JSON.stringify(themeExport, null, 2));
      zip.file("theme-variable-reference.json", JSON.stringify(referenceDoc, null, 2));
      if (pdfBlob) zip.file("screenshots.pdf", pdfBlob);

      const zipBlob = await zip.generateAsync({ type: "blob" });
      const filename = `webify-ai-theme-export-${generatedAt.slice(0, 10)}.zip`;
      downloadBlob(zipBlob, filename);

      setStatus(
        `Exported ${filename}${pdfBlob ? ` with ${selectedTargets.length} screenshot(s)` : " (no screenshots included)"}.` +
          (errorSummary ? ` ${errorSummary}` : "")
      );
    } catch (err) {
      console.error("Export to AI failed:", err);
      setError(err instanceof Error ? err.message : String(err));
      setStatus(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="export-ai-backdrop" onClick={busy ? undefined : onClose} />
      <div className="export-ai-modal">
        <h3 className="export-ai-title">Export to AI</h3>
        <p className="export-ai-subtitle">
          Bundle screenshots, the current theme, and a fully-annotated variable reference into one package an AI
          designer can use to build you a new theme.
        </p>

        <label className="export-ai-label">Which pages should be screenshotted?</label>
        <div className="export-ai-checklist">
          {loadingTargets && <p className="export-ai-hint">Loading pages…</p>}
          {!loadingTargets && groupedTargets.length === 0 && <p className="export-ai-hint">No pages found.</p>}
          {groupedTargets.map(({ group, items }) => (
            <div key={group} className="export-ai-group">
              <div className="export-ai-group-title">{group}</div>
              {items.map((t) => (
                <label key={t.key} className="export-ai-checkbox-row">
                  <input type="checkbox" checked={selected.has(t.key)} onChange={() => toggleTarget(t.key)} disabled={busy} />
                  {t.label}
                </label>
              ))}
            </div>
          ))}
        </div>

        <label className="export-ai-label" htmlFor="export-ai-idea">
          Describe your theme idea
        </label>
        <textarea
          id="export-ai-idea"
          className="export-ai-textarea"
          placeholder='e.g. "moody cyberpunk, neon accents, sharp corners, chunky bold headings" — the AI is instructed to favor bold, cohesive, widespread changes over subtle tweaks.'
          rows={4}
          value={ideaText}
          onChange={(e) => setIdeaText(e.target.value)}
          disabled={busy}
        />

        {status && <p className="export-ai-status">{status}</p>}
        {error && <p className="export-ai-error">{error}</p>}

        <div className="export-ai-actions">
          <button className="add-button secondary" onClick={onClose} disabled={busy}>
            Close
          </button>
          <button className="add-button" onClick={handleGenerate} disabled={busy}>
            {busy ? "Generating…" : "Generate AI Export Package"}
          </button>
        </div>
      </div>
    </>
  );
}
