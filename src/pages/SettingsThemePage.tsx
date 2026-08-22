import { View } from "../types/nav";
import { Breadcrumb } from "../components/Breadcrumb";
import { useTheme } from "../theme/ThemeContext";
import { defaultsForMode, ThemeSettings } from "../theme/themeDefaults";
import { THEME_COLOR_GROUPS } from "../theme/themeFieldGroups";
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
  useSettingsFocus(focusKey);

  const valueFor = (key: keyof ThemeSettings): string => {
    const override = overrides[key];
    if (override) return override;
    if (key in modeDefaults) {
      return (modeDefaults as unknown as Record<string, string>)[key as string];
    }
    return theme[key] as string;
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
        Choose a general light or dark theme, then fine-tune any individual color — your changes
        stick even if you switch modes later.
      </p>

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
            {group.fields.map(({ key, label }) => (
              <div key={key} className="theme-color-row" data-settings-key={key}>
                <span className="theme-color-label">{label}</span>
                <input
                  type="color"
                  value={valueFor(key)}
                  onChange={(e) => setThemeValue(key, e.target.value)}
                />
                {overrides[key] && (
                  <button className="add-button danger" onClick={() => resetThemeValue(key)}>
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
