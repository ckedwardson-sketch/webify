import { View } from "../types/nav";
import { useEditorSettings } from "../editor/EditorSettingsContext";
import { EditorToolSettings } from "../db/editorSettings";
import "./Page.css";
import "./SettingsShared.css";
import "./SettingsEditorPage.css";

const TOGGLE_FIELDS: { key: keyof EditorToolSettings; label: string; desc: string; focusKey: string }[] = [
  {
    key: "toolbarEnabled",
    label: "Fixed toolbar",
    desc: "The always-visible bar of formatting buttons above the editor.",
    focusKey: "editor-toolbar",
  },
  {
    key: "contextMenuEnabled",
    label: "Right-click / long-press menu",
    desc: "Right-click on a computer, or long-press on touch, opens the same tools in a menu at your cursor.",
    focusKey: "editor-context-menu",
  },
  {
    key: "bubbleMenuEnabled",
    label: "Selection toolbar",
    desc: "A small floating toolbar appears when you select text.",
    focusKey: "editor-bubble-menu",
  },
  {
    key: "slashCommandEnabled",
    label: "Slash commands",
    desc: 'Type "/" at the start of a line to insert a block.',
    focusKey: "editor-slash-command",
  },
];

export function SettingsEditorPage({
  onNavigate,
  focusKey,
}: {
  onNavigate: (view: View) => void;
  focusKey?: string;
}) {
  const { settings, setSetting } = useEditorSettings();

  return (
    <div className="page">
      <button className="add-button secondary" onClick={() => onNavigate({ type: "settings-home" })}>
        ← Settings
      </button>
      <h1 className="page-title">Editor Tools</h1>
      <p className="page-text">
        Controls every rich text editor in the app (Recipes, Notes) — which ways you can reach formatting tools.
      </p>

      <div className="settings-groups">
        <div className={`settings-group${focusKey === "editor-input-mode" ? " settings-highlight" : ""}`}>
          <h2 className="settings-group-title">Input mode</h2>
          <div className="editor-settings-row">
            <div className="editor-settings-row-text">
              <span className="editor-settings-row-label">Input mode</span>
              <span className="editor-settings-row-desc">
                Governs whether right-click or long-press is used to open the menu. "Auto" detects it from the
                device.
              </span>
            </div>
            <select
              className="inline-add-input"
              style={{ marginBottom: 0, width: 140 }}
              value={settings.inputMode}
              onChange={(e) => setSetting("inputMode", e.target.value as EditorToolSettings["inputMode"])}
            >
              <option value="auto">Auto</option>
              <option value="mouse">Mouse</option>
              <option value="touch">Touch</option>
            </select>
          </div>
        </div>

        <div className="settings-group">
          <h2 className="settings-group-title">Tool access surfaces</h2>
          {TOGGLE_FIELDS.map((field) => (
            <div
              key={field.key}
              className={`editor-settings-row${focusKey === field.focusKey ? " settings-highlight" : ""}`}
            >
              <div className="editor-settings-row-text">
                <span className="editor-settings-row-label">{field.label}</span>
                <span className="editor-settings-row-desc">{field.desc}</span>
              </div>
              <label className="editor-settings-toggle">
                <input
                  type="checkbox"
                  checked={settings[field.key] as boolean}
                  onChange={(e) => setSetting(field.key, e.target.checked as never)}
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
