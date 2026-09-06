import { View } from "../types/nav";
import { Breadcrumb } from "../components/Breadcrumb";
import { useUiPreferences } from "../context/UiPreferencesContext";
import { useSettingsFocus } from "./useSettingsFocus";
import "./Page.css";
import "./SettingsShared.css";
import "./SettingsEditorPage.css"; // reusing .editor-settings-row/-toggle

const TOGGLE_FIELDS: { key: string; label: string; desc: string }[] = [
  {
    key: "rememberSidebarOpen",
    label: "Remember sidebar open/closed",
    desc: "Restore the sidebar's open/closed state from your last session on next launch, instead of always deriving it from your window size.",
  },
  {
    key: "dualPaneDefault",
    label: "Always open Notes in dual-pane",
    desc: "Start every session with dual-pane mode already active, instead of entering it manually from Notes each time.",
  },
  {
    key: "notesTreeRemember",
    label: "Remember expanded notes folders",
    desc: "Keep the notes tree's expanded pages and collapsed categories exactly as you left them, instead of resetting on every visit.",
  },
];

export function SettingsPanelMemoryPage({
  onNavigate,
  focusKey,
}: {
  onNavigate: (view: View) => void;
  focusKey?: string;
}) {
  const { preferences, setPreference } = useUiPreferences();
  useSettingsFocus(focusKey);

  return (
    <div className="page">
      <Breadcrumb
        crumbs={[
          { label: "Settings", onClick: () => onNavigate({ type: "settings-home" }) },
          { label: "Panel & Layout Memory" },
        ]}
      />
      <h1 className="page-title">Panel & Layout Memory</h1>
      <p className="page-text">
        A small set of layout choices worth remembering across sessions — everything else (filter
        panels, add-widget popovers, and similar contextual toggles) intentionally resets each time,
        since it's cheap to reopen.
      </p>

      <div className="settings-groups">
        <div className="settings-group">
          {TOGGLE_FIELDS.map((field) => (
            <div key={field.key} className="editor-settings-row" data-settings-key={field.key}>
              <div className="editor-settings-row-text">
                <span className="editor-settings-row-label">{field.label}</span>
                <span className="editor-settings-row-desc">{field.desc}</span>
              </div>
              <label className="editor-settings-toggle">
                <input
                  type="checkbox"
                  checked={preferences[field.key] === "1"}
                  onChange={(e) => setPreference(field.key, e.target.checked ? "1" : "0")}
                />
                <span className="editor-settings-toggle-track" />
              </label>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
