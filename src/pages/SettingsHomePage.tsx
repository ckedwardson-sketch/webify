import React, { useEffect, useMemo, useRef, useState } from "react";
import { View } from "../types/nav";
import { useIcons } from "../icons/IconContext";
import { useTextElements } from "../icons/TextElementContext";
import { useButtonStyles } from "../icons/ButtonStyleContext";
import { useTheme } from "../theme/ThemeContext";
import { fetchPresets, savePreset, deletePreset, fetchPresetData, ThemePresetRow } from "../db/themePresets";
import { buildSettingsSearchIndex } from "./settingsSearchIndex";
import { useDynamicOverlay } from "../overlay/DynamicOverlayContext";
import { ThemeExport } from "../theme/themeExport";
import { isValidCustomSliderDef } from "../theme/customSliders";
import { ExportToAiModal } from "../components/ExportToAiModal";
import { CustomThemeSliders } from "../components/CustomThemeSliders";
import "./Page.css";
import "./SettingsShared.css";

const NAV_CARDS: { view: View; title: string; desc: string }[] = [
  { view: { type: "settings-icons" }, title: "Icons", desc: "Replace any glyph with a custom image" },
  { view: { type: "settings-text" }, title: "Text Elements", desc: "Editor toolbar letters, size, color" },
  { view: { type: "settings-buttons" }, title: "Buttons", desc: "Text, font, colors, box size" },
  { view: { type: "settings-theme" }, title: "Theme", desc: "Colors, fonts, radius, density, backgrounds" },
  { view: { type: "settings-editor" }, title: "Editor Tools", desc: "Toolbar, right-click menu, selection menu, slash commands" },
  { view: { type: "settings-headers" }, title: "Headers", desc: "Sidebar title/nav item font size, color, bold, underline" },
  { view: { type: "settings-issues" }, title: "Reported Issues", desc: "Notes + screenshots saved from the capture button" },
  { view: { type: "settings-dynamic-search" }, title: "Dynamic Settings Search", desc: "Every setting, grouped by page and location" },
];

