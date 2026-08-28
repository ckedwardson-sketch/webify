import { useEffect, useState } from "react";
import { View } from "../types/nav";
import { Responsibility, ResponsibilityCompletion, DailySchedule } from "../types/responsibility";
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
      <div className="resp-home-header">
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
                <li key={r.id}>
                  {/* The whole bar is the completion toggle — responsibilities
                      rarely change, so editing one (via Manage) doesn't need
                      to be one accidental tap away on a list meant purely for
                      checking things off, especially on mobile. */}
                  <button
                    className={`resp-task-row${done ? " done" : ""}`}
                    onClick={() => handleToggleComplete(r, done)}
                    title={done ? "Mark not done" : "Mark done"}
                  >
                    <input type="checkbox" checked={done} readOnly tabIndex={-1} />
                    <span className="resp-icon">{r.icon}</span>
                    <span className="resp-task-row-name">{r.name}</span>
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
              .filter((r) => (r.schedule as DailySchedule).activeDays.includes(now.getDay()))
              .flatMap((r) => {
                const sched = r.schedule as DailySchedule;
                const done = isCompletedForCurrentPeriod(r, completions);
                // A duration-having task anchors to the latest-acceptable
                // (must-start-by) time instead of the suggested one — see
                // DailySchedule.taskTimeHours's comment. Only draw the
                // connecting line/second marker once it's long enough to
                // actually read as a block of time.
                const hasDuration = !!sched.taskTimeHours && sched.taskTimeHours > 0;
                const startTime = hasDuration ? sched.rangeEnd : sched.suggestedTime;
                const startMin = minutesFromTimeString(startTime);
                const startPct = (startMin / 1440) * 100;
                const showsRange = hasDuration && sched.taskTimeHours! >= 1.5;
                const endMin = showsRange ? Math.min(1440, startMin + sched.taskTimeHours! * 60) : startMin;
                const endPct = (endMin / 1440) * 100;

                const startMarker = (
                  <button
                    key={r.id}
                    className={`resp-hourly-marker ${done ? "done" : ""}`}
                    style={{ left: `${startPct}%` }}
                    title={`${r.name} — ${startTime}`}
                    onClick={() => onNavigate({ type: "responsibility-detail", responsibilityId: r.id })}
                  >
                    {r.icon}
                  </button>
                );

                if (!showsRange) return [startMarker];

                return [
                  <div
                    key={`${r.id}-range`}
                    className="resp-hourly-range-line"
                    style={{ left: `${startPct}%`, width: `${Math.max(0, endPct - startPct)}%` }}
                  />,
                  startMarker,
                  <button
                    key={`${r.id}-end`}
                    className={`resp-hourly-marker ${done ? "done" : ""}`}
                    style={{ left: `${endPct}%` }}
                    title={`${r.name} — until ${Math.floor(endMin / 60)
                      .toString()
                      .padStart(2, "0")}:${(endMin % 60).toString().padStart(2, "0")}`}
                    onClick={() => onNavigate({ type: "responsibility-detail", responsibilityId: r.id })}
                  >
                    {r.icon}
                  </button>,
                ];
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
