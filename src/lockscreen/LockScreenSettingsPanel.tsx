import { useEffect, useRef, useState } from "react";
import {
  FIRST_LEVEL_DESTINATIONS,
  LOCK_SCREEN_DEFAULTS,
  LockScreenSettings,
  fetchLockScreenSettings,
  normalizeLockScreenSettings,
  saveLockScreenSettings,
} from "./lockScreenSettings";
import { getNative } from "./nativeBridge";
import { pushLockScreenNow, requestLockScreenRefresh } from "./lockScreenSync";
import "../pages/Page.css";
import "../pages/SettingsShared.css";
import "../pages/SettingsThemePage.css"; // .theme-number-input, reused below
import "../pages/SettingsMobilePage.css"; // .mobile-spacing-field layout, reused below

// Every lock screen control, with no page chrome of its own, so it can
// be shown both as its own settings page (pages/SettingsLockScreenPage)
// and as the first tab of the Checklist's settings
// (pages/ChecklistSettingsPage) without either copy drifting from the
// other.

// Crops the picked image to the phone's screen shape and shrinks it to
// 1080px wide before it crosses into native code — a full camera photo
// as a base64 string is several MB for no visible benefit.
async function coverCropToDataUrl(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const screenRatio = window.screen.height / window.screen.width;
  const targetW = 1080;
  const targetH = Math.round(targetW * (screenRatio > 1 ? screenRatio : 2280 / 1080));
  const canvas = document.createElement("canvas");
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Couldn't prepare the image.");
  const scale = Math.max(targetW / bitmap.width, targetH / bitmap.height);
  const drawW = bitmap.width * scale;
  const drawH = bitmap.height * scale;
  ctx.drawImage(bitmap, (targetW - drawW) / 2, (targetH - drawH) / 2, drawW, drawH);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", 0.88);
}

type NumericKey = "fontSize" | "bgDim" | "bannerTop" | "listTop" | "listBottom";
type ColorKey = "textColor" | "secondaryColor" | "bgColor";
type ToggleKey =
  | "enabled"
  | "showTasks"
  | "showResponsibilities"
  | "showChecklist"
  | "qsTileEnabled";

