import { useRef, useState } from "react";
import { View } from "../types/nav";
import { Breadcrumb } from "../components/Breadcrumb";
import { useTheme } from "../theme/ThemeContext";
import { defaultsForMode, ThemeSettings } from "../theme/themeDefaults";
import { THEME_COLOR_GROUPS, ThemeColorField } from "../theme/themeFieldGroups";
import { useSettingsFocus } from "./useSettingsFocus";
import "./Page.css";
import "./SettingsShared.css";
import "./SettingsThemePage.css";

export function SettingsThemePage({
  onNavigate,
  focusKey,
}: {
  onNavigate: (view: View) => void;
  focusKey?: string;
}) {
  const { theme, overrides, setThemeValue, resetThemeValue } = useTheme();
  const modeDefaults = defaultsForMode(theme.mode);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeImageKey, setActiveImageKey] = useState<keyof ThemeSettings | null>(null);
  useSettingsFocus(focusKey);

  const valueFor = (key: keyof ThemeSettings): string => {
    const override = overrides[key];
    if (override) return override;
    if (key in modeDefaults) {
      return (modeDefaults as unknown as Record<string, string>)[key as string];
    }
    return theme[key] as string;
  };

  const triggerImageUpload = (key: keyof ThemeSettings) => {
    setActiveImageKey(key);
    fileInputRef.current?.click();
  };

  const handleImageSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeImageKey) return;
    const reader = new FileReader();
    reader.onload = () => {
      setThemeValue(activeImageKey, reader.result as string);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
    setActiveImageKey(null);
  };

  const renderField = (field: ThemeColorField) => {
    const { key, kind = "color" } = field;
    const value = valueFor(key);

    if (kind === "select") {
      return (
        <select value={value} onChange={(e) => setThemeValue(key, e.target.value)}>
          {field.options?.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      );
    }

    if (kind === "number") {
      return (
        <input
          type="number"
          min={field.min ?? 0}
          max={field.max ?? 60}
          step={field.step ?? 1}
          value={value}
          onChange={(e) => setThemeValue(key, e.target.value)}
          className="theme-number-input"
        />
      );
    }

    if (kind === "code") {
      return (
        <textarea
          className="theme-code-input"
          rows={4}
          spellCheck={false}
          value={value}
          placeholder={field.placeholder}
          onChange={(e) => setThemeValue(key, e.target.value)}
        />
      );
    }

    if (kind === "image") {
      return (
        <div className="theme-image-field">
          {value && <img src={value} alt="" className="theme-image-preview" />}
          <button className="add-button secondary" onClick={() => triggerImageUpload(key)}>
            {value ? "Change" : "Upload"}
          </button>
        </div>
      );
    }

    return <input type="color" value={value} onChange={(e) => setThemeValue(key, e.target.value)} />;
  };

  return (
    <div className="page">
      <Breadcrumb
        crumbs={[
          { label: "Settings", onClick: () => onNavigate({ type: "settings-home" }) },
          { label: "Theme" },
        ]}
      />
      <h1 className="page-title">Theme</h1>
      <p className="page-text">
        Choose a general light or dark theme, then fine-tune any individual color, font, or layout
        knob — your changes stick even if you switch modes later.
      </p>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={handleImageSelected}
      />

      <div className="theme-section">
        <h2 className="theme-section-title">General theme</h2>
        <div className="theme-mode-toggle">
          <button
            className={`theme-mode-button${theme.mode === "light" ? " active" : ""}`}
            onClick={() => setThemeValue("mode", "light")}
          >
            Light
          </button>
          <button
            className={`theme-mode-button${theme.mode === "dark" ? " active" : ""}`}
            onClick={() => setThemeValue("mode", "dark")}
          >
            Dark
          </button>
        </div>
      </div>

      {THEME_COLOR_GROUPS.map((group) => (
        <div className="theme-section" key={group.title}>
          <h2 className="theme-section-title">{group.title}</h2>
          <div className="theme-color-list">
            {group.fields.map((field) => (
              <div
                key={field.key}
                className={`theme-color-row${field.kind === "code" ? " theme-color-row-code" : ""}`}
                data-settings-key={field.key}
              >
                <span className="theme-color-label">{field.label}</span>
                {renderField(field)}
                {field.help && <p className="theme-code-help">{field.help}</p>}
                {overrides[field.key] && (
                  <button className="add-button danger" onClick={() => resetThemeValue(field.key)}>
                    Reset
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
