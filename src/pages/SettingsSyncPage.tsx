import { useEffect, useState } from "react";
import { View } from "../types/nav";
import { Breadcrumb } from "../components/Breadcrumb";
import { fetchUiPreferences, setUiPreference } from "../db/uiPreferences";
import { getDb, getSyncMeta, SyncMeta } from "../db/database";
import { syncWithComputer, SyncOutcome } from "../db/sync";
import "./Page.css";
import "./SettingsShared.css";

const COMPUTER_IP_KEY = "syncComputerIp";

export function SettingsSyncPage({ onNavigate }: { onNavigate: (view: View) => void }) {
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
      // A "downloaded" outcome reloads the whole app itself, so there's
      // nothing left to update on this page — it's about to be gone.
    } catch (err) {
      console.error("Sync failed:", err);
      setStatus(`Sync failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="page">
      <Breadcrumb
        crumbs={[
          { label: "Settings", onClick: () => onNavigate({ type: "settings-home" }) },
          { label: "Sync" },
        ]}
      />
      <h1 className="page-title">Sync</h1>
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
        {status && (
          <p style={{ marginTop: "12px", fontSize: "0.85rem", color: "var(--color-text-secondary)" }}>
            {status}
          </p>
        )}
      </div>
    </div>
  );
}