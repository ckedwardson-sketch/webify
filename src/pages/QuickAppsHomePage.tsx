import { View } from "../types/nav";
import { RaftWithDogPane } from "../components/RaftWithDogPane";
import { SleepStudyPane } from "../components/SleepStudyPane";
import "./Page.css";
import "./QuickAppsHomePage.css";

const SLOT_COUNT = 15;

export function QuickAppsHomePage({ onNavigate }: { onNavigate: (view: View) => void }) {
  return (
    <div className="page">
      <h1 className="page-title">Quick Apps</h1>
      <div className="quick-apps-grid">
        {Array.from({ length: SLOT_COUNT }, (_, i) => (
          <div key={i} className="quick-app-slot">
            {i === 0 ? (
              <RaftWithDogPane onNavigate={onNavigate} />
            ) : i === 1 ? (
              <SleepStudyPane onNavigate={onNavigate} />
            ) : (
              <div className="quick-app-slot-empty">Drop a quick app here</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