function RangeField({
  label,
  value,
  min,
  max,
  suffix,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  suffix: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="mobile-spacing-field">
      <span>
        {label}: {value}
        {suffix}
      </span>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="mobile-spacing-field">
      <span>{label}</span>
      <input type="color" value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

export function LockScreenSettingsPanel() {
  const [settings, setSettings] = useState<LockScreenSettings>(LOCK_SCREEN_DEFAULTS);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [bgPreview, setBgPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const skipNextSave = useRef(true);
  const native = getNative();

  useEffect(() => {
    fetchLockScreenSettings()
      .then((s) => {
        setSettings(s);
        setLoaded(true);
        skipNextSave.current = true;
      })
      .catch((err) => setStatus(`Couldn't load: ${err instanceof Error ? err.message : String(err)}`));
    if (native) {
      try {
        setBgPreview(native.getBackgroundPreview() || null);
      } catch {
        setBgPreview(null);
      }
    }
  }, [native]);

  useEffect(() => {
    if (!loaded) return;
    if (skipNextSave.current) {
      skipNextSave.current = false;
      return;
    }
    const handle = setTimeout(() => {
      saveLockScreenSettings(settings)
        .then(() => requestLockScreenRefresh(300))
        .catch((err) => setStatus(`Couldn't save: ${err instanceof Error ? err.message : String(err)}`));
    }, 500);
    return () => clearTimeout(handle);
  }, [settings, loaded]);

  const setNumber = (key: NumericKey, value: number) =>
    setSettings((prev) => normalizeLockScreenSettings({ ...prev, [key]: value }));
  const setColor = (key: ColorKey, value: string) => setSettings((prev) => ({ ...prev, [key]: value }));
  const setToggle = (key: ToggleKey, value: boolean) => setSettings((prev) => ({ ...prev, [key]: value }));

  const applyNow = async () => {
    setBusy(true);
    try {
      await saveLockScreenSettings(settings);
      setStatus(await pushLockScreenNow(true));
    } finally {
      setBusy(false);
    }
  };

  const pickImage = async (file: File) => {
    const api = getNative();
    if (!api) return;
    setBusy(true);
    try {
      const result = api.setBackground(await coverCropToDataUrl(file));
      setBgPreview(api.getBackgroundPreview() || null);
      setStatus(result === "ok" ? await pushLockScreenNow(true) : result);
    } catch (err) {
      setStatus(`Couldn't use that image: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(false);
    }
  };

  const clearImage = async () => {
    const api = getNative();
    if (!api) return;
    setBusy(true);
    try {
      api.clearBackground();
      setBgPreview(null);
      setStatus(await pushLockScreenNow(true));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <p className="page-text">
        Draws your checklist, task and responsibility lists onto the phone's lock screen wallpaper, and keeps them
        current while Webify is closed. It's a picture, so it can't be tapped — check items off in the app.
        Notifications draw on top of it, so keep the list area clear of the clock.
      </p>
      {!native && (
        <p className="page-text">
          This only takes effect in the Android app. You can still set it up here — the settings sync to the phone with
          the rest of the database — but the background image has to be chosen on the phone.
        </p>
      )}

      <div className="settings-groups">
        <section>
          <h2 className="settings-group-title">Show</h2>
          <div className="mobile-spacing-fields">
            <label className="mobile-spacing-field">
              <span>Lock screen list</span>
              <input
                type="checkbox"
                checked={settings.enabled}
                onChange={(e) => setToggle("enabled", e.target.checked)}
              />
            </label>
            <label className="mobile-spacing-field">
              <span>Tasks</span>
              <input
                type="checkbox"
                checked={settings.showTasks}
                onChange={(e) => setToggle("showTasks", e.target.checked)}
              />
            </label>
            <label className="mobile-spacing-field">
              <span>Responsibilities</span>
              <input
                type="checkbox"
                checked={settings.showResponsibilities}
                onChange={(e) => setToggle("showResponsibilities", e.target.checked)}
              />
            </label>
            <label className="mobile-spacing-field">
              <span>Checklist</span>
              <input
                type="checkbox"
                checked={settings.showChecklist}
                onChange={(e) => setToggle("showChecklist", e.target.checked)}
              />
            </label>
          </div>
        </section>

        <section>
          <h2 className="settings-group-title">Quick Settings tile</h2>
          <p className="page-text mobile-mode-help">
            A tile you can add to the phone's Quick Settings panel (swipe down twice → Edit). It shows the number of
            remaining checklist tasks — the same count as the lock screen — and opens Webify to the page you pick
            below. On Samsung, look for &quot;Checklist&quot; under the app's tiles.
          </p>
          <div className="mobile-spacing-fields">
            <label className="mobile-spacing-field">
              <span>Update tile count</span>
              <input
                type="checkbox"
                checked={settings.qsTileEnabled}
                onChange={(e) => setToggle("qsTileEnabled", e.target.checked)}
              />
            </label>
            <label className="mobile-spacing-field">
              <span>Open on tap</span>
              <select
                value={settings.qsTileDestination}
                onChange={(e) =>
                  setSettings((prev) =>
                    normalizeLockScreenSettings({ ...prev, qsTileDestination: e.target.value })
                  )
                }
              >
                {FIRST_LEVEL_DESTINATIONS.map((d) => (
                  <option key={d.key} value={d.key}>
                    {d.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </section>

        <section>
          <h2 className="settings-group-title">Text</h2>
          <div className="mobile-spacing-fields">
            <RangeField
              label="Font size"
              value={settings.fontSize}
              min={24}
              max={64}
              suffix="px"
              onChange={(v) => setNumber("fontSize", v)}
            />
            <ColorField label="Text color" value={settings.textColor} onChange={(v) => setColor("textColor", v)} />
            <ColorField
              label="Secondary color"
              value={settings.secondaryColor}
              onChange={(v) => setColor("secondaryColor", v)}
            />
          </div>
        </section>

        <section>
          <h2 className="settings-group-title">Background</h2>
          <div className="mobile-spacing-fields">
            <ColorField label="Background color" value={settings.bgColor} onChange={(v) => setColor("bgColor", v)} />
            {native && (
              <>
                <div className="mobile-spacing-field-row">
                  <button
                    type="button"
                    className="add-button secondary"
                    disabled={busy}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {bgPreview ? "Change image" : "Choose image"}
                  </button>
                  {bgPreview && (
                    <button type="button" className="add-button danger" disabled={busy} onClick={clearImage}>
                      Remove image
                    </button>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    style={{ display: "none" }}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      e.target.value = "";
                      if (file) void pickImage(file);
                    }}
                  />
                </div>
                {bgPreview && (
                  <img src={bgPreview} alt="Current lock screen background" style={{ width: 120, borderRadius: 8 }} />
                )}
              </>
            )}
            <RangeField
              label="Image dimming"
              value={settings.bgDim}
              min={0}
              max={80}
              suffix="%"
              onChange={(v) => setNumber("bgDim", v)}
            />
          </div>
        </section>

        <section>
          <h2 className="settings-group-title">Position</h2>
          <p className="page-text mobile-mode-help">Percent of the screen height, measured from the top.</p>
          <div className="mobile-spacing-fields">
            <RangeField
              label="Status banner (above clock)"
              value={settings.bannerTop}
              min={0}
              max={30}
              suffix="%"
              onChange={(v) => setNumber("bannerTop", v)}
            />
            <RangeField
              label="Lists start (below clock)"
              value={settings.listTop}
              min={5}
              max={80}
              suffix="%"
              onChange={(v) => setNumber("listTop", v)}
            />
            <RangeField
              label="Lists end"
              value={settings.listBottom}
              min={20}
              max={98}
              suffix="%"
              onChange={(v) => setNumber("listBottom", v)}
            />
          </div>
        </section>

        <section>
          <button type="button" className="add-button" disabled={busy} onClick={applyNow}>
            Apply now
          </button>
          {status && <p className="page-text mobile-mode-help">{status}</p>}
        </section>
      </div>
    </>
  );
}
