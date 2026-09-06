import { View } from "../types/nav";
import { Breadcrumb } from "../components/Breadcrumb";
import { useTheme } from "../theme/ThemeContext";
import { WIDGET_VISIBILITY_FIELDS } from "../theme/themeFieldGroups";
import { useSettingsFocus } from "./useSettingsFocus";
import "./Page.css";
import "./SettingsShared.css";
import "./SettingsMobilePage.css"; // reusing .mobile-spacing-field* row layout

export function SettingsWidgetVisibilityPage({
  onNavigate,
  focusKey,
}: {
  onNavigate: (view: View) => void;
  focusKey?: string;
}) {
  const { theme, setThemeValue } = useTheme();
  useSettingsFocus(focusKey);

  return (
    <div className="page">
      <Breadcrumb
        crumbs={[
          { label: "Settings", onClick: () => onNavigate({ type: "settings-home" }) },
          { label: "Widget Visibility" },
        ]}
      />
      <h1 className="page-title">Widget Visibility</h1>
      <p className="page-text">
        Show or hide the small floating buttons and overlay panels that sit on top of your pages —
        turn off anything you don't use to keep the screen less cluttered.
      </p>

      <div className="settings-groups">
        <section>
          <div className="mobile-spacing-fields">
            {WIDGET_VISIBILITY_FIELDS.map((field) => (
              <label key={field.key} className="mobile-spacing-field" data-settings-key={field.key}>
                <span>{field.label}</span>
                <select
                  value={(theme[field.key] as string) || "1"}
                  onChange={(e) => setThemeValue(field.key, e.target.value)}
                >
                  {field.options?.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