export function SettingsHomePage({ onNavigate }: { onNavigate: (view: View) => void }) {
  const { overrides: iconOverrides, setOverride: setIconOverride, clearOverride: clearIconOverride } =
    useIcons();
  const {
    overrides: textOverrides,
    setOverride: setTextOverride,
    clearOverride: clearTextOverride,
  } = useTextElements();
  const {
    overrides: buttonOverrides,
    setOverride: setButtonOverride,
    clearOverride: clearButtonOverride,
  } = useButtonStyles();
  const { overrides: themeOverrides, replaceTheme, customSliders, replaceCustomSliders } = useTheme();
  const { requestQuickEdit } = useDynamicOverlay();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [presets, setPresets] = useState<ThemePresetRow[]>([]);
  const [presetNameDraft, setPresetNameDraft] = useState("");
  const [savingPreset, setSavingPreset] = useState(false);
  const [showExportToAi, setShowExportToAi] = useState(false);

  const searchIndex = useMemo(() => buildSettingsSearchIndex(), []);
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return searchIndex
      .filter(
        (item) =>
          item.label.toLowerCase().includes(q) ||
          item.key.toLowerCase().includes(q) ||
          item.section.toLowerCase().includes(q)
      )
      .slice(0, 30);
  }, [query, searchIndex]);

  const loadPresets = () => {
    fetchPresets()
      .then(setPresets)
      .catch((err) => console.error("Failed to load theme presets:", err));
  };

  useEffect(() => {
    loadPresets();
  }, []);

  const captureCurrentExport = (): ThemeExport => ({
    icons: iconOverrides,
    textElements: textOverrides,
    buttonStyles: buttonOverrides,
    themeSettings: themeOverrides,
    // Export each slider's *current* value as its default, so
    // re-importing this exact file reproduces what's on screen now
    // rather than resetting sliders back to whatever the original
    // designer shipped.
    customSliders: customSliders.map(({ value, ...def }) => ({ ...def, default: value })),
  });

  // Shared by file import and preset-apply: full replace, not merge —
  // clears whatever's currently customized in each system first so
  // switching themes doesn't leave stale overrides behind from whatever
  // was active before.
  const applyThemeExport = async (parsed: Partial<ThemeExport>) => {
    const icons = parsed.icons ?? {};
    const textElements = parsed.textElements ?? {};
    const buttonStyles = parsed.buttonStyles ?? {};
    const themeSettings = parsed.themeSettings ?? {};
    const customSliderDefs = Array.isArray(parsed.customSliders)
      ? parsed.customSliders.filter(isValidCustomSliderDef)
      : [];

    for (const key of Object.keys(iconOverrides)) await clearIconOverride(key);
    for (const key of Object.keys(textOverrides)) await clearTextOverride(key);
    for (const key of Object.keys(buttonOverrides)) await clearButtonOverride(key);
    await replaceTheme(themeSettings);
    await replaceCustomSliders(customSliderDefs);

    let iconCount = 0,
      textCount = 0,
      buttonCount = 0;

    for (const [key, imageData] of Object.entries(icons)) {
      if (typeof imageData === "string") {
        await setIconOverride(key, imageData);
        iconCount++;
      }
    }
    for (const [key, override] of Object.entries(textElements)) {
      if (override && typeof override === "object") {
        await setTextOverride(key, override);
        textCount++;
      }
    }
    for (const [key, override] of Object.entries(buttonStyles)) {
      if (override && typeof override === "object") {
        await setButtonOverride(key, override);
        buttonCount++;
      }
    }

    return {
      iconCount,
      textCount,
      buttonCount,
      themeCount: Object.keys(themeSettings).length,
      sliderCount: customSliderDefs.length,
    };
  };

  const handleExport = () => {
    const data = captureCurrentExport();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `webify-theme-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setStatus(`Exported ${a.download}.`);
  };

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setStatus(`Reading ${file.name}...`);

    const reader = new FileReader();
    reader.onerror = () => {
      console.error("FileReader error:", reader.error);
      setStatus(`Failed to read the file: ${reader.error?.message ?? "unknown error"}`);
    };
    reader.onload = async () => {
      let parsed: Partial<ThemeExport>;
      try {
        parsed = JSON.parse(reader.result as string) as Partial<ThemeExport>;
      } catch (err) {
        console.error("Theme JSON parse error:", err, "raw content:", reader.result);
        setStatus(`That file isn't valid JSON: ${err instanceof Error ? err.message : String(err)}`);
        return;
      }

      try {
        const counts = await applyThemeExport(parsed);
        setStatus(
          `Imported: ${counts.iconCount} icons, ${counts.textCount} text elements, ${counts.buttonCount} button styles, ${counts.themeCount} theme settings, ${counts.sliderCount} custom sliders.`
        );
      } catch (err) {
        console.error("Theme import error:", err);
        setStatus(`Import failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleSavePreset = async () => {
    const name = presetNameDraft.trim();
    if (!name) return;
    setSavingPreset(true);
    try {
      const data = JSON.stringify(captureCurrentExport());
      await savePreset(name, data);
      setPresetNameDraft("");
      loadPresets();
      setStatus(`Saved preset "${name}".`);
    } catch (err) {
      console.error("Save preset error:", err);
      setStatus(`Failed to save preset: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSavingPreset(false);
    }
  };

  const handleApplyPreset = async (preset: ThemePresetRow) => {
    setStatus(`Applying "${preset.name}"...`);
    try {
      const raw = await fetchPresetData(preset.id);
      if (!raw) {
        setStatus(`Preset "${preset.name}" has no data.`);
        return;
      }
      const parsed = JSON.parse(raw) as Partial<ThemeExport>;
      const counts = await applyThemeExport(parsed);
      setStatus(
        `Applied "${preset.name}": ${counts.iconCount} icons, ${counts.textCount} text elements, ${counts.buttonCount} button styles, ${counts.themeCount} theme settings, ${counts.sliderCount} custom sliders.`
      );
    } catch (err) {
      console.error("Apply preset error:", err);
      setStatus(`Failed to apply preset: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handleDeletePreset = async (preset: ThemePresetRow) => {
    try {
      await deletePreset(preset.id);
      loadPresets();
    } catch (err) {
      console.error("Delete preset error:", err);
      setStatus(`Failed to delete preset: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  return (
    <div className="page">
      <h1 className="page-title">Settings</h1>

      <input
        className="settings-search"
        placeholder='Search all settings (e.g. "filter button", "proven", "radius")...'
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      {query.trim() && (
        results.length === 0 ? (
          <p className="settings-search-empty">No matches for "{query}".</p>
        ) : (
          <div className="settings-search-results">
            {results.map((item) => (
              <button
                key={`${item.section}:${item.key}`}
                className="settings-search-result"
                onClick={() => {
                  // Opens the setting inline in the Dynamic Search
                  // overlay instead of navigating to its real page — the
                  // whole point of search is finding+changing it without
                  // leaving where you are.
                  requestQuickEdit(item);
                  setQuery("");
                }}
              >
                <span className="settings-search-result-section">{item.section}</span>
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        )
      )}

      <div className="settings-card-grid">
        {NAV_CARDS.map((card) => (
          <button key={card.title} className="settings-card" onClick={() => onNavigate(card.view)}>
            <span className="settings-card-title">{card.title}</span>
            <span className="settings-card-desc">{card.desc}</span>
          </button>
        ))}
      </div>

      <div className="theme-section">
        <h2 className="theme-section-title">Saved theme presets</h2>
        <div className="theme-color-list">
          <div className="theme-color-row">
            <input
              className="inline-add-input"
              style={{ marginBottom: 0, flex: 1 }}
              placeholder="Preset name"
              value={presetNameDraft}
              onChange={(e) => setPresetNameDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSavePreset()}
            />
            <button
              className="add-button secondary"
              onClick={handleSavePreset}
              disabled={!presetNameDraft.trim() || savingPreset}
            >
              Save current as preset
            </button>
          </div>

          {presets.length === 0 && <p className="page-text">No saved presets yet.</p>}

          {presets.map((preset) => (
            <div key={preset.id} className="theme-color-row">
              <span className="theme-color-label">{preset.name}</span>
              <button className="add-button secondary" onClick={() => handleApplyPreset(preset)}>
                Apply
              </button>
              <button className="add-button danger" onClick={() => handleDeletePreset(preset)}>
                Delete
              </button>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", gap: "10px", marginTop: "20px" }}>
        <button className="add-button secondary" onClick={handleExport}>
          Export Theme
        </button>
        <button className="add-button secondary" onClick={() => fileInputRef.current?.click()}>
          Import Theme
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          style={{ display: "none" }}
          onChange={handleFileSelected}
        />
      </div>

      <div style={{ marginTop: "10px" }}>
        <button className="add-button" onClick={() => setShowExportToAi(true)}>
          Export to AI
        </button>
      </div>

      {status && (
        <p style={{ marginTop: "12px", fontSize: "0.85rem", color: "var(--color-text-secondary)" }}>
          {status}
        </p>
      )}

      <div style={{ marginTop: "20px" }}>
        <CustomThemeSliders />
      </div>

      {showExportToAi && (
        <ExportToAiModal
          getThemeExport={captureCurrentExport}
          onNavigate={onNavigate}
          onClose={() => setShowExportToAi(false)}
        />
      )}
    </div>
  );
}
