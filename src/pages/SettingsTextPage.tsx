import { useState } from "react";
import { View } from "../types/nav";
import { Breadcrumb } from "../components/Breadcrumb";
import { TextElement } from "../icons/TextElement";
import { useTextElements } from "../icons/TextElementContext";
import { TEXT_ELEMENT_REGISTRY } from "../icons/textRegistry";
import "./Page.css";
import "./SettingsIconsPage.css";

export function SettingsTextPage({ onNavigate }: { onNavigate: (view: View) => void }) {
  const { overrides, setOverride, clearOverride } = useTextElements();
  const [drafts, setDrafts] = useState<Record<string, { text: string; size: number; color: string }>>({});

  const draftFor = (key: string) => {
    if (drafts[key]) return drafts[key];
    const def = TEXT_ELEMENT_REGISTRY.find((d) => d.key === key)!;
    const override = overrides[key];
    return {
      text: override?.text ?? def.defaultText,
      size: override?.size ?? def.defaultSize,
      color: override?.color ?? def.defaultColor,
    };
  };

  const updateDraft = (key: string, patch: Partial<{ text: string; size: number; color: string }>) => {
    setDrafts((prev) => ({ ...prev, [key]: { ...draftFor(key), ...patch } }));
  };

  const save = (key: string) => {
    const draft = draftFor(key);
    setOverride(key, draft);
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
          { label: "Text Elements" },
        ]}
      />
      <h1 className="page-title">Text Elements</h1>
      <p className="page-text">
        Change the text, size, or color of the letter-based buttons used around the app.
      </p>

      <div className="icon-settings-list">
        {TEXT_ELEMENT_REGISTRY.map((def) => {
          const draft = draftFor(def.key);
          return (
            <div key={def.key} className="icon-settings-row">
              <div className="icon-settings-preview">
                <TextElement elementKey={def.key} />
              </div>
              <div className="icon-settings-info">
                <div className="icon-settings-label">{def.label}</div>
                <div className="icon-settings-key">{def.key}</div>
                <div className="text-settings-fields">
                  <input
                    className="text-settings-text"
                    value={draft.text}
                    maxLength={4}
                    onChange={(e) => updateDraft(def.key, { text: e.target.value })}
                  />
                  <input
                    className="text-settings-size"
                    type="number"
                    min={8}
                    max={48}
                    value={draft.size}
                    onChange={(e) => updateDraft(def.key, { size: Number(e.target.value) })}
                  />
                  <input
                    className="text-settings-color"
                    type="color"
                    value={draft.color}
                    onChange={(e) => updateDraft(def.key, { color: e.target.value })}
                  />
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
