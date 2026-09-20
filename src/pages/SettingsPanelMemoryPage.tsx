import { useState } from "react";
import { View } from "../types/nav";
import { Breadcrumb } from "../components/Breadcrumb";
import { useUiPreferences } from "../context/UiPreferencesContext";
import { useSettingsFocus } from "./useSettingsFocus";
import { DEFAULT_DUAL_PANE_WEB_SHORTCUT, formatShortcut, serializeKeyEvent } from "../utils/keyboardShortcut";
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
  {
    key: "autoLockWebNodesMobile",
    label: "Lock node dragging on mobile",
    desc: "On Dream Web, Goal Web, and the Recipes graph, start with nodes locked in place whenever you're in mobile layout, so a scroll or tap doesn't accidentally drag one — a lock button on the canvas still lets you unlock it, and once you do it stays that way for the rest of the session.",
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
  const [recordingShortcut, setRecordingShortcut] = useState(false);
  const currentShortcut = preferences.dualPaneWebShortcut ?? DEFAULT_DUAL_PANE_WEB_SHORTCUT;

  const startRecording = () => {
    setRecordingShortcut(true);
    const handler = (e: KeyboardEvent) => {
      e.preventDefault();
      const combo = serializeKeyEvent(e);
      if (!combo) return; // bare modifier or Escape — keep listening
      window.removeEventListener("keydown", handler, true);
      setRecordingShortcut(false);
      setPreference("dualPaneWebShortcut", combo);
    };
    window.addEventListener("keydown", handler, true);
  };

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
          <div className="editor-settings-row" data-settings-key="dualPaneWebShortcut">
            <div className="editor-settings-row-text">
              <span className="editor-settings-row-label">Dual-pane web mode shortcut</span>
              <span className="editor-settings-row-desc">
                Keyboard shortcut to toggle Dual-Pane Web Mode. Click to record a new combination.
              </span>
            </div>
            <button
              type="button"
              className="add-button secondary"
              onClick={startRecording}
              disabled={recordingShortcut}
            >
              {recordingShortcut ? "Press a key…" : formatShortcut(currentShortcut)}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
