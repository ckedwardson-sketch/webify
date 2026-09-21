import { View } from "../types/nav";
import { Breadcrumb } from "../components/Breadcrumb";
import { LockScreenSettingsPanel } from "../lockscreen/LockScreenSettingsPanel";
import "./Page.css";

// The controls themselves live in lockscreen/LockScreenSettingsPanel so
// the Checklist's settings can show the identical page as its first tab
// (see ChecklistSettingsPage).
export function SettingsLockScreenPage({ onNavigate }: { onNavigate: (view: View) => void }) {
  return (
    <div className="page">
      <Breadcrumb
        crumbs={[
          { label: "Settings", onClick: () => onNavigate({ type: "settings-home" }) },
          { label: "Lock Screen" },
        ]}
      />
      <h1 className="page-title">Lock Screen</h1>
      <LockScreenSettingsPanel />
    </div>
  );
}
