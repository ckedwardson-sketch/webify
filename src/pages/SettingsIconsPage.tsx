import React, { useRef, useState } from "react";
import { View } from "../types/nav";
import { Breadcrumb } from "../components/Breadcrumb";
import { Icon } from "../icons/Icon";
import { useIcons } from "../icons/IconContext";
import { ICON_REGISTRY } from "../icons/registry";
import { useSettingsFocus } from "./useSettingsFocus";
import "./Page.css";
import "./SettingsShared.css";
import "./SettingsIconsPage.css";

export function SettingsIconsPage({
  onNavigate,
  focusKey,
}: {
  onNavigate: (view: View) => void;
  focusKey?: string;
}) {
  const { overrides, setOverride, clearOverride } = useIcons();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  useSettingsFocus(focusKey);

  const triggerChange = (key: string) => {
    setActiveKey(key);
    fileInputRef.current?.click();
  };

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeKey) return;
    const reader = new FileReader();
    reader.onload = () => {
      setOverride(activeKey, reader.result as string);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
    setActiveKey(null);
  };

  return (
    <div className="page">
      <Breadcrumb
        crumbs={[
          { label: "Settings", onClick: () => onNavigate({ type: "settings-home" }) },
          { label: "Icons" },
        ]}
      />
      <h1 className="page-title">Icons</h1>
      <p className="page-text">
        Upload a custom image for any icon used in the app, or reset it back to the default.
      </p>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={handleFileSelected}
      />

      <div className="icon-settings-list">
        {ICON_REGISTRY.map((def) => (
          <div key={def.key} className="icon-settings-row" data-settings-key={def.key}>
            <div className="icon-settings-preview">
              <Icon iconKey={def.key} size={26} />
            </div>
            <div className="icon-settings-info">
              <div className="icon-settings-label">{def.label}</div>
              <div className="icon-settings-key">{def.key}</div>
            </div>
            <div className="icon-settings-actions">
              <button className="add-button secondary" onClick={() => triggerChange(def.key)}>
                Change
              </button>
              {overrides[def.key] && (
                <button className="add-button danger" onClick={() => clearOverride(def.key)}>
                  Reset
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
