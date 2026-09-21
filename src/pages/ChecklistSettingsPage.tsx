import { useEffect, useRef, useState } from "react";
import { View } from "../types/nav";
import { Breadcrumb } from "../components/Breadcrumb";
import { LockScreenSettingsPanel } from "../lockscreen/LockScreenSettingsPanel";
import { ARCHIVE_DATE_FORMATS } from "../checklist/checklistFormat";
import {
  CHECKLIST_SETTINGS_DEFAULTS,
  fetchChecklistSettings,
  saveChecklistSettings,
} from "../checklist/checklistStorage";
import {
  ArchiveDateFormat,
  ChecklistSettings,
  TRUNCATE_OFF,
} from "../checklist/checklistTypes";
import "./Page.css";
import "./SettingsShared.css";
import "./SettingsMobilePage.css"; // .mobile-spacing-field layout, reused below
import "./ChecklistSettingsPage.css";

type Tab = "lockscreen" | "page";

// A labelled on/off row. Deliberately chunky — this page is used on a
// phone at least as often as on the computer.
function Switch({
  label,
  help,
  checked,
  onChange,
}: {
  label: string;
  help?: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="cls-switch">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="cls-switch-body">
        <span className="cls-switch-label">{label}</span>
        {help && <span className="cls-switch-help">{help}</span>}
      </span>
    </label>
  );
}

function PageFunctionSettings() {
  const [settings, setSettings] = useState<ChecklistSettings>(CHECKLIST_SETTINGS_DEFAULTS);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const skipNextSave = useRef(false);

  useEffect(() => {
    fetchChecklistSettings()
      .then((s) => {
        skipNextSave.current = true;
        setSettings(s);
        setLoaded(true);
      })
      .catch((err) => setError(`Couldn't load settings: ${err instanceof Error ? err.message : String(err)}`));
  }, []);

  // Sliders fire on every tick — save once things settle.
  useEffect(() => {
    if (!loaded) return;
    if (skipNextSave.current) {
      skipNextSave.current = false;
      return;
    }
    const handle = setTimeout(() => {
      saveChecklistSettings(settings).catch((err) =>
        setError(`Couldn't save: ${err instanceof Error ? err.message : String(err)}`)
      );
    }, 400);
    return () => clearTimeout(handle);
  }, [settings, loaded]);

  const set = (patch: Partial<ChecklistSettings>) => setSettings((prev) => ({ ...prev, ...patch }));

  if (!loaded && !error) return <p className="page-text">Loading…</p>;

  const truncLabel =
    settings.truncateChars >= TRUNCATE_OFF ? "no limit" : `${settings.truncateChars} characters`;

  return (
    <div className="settings-groups">
      {error && <p className="cls-error">{error}</p>}

      <section>
        <h2 className="settings-group-title">Text</h2>
        <div className="mobile-spacing-fields">
          <label className="mobile-spacing-field">
            <span>Text size: {settings.textSize}px</span>
            <input
              type="range"
              min={12}
              max={40}
              step={1}
              value={settings.textSize}
              onChange={(e) => set({ textSize: Number(e.target.value) })}
            />
          </label>
          <p className="page-text cls-help" style={{ fontSize: `${settings.textSize}px` }}>
            The checklist looks like this.
          </p>

          <label className="mobile-spacing-field">
            <span>Text truncation: {truncLabel}</span>
            <input
              type="range"
              min={10}
              max={TRUNCATE_OFF}
              step={1}
              value={settings.truncateChars}
              onChange={(e) => set({ truncateChars: Number(e.target.value) })}
            />
          </label>
          <Switch
            label="Truncate at the first line break"
            help="A task written as a short line plus a few lines of detail shows only that first line."
            checked={settings.truncateOnBreak}
            onChange={(v) => set({ truncateOnBreak: v })}
          />
          <p className="page-text cls-help">
            Truncation never shortens what you type — it only applies where a task has to fit somewhere small: the
            lock screen, and the thumbnails in grid view.
          </p>
        </div>
      </section>

      <section>
        <h2 className="settings-group-title">Page function</h2>
        <div className="mobile-spacing-fields">
          <Switch
            label="Send checked to bottom instead of clearing"
            help={
              settings.archiveMode
                ? "Checked tasks move to an archive ten lines below your text, newest first."
                : "Checked tasks are removed from the list for good."
            }
            checked={settings.archiveMode}
            onChange={(v) => set({ archiveMode: v })}
          />
        </div>
      </section>

      {/* Only reachable once the button has been switched to archive
          mode — there's nothing to show a date on otherwise. */}
      {settings.archiveMode && (
        <section>
          <h2 className="settings-group-title">Archive mode</h2>
          <div className="mobile-spacing-fields">
            <Switch
              label="Show the date it was checked off"
              help="Aligned to the right of each archived task."
              checked={settings.showDate}
              onChange={(v) => set({ showDate: v })}
            />
            {settings.showDate && (
              <label className="mobile-spacing-field">
                <span>Date format</span>
                <select
                  className="cls-select"
                  value={settings.dateFormat}
                  onChange={(e) => set({ dateFormat: e.target.value as ArchiveDateFormat })}
                >
                  {ARCHIVE_DATE_FORMATS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.sample}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
        </section>
      )}

      <section>
        <h2 className="settings-group-title">Multiple lists</h2>
        <div className="mobile-spacing-fields">
          <Switch
            label="Use more than one list"
            help="Adds tabs along the top, a New list button, and a grid view of every list."
            checked={settings.multiList}
            onChange={(v) => set({ multiList: v })}
          />
        </div>
      </section>
    </div>
  );
}

export function ChecklistSettingsPage({
  onNavigate,
  tab,
}: {
  onNavigate: (view: View) => void;
  tab?: Tab;
}) {
  const [active, setActive] = useState<Tab>(tab ?? "lockscreen");

  return (
    <div className="page">
      <Breadcrumb
        crumbs={[
          { label: "Checklist", onClick: () => onNavigate({ type: "checklist-home" }) },
          { label: "Settings" },
        ]}
      />
      <h1 className="page-title">Checklist Settings</h1>

      <div className="cls-tabs" role="tablist" aria-label="Checklist settings">
        <button
          type="button"
          role="tab"
          aria-selected={active === "lockscreen"}
          className={`cls-tab${active === "lockscreen" ? " active" : ""}`}
          onClick={() => setActive("lockscreen")}
        >
          Lock screen
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={active === "page"}
          className={`cls-tab${active === "page" ? " active" : ""}`}
          onClick={() => setActive("page")}
        >
          Page function
        </button>
      </div>

      {active === "lockscreen" ? <LockScreenSettingsPanel /> : <PageFunctionSettings />}
    </div>
  );
}
