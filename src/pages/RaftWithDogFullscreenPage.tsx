import { useEffect, useState } from "react";
import { View } from "../types/nav";
import { RaftDogWeek, fetchAllWeeks } from "../db/raftWithDog";
import { fetchQuickAppTitle, setQuickAppTitle } from "../db/quickApps";
import { RAFT_DOG_APP_KEY, RAFT_DOG_DEFAULT_TITLE } from "../quickApps/raftWithDogConstants";
import { completionPercent } from "../quickApps/raftWithDogStats";
import { EditableTitle } from "../components/EditableTitle";
import "./Page.css";
import "./RaftWithDogFullscreenPage.css";

function formatWeekDate(weekStart: string): string {
  const d = new Date(weekStart + "T00:00:00");
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export function RaftWithDogFullscreenPage({ onNavigate }: { onNavigate: (view: View) => void }) {
  const [weeks, setWeeks] = useState<RaftDogWeek[]>([]);
  const [title, setTitle] = useState(RAFT_DOG_DEFAULT_TITLE);

  useEffect(() => {
    fetchAllWeeks().then(setWeeks);
    fetchQuickAppTitle(RAFT_DOG_APP_KEY, RAFT_DOG_DEFAULT_TITLE).then(setTitle);
  }, []);

  const handleRenameTitle = async (next: string) => {
    setTitle(next);
    await setQuickAppTitle(RAFT_DOG_APP_KEY, next, RAFT_DOG_DEFAULT_TITLE);
  };

  const ordered = [...weeks].reverse();
  const lastMonth = completionPercent(weeks, 30);
  const last6Months = completionPercent(weeks, 182);
  const lifetime = completionPercent(weeks, null);

  return (
    <div className="page">
      <div className="detail-header">
        <h1 className="page-title">
          <EditableTitle value={title} onSave={handleRenameTitle} inputClassName="title-rename-input" />
        </h1>
        <div className="detail-header-actions">
          <button className="add-button secondary" onClick={() => onNavigate({ type: "quick-apps-home" })}>
            ‹ Back
          </button>
        </div>
      </div>

      <div className="raft-dog-stats-row">
        <StatTile label="Last month" value={lastMonth} />
        <StatTile label="Last 6 months" value={last6Months} />
        <StatTile label="Lifetime" value={lifetime} />
      </div>

      {ordered.length === 0 ? (
        <p className="page-text">No weeks recorded yet.</p>
      ) : (
        <div className="raft-dog-fullscreen-grid">
          {ordered.map((w) => (
            <div key={w.id} className="raft-dog-fullscreen-pane">
              <div className="raft-dog-fullscreen-date">{formatWeekDate(w.weekStart)}</div>
              {w.photoData ? (
                <img className="raft-dog-fullscreen-image" src={w.photoData} alt="" />
              ) : (
                <div className="raft-dog-fullscreen-image-placeholder">No photo</div>
              )}
              <div className="raft-dog-fullscreen-task">{w.taskText || "—"}</div>
              <span className={`raft-dog-history-badge${w.completed ? " done" : ""}`}>
                {w.completed ? "✓ Complete" : "✕ Incomplete"}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="raft-dog-stat-tile">
      <div className="raft-dog-stat-value">{value === null ? "—" : `${value}%`}</div>
      <div className="raft-dog-stat-label">{label}</div>
    </div>
  );
}
