import { useEffect, useState } from "react";
import { View } from "../types/nav";
import { Responsibility, ResponsibilityCompletion } from "../types/responsibility";
import {
  fetchResponsibilities,
  fetchAllCompletions,
  markComplete,
  unmarkComplete,
  unmarkCompletionsInRange,
} from "../db/responsibilities";
import {
  isPendingNow,
  isCompletedForCurrentPeriod,
  dailyCompletionPercent,
  minutesFromTimeString,
  todayISO,
  startOfWeekISO,
  endOfWeekISO,
  WEEKDAY_LABELS,
} from "../responsibilities/scheduling";
import "./Page.css";
import "./Responsibilities.css";

export function ResponsibilitiesHomePage({ onNavigate }: { onNavigate: (view: View) => void }) {
  const [responsibilities, setResponsibilities] = useState<Responsibility[]>([]);
  const [completions, setCompletions] = useState<ResponsibilityCompletion[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const [r, c] = await Promise.all([fetchResponsibilities(), fetchAllCompletions()]);
    setResponsibilities(r);
    setCompletions(c);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const daily = responsibilities.filter((r) => r.category === "daily");
  const weekly = responsibilities.filter((r) => r.category === "weekly");

  // The ONLY tasks that ever appear with a checkbox: currently pending,
  // or already completed for the period they'd otherwise be pending
  // in. A yearly task that isn't due for another 11 months is neither
  // — it never shows up here at all, checkbox or otherwise.
  const currentTasks = responsibilities.filter(
    (r) => isPendingNow(r, completions) || isCompletedForCurrentPeriod(r, completions)
  );

  const handleToggleComplete = async (r: Responsibility, currentlyDone: boolean) => {
    if (currentlyDone) {
      if (r.category === "daily") {
        await unmarkComplete(r.id, todayISO());
      } else if (r.category === "weekly") {
        await unmarkCompletionsInRange(r.id, startOfWeekISO(), endOfWeekISO());
      } else {
        const year = String(new Date().getFullYear());
        await unmarkCompletionsInRange(r.id, `${year}-01-01`, `${year}-12-31`);
      }
    } else {
      await markComplete(r.id, todayISO());
    }
    await load();
  };

  if (loading) {
    return (
      <div className="page">
        <p className="page-text">Loading…</p>
      </div>
    );
  }

  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  return (
    <div className="page resp-page">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h1 className="page-title">Responsibilities</h1>
        <button
          className="add-button secondary"
          onClick={() => onNavigate({ type: "responsibilities-manage" })}
        >
          Manage
        </button>
      </div>

      <div className="resp-widget" style={{ marginBottom: 16 }}>
        <div className="resp-widget-title">Current Tasks</div>
        {currentTasks.length === 0 ? (
          <p className="resp-empty">Nothing due right now.</p>
        ) : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 2 }}>
            {currentTasks.map((r) => {
              const done = isCompletedForCurrentPeriod(r, completions);
              return (
                <li
                  key={r.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "6px 4px",
                    borderBottom: "1px solid #eee",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={done}
                    onChange={() => handleToggleComplete(r, done)}
                    title={done ? "Mark not done" : "Mark done"}
                  />
                  <button
                    onClick={() => onNavigate({ type: "responsibility-detail", responsibilityId: r.id })}
                    style={{
                      flex: 1,
                      textAlign: "left",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      fontSize: "0.9rem",
                      color: done ? "#999" : "#222",
                      textDecoration: done ? "line-through" : "none",
                    }}
                  >
                    <span className="resp-icon">{r.icon}</span> {r.name}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="resp-quick-grid">
        {/* Hourly timeline (daily only) */}
        <div className="resp-widget">
          <div className="resp-widget-title">Today</div>
          <div className="resp-hourly-track">
            <div className="resp-hourly-now" style={{ left: `${(nowMinutes / 1440) * 100}%` }} />
            {[0, 6, 12, 18, 24].map((h) => (
              <div key={h} className="resp-hour-tick" style={{ left: `${(h / 24) * 100}%` }}>
                {h}
              </div>
            ))}
            {daily
              .filter((r) => (r.schedule as { activeDays: number[] }).activeDays.includes(now.getDay()))
              .map((r) => {
                const sched = r.schedule as { suggestedTime: string };
                const pct = (minutesFromTimeString(sched.suggestedTime) / 1440) * 100;
                const done = isCompletedForCurrentPeriod(r, completions);
                return (
                  <button
                    key={r.id}
                    className={`resp-hourly-marker ${done ? "done" : ""}`}
                    style={{ left: `${pct}%` }}
                    title={`${r.name} — ${sched.suggestedTime}`}
                    onClick={() => onNavigate({ type: "responsibility-detail", responsibilityId: r.id })}
                  >
                    {r.icon}
                  </button>
                );
              })}
          </div>
        </div>

        {/* Weekly timeline (weekly/biweekly only) */}
        <div className="resp-widget">
          <div className="resp-widget-title">This Week</div>
          <div className="resp-week-grid">
            {WEEKDAY_LABELS.map((label, dayIdx) => (
              <div key={label} className="resp-week-col">
                <div className="resp-week-label">{label}</div>
                <div className="resp-week-icons">
                  {weekly
                    .filter((r) => (r.schedule as { allowedDays: number[] }).allowedDays.includes(dayIdx))
                    .map((r) => {
                      const done = isCompletedForCurrentPeriod(r, completions);
                      return (
                        <button
                          key={r.id}
                          className={`resp-week-marker ${done ? "done" : ""}`}
                          title={r.name}
                          onClick={() =>
                            onNavigate({ type: "responsibility-detail", responsibilityId: r.id })
                          }
                        >
                          {r.icon}
                        </button>
                      );
                    })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Completion bar */}
        <div className="resp-widget">
          <div className="resp-widget-title">Today's Completion</div>
          {(() => {
            const pct = dailyCompletionPercent(daily, completions);
            return (
              <>
                <div className="resp-progress-track">
                  <div className="resp-progress-fill" style={{ width: `${pct}%` }} />
                </div>
                <div className="resp-progress-label">{pct}% done</div>
              </>
            );
          })()}
        </div>
      </div>
    </div>
  );
}
