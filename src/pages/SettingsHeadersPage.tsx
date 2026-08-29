import { useState } from "react";
import { View } from "../types/nav";
import { Breadcrumb } from "../components/Breadcrumb";
import { StyledHeader } from "../components/StyledHeader";
import { useHeaderStyles } from "../icons/HeaderStyleContext";
import { HEADER_STYLE_REGISTRY } from "../icons/headerRegistry";
import { useSettingsFocus } from "./useSettingsFocus";
import "./Page.css";
import "./SettingsShared.css";
import "./SettingsIconsPage.css";
import "../components/FieldStyleFields.css"; // reusing .field-style-toggle for Bold/Underline

interface HeaderDraft {
  size: number;
  color: string;
  bold: boolean;
  underline: boolean;
}

export function SettingsHeadersPage({
  onNavigate,
  focusKey,
}: {
  onNavigate: (view: View) => void;
  focusKey?: string;
}) {
  const { overrides, setOverride, clearOverride } = useHeaderStyles();
  const [drafts, setDrafts] = useState<Record<string, HeaderDraft>>({});
  useSettingsFocus(focusKey);

  const draftFor = (key: string): HeaderDraft => {
    if (drafts[key]) return drafts[key];
    const def = HEADER_STYLE_REGISTRY.find((d) => d.key === key)!;
    const override = overrides[key];
    return {
      size: override?.size ?? def.defaultSize,
      color: override?.color ?? def.defaultColor,
      bold: override?.bold ?? def.defaultBold,
      underline: override?.underline ?? def.defaultUnderline,
    };
  };

  const updateDraft = (key: string, patch: Partial<HeaderDraft>) => {
    setDrafts((prev) => ({ ...prev, [key]: { ...draftFor(key), ...patch } }));
  };

  const save = (key: string) => setOverride(key, draftFor(key));

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
          { label: "Headers" },
        ]}
      />
      <h1 className="page-title">Headers</h1>
      <p className="page-text">
        Change the font size, color, boldness, or underline of the sidebar's title and nav items.
      </p>

      <div className="icon-settings-list">
        {HEADER_STYLE_REGISTRY.map((def) => {
          const draft = draftFor(def.key);
          return (
            <div key={def.key} className="icon-settings-row" data-settings-key={def.key}>
              <div className="icon-settings-preview">
                <StyledHeader headerKey={def.key}>Aa</StyledHeader>
              </div>
              <div className="icon-settings-info">
                <div className="icon-settings-label">{def.label}</div>
                <div className="icon-settings-key">{def.key}</div>
                <div className="text-settings-fields">
                  <input
                    className="text-settings-size"
                    type="number"
                    min={8}
                    max={40}
                    value={draft.size}
                    onChange={(e) => updateDraft(def.key, { size: Number(e.target.value) })}
                  />
                  <input
                    className="text-settings-color"
                    type="color"
                    value={draft.color}
                    onChange={(e) => updateDraft(def.key, { color: e.target.value })}
                  />
                  <button
                    type="button"
                    className={`field-style-toggle${draft.bold ? " active" : ""}`}
                    title="Bold"
                    onClick={() => updateDraft(def.key, { bold: !draft.bold })}
                  >
                    B
                  </button>
                  <button
                    type="button"
                    className={`field-style-toggle${draft.underline ? " active" : ""}`}
                    title="Underline"
                    onClick={() => updateDraft(def.key, { underline: !draft.underline })}
                  >
                    U
                  </button>
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
