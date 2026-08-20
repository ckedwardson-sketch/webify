import { View } from "../types/nav";
import { Breadcrumb } from "../components/Breadcrumb";
import { useTheme } from "../theme/ThemeContext";
import { ThemeSettings } from "../theme/themeDefaults";
import "./Page.css";
import "./SettingsThemePage.css";

const WEB_COLOR_FIELDS: { key: keyof ThemeSettings; label: string }[] = [
  { key: "webBackground", label: "Web background" },
  { key: "webNodeProvenBackground", label: "Proven recipe node background" },
  { key: "webNodeUnprovenBackground", label: "Unproven recipe node background" },
  { key: "webNodeOutlineColor", label: "Recipe node outline color" },
];

export function SettingsThemePage({ onNavigate }: { onNavigate: (view: View) => void }) {
  const { theme, overrides, setThemeValue, resetThemeValue } = useTheme();

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
        Choose a general light or dark theme, and customize the recipe web's background and node
        colors.
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

      <div className="theme-section">
        <h2 className="theme-section-title">Recipe web</h2>
        <div className="theme-color-list">
          {WEB_COLOR_FIELDS.map(({ key, label }) => (
            <div key={key} className="theme-color-row">
              <span className="theme-color-label">{label}</span>
              <input
                type="color"
                value={theme[key]}
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
    </div>
  );
}
