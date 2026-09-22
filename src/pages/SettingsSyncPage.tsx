import { useEffect, useRef, useState } from "react";
import { View } from "../types/nav";
import { Breadcrumb } from "../components/Breadcrumb";
import { fetchUiPreferences, setUiPreference } from "../db/uiPreferences";
import { getDb, getSyncMeta, SyncMeta } from "../db/database";
import { syncWithComputer, SyncOutcome } from "../db/sync";
import {
  BACKUP_INTERVAL_OPTIONS,
  BACKUP_SETTINGS_DEFAULTS,
  BackupInterval,
  BackupSettings,
  fetchBackupSettings,
  saveBackupSettings,
} from "../db/backupSettings";
import {
  BackupInfo,
  createAutomaticBackup,
  deleteAutomaticBackup,
  describeBackupLocation,
  exportDatabaseDownload,
  formatBytes,
  listAutomaticBackups,
  maybeRunAutomaticBackup,
  pickBackupFolder,
} from "../db/backup";
import "./Page.css";
import "./SettingsShared.css";
import "./SettingsMobilePage.css";
import "./SettingsDataTransfer.css";

const COMPUTER_IP_KEY = "syncComputerIp";

export type DataTransferTab = "sync" | "cloud-backups" | "db-download";

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
    <label className="dst-switch">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="dst-switch-body">
        <span className="dst-switch-label">{label}</span>
        {help && <span className="dst-switch-help">{help}</span>}
      </span>
    </label>
  );
}

function formatWhen(isoOrMs: string | null | undefined): string {
  if (!isoOrMs) return "never";
  const n = Number(isoOrMs);
  const d = Number.isFinite(n) && n > 1e11 ? new Date(n) : new Date(isoOrMs);
  if (Number.isNaN(d.getTime())) return isoOrMs;
  return d.toLocaleString();
}

// ---------------------------------------------------------------------------
// Tab 1 — Sync (unchanged behaviour)
// ---------------------------------------------------------------------------

