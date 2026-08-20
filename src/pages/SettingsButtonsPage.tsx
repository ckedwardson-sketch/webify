import { useState } from "react";
import { View } from "../types/nav";
import { Breadcrumb } from "../components/Breadcrumb";
import { StyledButton, resolveButtonStyle } from "../icons/StyledButton";
import { useButtonStyles } from "../icons/ButtonStyleContext";
import { BUTTON_STYLE_REGISTRY } from "../icons/buttonRegistry";
import "./Page.css";
import "./SettingsIconsPage.css";

type Draft = {
  text: string;
  fontFamily: string;
  fontSize: number;
  textColor: string;
  backgroundColor: string;
  borderColor: string;
  paddingX: number;
  paddingY: number;
  borderRadius: number;
};

export function SettingsButtonsPage({ onNavigate }: { onNavigate: (view: View) => void }) {
  const { overrides, setOverride, clearOverride } = useButtonStyles();
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});

  const draftFor = (key: string): Draft => {
    if (drafts[key]) return drafts[key];
    return resolveButtonStyle(key, overrides);
  };

  const updateDraft = (key: string, patch: Partial<Draft>) => {
    setDrafts((prev) => ({ ...prev, [key]: { ...draftFor(key), ...patch } }));
  };

  const save = (key: string) => {
    setOverride(key, draftFor(key));
  };

  const reset = (key: string) => {
    clearOverride(key);
    setDrafts((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  return (
    <div className="page">
      <Breadcrumb
        crumbs={[
          { label: "Settings", onClick: () => onNavigate({ type: "settings-home" }) },
          { label: "Buttons" },
        ]}
      />
      <h1 className="page-title">Buttons</h1>
      <p className="page-text">
        Change the text, font, colors, or box size of styled buttons used around the app.
      </p>

      <div className="icon-settings-list">
        {BUTTON_STYLE_REGISTRY.map((def) => {
          const draft = draftFor(def.key);
          return (
            <div key={def.key} className="button-settings-row">
              <div className="button-settings-preview">
                <StyledButton buttonKey={def.key} />
              </div>
              <div className="icon-settings-info">
                <div className="icon-settings-label">{def.label}</div>
                <div className="icon-settings-key">{def.key}</div>
                <div className="button-settings-fields">
                  <label className="button-settings-field">
                    Text
                    <input
                      type="text"
                      value={draft.text}
                      onChange={(e) => updateDraft(def.key, { text: e.target.value })}
                    />
                  </label>
                  <label className="button-settings-field">
                    Font
                    <input
                      type="text"
                      value={draft.fontFamily}
                      onChange={(e) => updateDraft(def.key, { fontFamily: e.target.value })}
                    />
                  </label>
                  <label className="button-settings-field narrow">
                    Font size
                    <input
                      type="number"
                      min={8}
                      max={48}
                      value={draft.fontSize}
                      onChange={(e) => updateDraft(def.key, { fontSize: Number(e.target.value) })}
                    />
                  </label>
                  <label className="button-settings-field narrow">
                    Text color
                    <input
                      type="color"
                      value={draft.textColor}
                      onChange={(e) => updateDraft(def.key, { textColor: e.target.value })}
                    />
                  </label>
                  <label className="button-settings-field narrow">
                    Background
                    <input
                      type="color"
                      value={draft.backgroundColor}
                      onChange={(e) => updateDraft(def.key, { backgroundColor: e.target.value })}
                    />
                  </label>
                  <label className="button-settings-field narrow">
                    Outline color
                    <input
                      type="color"
                      value={draft.borderColor}
                      onChange={(e) => updateDraft(def.key, { borderColor: e.target.value })}
                    />
                  </label>
                  <label className="button-settings-field narrow">
                    Width padding
                    <input
                      type="number"
                      min={0}
                      max={80}
                      value={draft.paddingX}
                      onChange={(e) => updateDraft(def.key, { paddingX: Number(e.target.value) })}
                    />
                  </label>
                  <label className="button-settings-field narrow">
                    Height padding
                    <input
                      type="number"
                      min={0}
                      max={80}
                      value={draft.paddingY}
                      onChange={(e) => updateDraft(def.key, { paddingY: Number(e.target.value) })}
                    />
                  </label>
                  <label className="button-settings-field narrow">
                    Corner radius
                    <input
                      type="number"
                      min={0}
                      max={40}
                      value={draft.borderRadius}
                      onChange={(e) => updateDraft(def.key, { borderRadius: Number(e.target.value) })}
                    />
                  </label>
                </div>
              </div>
              <div className="icon-settings-actions">
                <button className="add-button secondary" onClick={() => save(def.key)}>
                  Save
                </button>
                {overrides[def.key] && (
                  <button className="add-button danger" onClick={() => reset(def.key)}>
                    Reset
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
