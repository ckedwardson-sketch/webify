import { View } from "../types/nav";
import { Breadcrumb } from "../components/Breadcrumb";
import { useTheme } from "../theme/ThemeContext";
import { MOBILE_MODE_OPTIONS, MOBILE_SPACING_FIELDS, MOBILE_AUTOCLOSE_FIELD } from "../theme/themeFieldGroups";
import "./Page.css";
import "./SettingsShared.css";
import "./SettingsThemePage.css"; // reusing .theme-number-input
import "./SettingsMobilePage.css";

export function SettingsMobilePage({ onNavigate }: { onNavigate: (view: View) => void }) {
  const { theme, overrides, setThemeValue, resetThemeValue } = useTheme();
  const mode = theme.mobileMode || "auto";

  return (
    <div className="page">
      <Breadcrumb
        crumbs={[
          { label: "Settings", onClick: () => onNavigate({ type: "settings-home" }) },
          { label: "Mobile" },
        ]}
      />
      <h1 className="page-title">Mobile</h1>
      <p className="page-text">
        Layout Mode chooses how Webify presents itself — not individual spacing values. Automatic
        follows the current viewport. Mobile and Desktop force a presentation regardless of window
        size, which is useful for testing and for pinning a preferred layout.
      </p>

      <div className="settings-groups">
        <section>
          <h2 className="settings-group-title">Layout Mode</h2>
          <div className="mobile-mode-options" data-settings-key="mobileMode">
            {MOBILE_MODE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={`mobile-mode-option${mode === opt.value ? " active" : ""}`}
                onClick={() => setThemeValue("mobileMode", opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <p className="page-text mobile-mode-help">
            {mode === "auto" && "Uses the available viewport to pick mobile or desktop presentation."}
            {mode === "on" && "Forces the mobile presentation, even on a wide window."}
            {mode === "off" && "Forces the desktop presentation, even on a narrow window."}
          </p>
        </section>

        <section>
          <h2 className="settings-group-title">Navigation</h2>
          <label className="mobile-spacing-field" data-settings-key={MOBILE_AUTOCLOSE_FIELD.key}>
            <span>{MOBILE_AUTOCLOSE_FIELD.label}</span>
            <select
              value={(theme[MOBILE_AUTOCLOSE_FIELD.key] as string) || "1"}
              onChange={(e) => setThemeValue(MOBILE_AUTOCLOSE_FIELD.key, e.target.value)}
            >
              {MOBILE_AUTOCLOSE_FIELD.options?.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
        </section>

        <section>
          <h2 className="settings-group-title">Page Spacing</h2>
          <p className="page-text mobile-mode-help">
            Controls how much breathing room mobile pages leave around their edges and between
            cards — these only apply in the mobile presentation, desktop is unaffected.
          </p>
          <div className="mobile-spacing-fields">
            {MOBILE_SPACING_FIELDS.map((field) => (
              <label key={field.key} className="mobile-spacing-field">
                <span>{field.label}</span>
                <div className="mobile-spacing-field-row">
                  <input
                    type="number"
                    min={field.min ?? 0}
                    max={field.max ?? 60}
                    step={field.step ?? 1}
                    value={theme[field.key] as string}
                    onChange={(e) => setThemeValue(field.key, e.target.value)}
                    className="theme-number-input"
                  />
                  {overrides[field.key] && (
                    <button
                      type="button"
                      className="add-button danger"
                      onClick={() => resetThemeValue(field.key)}
                    >
                      Reset
                    </button>
                  )}
                </div>
              </label>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