function SyncTab() {
  const [computerIp, setComputerIp] = useState("");
  const [meta, setMeta] = useState<SyncMeta | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const loadMeta = async () => {
    const db = await getDb();
    setMeta(await getSyncMeta(db));
  };

  useEffect(() => {
    fetchUiPreferences().then((prefs) => setComputerIp(prefs[COMPUTER_IP_KEY] ?? ""));
    loadMeta();
  }, []);

  const handleIpBlur = async () => {
    await setUiPreference(COMPUTER_IP_KEY, computerIp.trim());
  };

  const describeOutcome = (outcome: SyncOutcome): string => {
    switch (outcome.direction) {
      case "none":
        return "Already up to date — both copies match.";
      case "uploaded":
        return `Sent this device's changes to the computer (rev ${outcome.localRevision} → computer had ${outcome.remoteRevision}).`;
      case "downloaded":
        return `Pulled the computer's changes onto this device (computer rev ${outcome.remoteRevision} → this device had ${outcome.localRevision}). Reloading…`;
    }
  };

  const handleSync = async () => {
    const ip = computerIp.trim();
    if (!ip) {
      setStatus("Enter the computer's IP address first.");
      return;
    }
    setSyncing(true);
    setStatus("Syncing…");
    try {
      const outcome = await syncWithComputer(ip);
      setStatus(describeOutcome(outcome));
      if (outcome.direction !== "downloaded") {
        await loadMeta();
      }
    } catch (err) {
      console.error("Sync failed:", err);
      setStatus(`Sync failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <>
      <p className="page-text">
        Compares this device's change count against the computer's and copies whichever whole
        database is newer over the other. The computer needs to be running (open, even in the
        background) and on the same wifi network as this device.
      </p>

      <div className="theme-section">
        <h2 className="theme-section-title">Computer's address</h2>
        <div className="theme-color-list">
          <div className="theme-color-row">
            <input
              className="inline-add-input"
              style={{ marginBottom: 0, flex: 1 }}
              placeholder="e.g. 192.168.1.42"
              value={computerIp}
              onChange={(e) => setComputerIp(e.target.value)}
              onBlur={handleIpBlur}
            />
          </div>
        </div>
        <p className="page-text" style={{ fontSize: "0.85rem" }}>
          Find this on the computer via Settings → Network, or Command Prompt's <code>ipconfig</code>.
          It usually stays the same on home wifi, but can change if your router reassigns it.
        </p>
      </div>

      <div className="theme-section">
        <h2 className="theme-section-title">This device</h2>
        {meta && (
          <p className="page-text">
            Revision {meta.revision} · last changed {meta.updatedAt}
          </p>
        )}
        <button className="add-button" onClick={handleSync} disabled={syncing}>
          {syncing ? "Syncing…" : "Sync Now"}
        </button>
        {status && <p className="dst-status">{status}</p>}
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Tab 2 — Automatic backups (scheduled rotated snapshots, stored on this
// device by default, or in a folder you choose — see the location
// controls below; never uploaded anywhere by this app).
// ---------------------------------------------------------------------------

function AutomaticBackupsTab() {
  const [settings, setSettings] = useState<BackupSettings>(BACKUP_SETTINGS_DEFAULTS);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [backups, setBackups] = useState<BackupInfo[]>([]);
  const [locationLabel, setLocationLabel] = useState<string>("Loading…");
  const skipNextSave = useRef(false);

  const refreshList = async (location: string) => {
    try {
      setBackups(await listAutomaticBackups(location));
    } catch (err) {
      // Listing can fail on a brand-new install before the folder exists;
      // treat as empty rather than blocking the rest of the tab.
      console.warn("listAutomaticBackups:", err);
      setBackups([]);
    }
  };

  const refreshLocationLabel = async (location: string) => {
    try {
      setLocationLabel(await describeBackupLocation(location));
    } catch (err) {
      console.warn("describeBackupLocation:", err);
      setLocationLabel(location || "This device's app data folder");
    }
  };

  useEffect(() => {
    fetchBackupSettings()
      .then((s) => {
        skipNextSave.current = true;
        setSettings(s);
        setLoaded(true);
        refreshList(s.backupLocation);
        refreshLocationLabel(s.backupLocation);
        // Opportunistic run when this tab opens (no-op if not due / disabled).
        maybeRunAutomaticBackup()
          .then((r) => {
            if (r) {
              setStatus(`Automatic backup created (${formatBytes(r.sizeBytes)}).`);
              return fetchBackupSettings().then((s2) => {
                skipNextSave.current = true;
                setSettings(s2);
                return refreshList(s2.backupLocation);
              });
            }
          })
          .catch((err) => console.warn("maybeRunAutomaticBackup:", err));
      })
      .catch((err) =>
        setError(`Couldn't load backup settings: ${err instanceof Error ? err.message : String(err)}`)
      );
  }, []);

  useEffect(() => {
    if (!loaded) return;
    if (skipNextSave.current) {
      skipNextSave.current = false;
      return;
    }
    const handle = setTimeout(() => {
      saveBackupSettings(settings).catch((err) =>
        setError(`Couldn't save: ${err instanceof Error ? err.message : String(err)}`)
      );
    }, 400);
    return () => clearTimeout(handle);
  }, [settings, loaded]);

  const set = (patch: Partial<BackupSettings>) => setSettings((prev) => ({ ...prev, ...patch }));

  const handleBackupNow = async () => {
    setBusy(true);
    setStatus("Creating backup…");
    setError(null);
    try {
      // Persist current toggles first so the snapshot matches what the user sees.
      await saveBackupSettings(settings);
      const result = await createAutomaticBackup(
        settings.excludeImages,
        settings.maxBackups,
        settings.backupLocation
      );
      const next = { ...settings, lastBackupAt: new Date().toISOString() };
      skipNextSave.current = true;
      setSettings(next);
      await saveBackupSettings(next);
      setStatus(`Backup saved (${formatBytes(result.sizeBytes)}).`);
      await refreshList(settings.backupLocation);
    } catch (err) {
      console.error(err);
      setError(`Backup failed: ${err instanceof Error ? err.message : String(err)}`);
      setStatus(null);
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (path: string) => {
    try {
      await deleteAutomaticBackup(path);
      await refreshList(settings.backupLocation);
    } catch (err) {
      setError(`Couldn't delete: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handleChooseFolder = async () => {
    setError(null);
    try {
      const picked = await pickBackupFolder();
      if (!picked) return; // user cancelled
      const next = { ...settings, backupLocation: picked };
      skipNextSave.current = true;
      setSettings(next);
      await saveBackupSettings(next);
      await refreshLocationLabel(picked);
      await refreshList(picked);
      setStatus("Backup location updated.");
    } catch (err) {
      setError(`Couldn't set backup location: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handleUseDefaultLocation = async () => {
    setError(null);
    try {
      const next = { ...settings, backupLocation: "" };
      skipNextSave.current = true;
      setSettings(next);
      await saveBackupSettings(next);
      await refreshLocationLabel("");
      await refreshList("");
      setStatus("Backup location reset to this device's app data folder.");
    } catch (err) {
      setError(`Couldn't reset backup location: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  if (!loaded && !error) return <p className="page-text">Loading…</p>;

  return (
    <div className="settings-groups">
      {error && <p className="dst-error">{error}</p>}

      <p className="page-text">
        Scheduled snapshots of this device's database, kept in a rotating set. These stay on
        this device (or in a folder you pick below) — nothing is uploaded to any account or
        cloud service. Use these as a safety net alongside wifi sync, not a replacement for it.
      </p>

      <section>
        <h2 className="settings-group-title">Storage location</h2>
        <div className="mobile-spacing-fields">
          <p className="page-text dst-help">
            Backups are currently saved to: <strong>{locationLabel}</strong>
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" className="add-button" onClick={handleChooseFolder}>
              Choose folder…
            </button>
            {settings.backupLocation && (
              <button type="button" className="add-button" onClick={handleUseDefaultLocation}>
                Use default location
              </button>
            )}
          </div>
          <p className="page-text dst-help">
            On Android, the folder you pick is remembered across restarts once granted. If a
            previously-chosen folder is deleted or its permission is revoked, backups fall back
            to the default location automatically.
          </p>
        </div>
      </section>

      <section>
        <h2 className="settings-group-title">Schedule</h2>
        <div className="mobile-spacing-fields">
          <Switch
            label="Automatic backups"
            help="When on, a new snapshot is taken on the interval below while the app is open (and checked when this page loads)."
            checked={settings.enabled}
            onChange={(v) => set({ enabled: v })}
          />
          <label className="mobile-spacing-field">
            <span>How often</span>
            <select
              className="dst-select"
              value={settings.interval}
              disabled={!settings.enabled}
              onChange={(e) => set({ interval: e.target.value as BackupInterval })}
            >
              {BACKUP_INTERVAL_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="mobile-spacing-field">
            <span>Keep this many backups: {settings.maxBackups}</span>
            <input
              type="range"
              min={1}
              max={30}
              step={1}
              value={settings.maxBackups}
              onChange={(e) => set({ maxBackups: Number(e.target.value) })}
            />
          </label>
          <p className="page-text dst-help">
            Oldest backups are deleted automatically once the limit is reached. Last automatic
            backup: {formatWhen(settings.lastBackupAt)}.
          </p>
        </div>
      </section>

      <section>
        <h2 className="settings-group-title">Contents</h2>
        <div className="mobile-spacing-fields">
          <Switch
            label="Exclude images from backups"
            help="Strips recipe/project/goal photos and dock images from the snapshot. Text, tasks, and structure stay intact — files are much smaller."
            checked={settings.excludeImages}
            onChange={(v) => set({ excludeImages: v })}
          />
        </div>
      </section>

      <section>
        <h2 className="settings-group-title">This device</h2>
        <button className="add-button" onClick={handleBackupNow} disabled={busy}>
          {busy ? "Backing up…" : "Back up now"}
        </button>
        {status && <p className="dst-status">{status}</p>}

        {backups.length > 0 && (
          <ul className="dst-backup-list">
            {backups.map((b) => (
              <li key={b.path} className="dst-backup-row">
                <div className="dst-backup-meta">
                  <span className="dst-backup-name">{b.name}</span>
                  <span className="dst-backup-detail">
                    {formatBytes(b.sizeBytes)} · {formatWhen(b.modifiedAt)}
                  </span>
                </div>
                <button
                  type="button"
                  className="dst-backup-delete"
                  onClick={() => handleDelete(b.path)}
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
        {backups.length === 0 && (
          <p className="page-text dst-help" style={{ marginTop: 12 }}>
            No automatic backups on this device yet.
          </p>
        )}
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab 3 — DB download
// ---------------------------------------------------------------------------

function DbDownloadTab() {
  const [excludeImages, setExcludeImages] = useState(true);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleDownload = async () => {
    setBusy(true);
    setError(null);
    setStatus("Preparing database file…");
    try {
      const result = await exportDatabaseDownload(excludeImages);
      setStatus(
        `Saved ${formatBytes(result.sizeBytes)} to:\n${result.path}`
      );
    } catch (err) {
      console.error(err);
      setError(`Download failed: ${err instanceof Error ? err.message : String(err)}`);
      setStatus(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="settings-groups">
      <p className="page-text">
        Write a standalone copy of this device's SQLite database to your Downloads folder (or the
        app's export folder if Downloads isn't available). Useful for archiving, moving to another
        machine, or handing a snapshot to support — independent of wifi sync.
      </p>

      <section>
        <h2 className="settings-group-title">Options</h2>
        <div className="mobile-spacing-fields">
          <Switch
            label="Exclude images"
            help="Leave photos and cover images out of the file so it stays small. Structure and text are unchanged."
            checked={excludeImages}
            onChange={setExcludeImages}
          />
        </div>
      </section>

      <section>
        <h2 className="settings-group-title">Export</h2>
        <button className="add-button" onClick={handleDownload} disabled={busy}>
          {busy ? "Saving…" : "Download database"}
        </button>
        {status && (
          <p className="dst-status" style={{ whiteSpace: "pre-wrap" }}>
            {status}
          </p>
        )}
        {error && <p className="dst-error">{error}</p>}
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page shell
// ---------------------------------------------------------------------------

export function SettingsSyncPage({
  onNavigate,
  tab,
}: {
  onNavigate: (view: View) => void;
  tab?: DataTransferTab;
}) {
  const [active, setActive] = useState<DataTransferTab>(tab ?? "sync");

  return (
    <div className="page">
      <Breadcrumb
        crumbs={[
          { label: "Settings", onClick: () => onNavigate({ type: "settings-home" }) },
          { label: "Data saving / transfer" },
        ]}
      />
      <h1 className="page-title">Data saving / transfer</h1>

      <div className="dst-tabs" role="tablist" aria-label="Data saving and transfer">
        <button
          type="button"
          role="tab"
          aria-selected={active === "sync"}
          className={`dst-tab${active === "sync" ? " active" : ""}`}
          onClick={() => setActive("sync")}
        >
          Sync
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={active === "cloud-backups"}
          className={`dst-tab${active === "cloud-backups" ? " active" : ""}`}
          onClick={() => setActive("cloud-backups")}
        >
          Automatic backups
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={active === "db-download"}
          className={`dst-tab${active === "db-download" ? " active" : ""}`}
          onClick={() => setActive("db-download")}
        >
          DB download
        </button>
      </div>

      {active === "sync" && <SyncTab />}
      {active === "cloud-backups" && <AutomaticBackupsTab />}
      {active === "db-download" && <DbDownloadTab />}
    </div>
  );
}