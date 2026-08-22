import { useEffect, useState } from "react";
import { View } from "../types/nav";
import { Responsibility, ResponsibilityCategory, ResponsibilityCompletion } from "../types/responsibility";
import {
  fetchResponsibilities,
  fetchAllCompletions,
  addResponsibility,
  markComplete,
} from "../db/responsibilities";
import {
  isPendingNow,
  isCompletedForCurrentPeriod,
  dailyCompletionPercent,
  minutesFromTimeString,
  todayISO,
  WEEKDAY_LABELS,
} from "../responsibilities/scheduling";
import "./Page.css";
import "./Responsibilities.css";

export function ResponsibilitiesHomePage({ onNavigate }: { onNavigate: (view: View) => void }) {
  const [responsibilities, setResponsibilities] = useState<Responsibility[]>([]);
  const [completions, setCompletions] = useState<ResponsibilityCompletion[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingCategory, setAddingCategory] = useState<ResponsibilityCategory | null>(null);
  const [newName, setNewName] = useState("");

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
  const yearly = responsibilities.filter((r) => r.category === "yearly");
  const pending = responsibilities.filter((r) => isPendingNow(r, completions));

  const handleQuickComplete = async (r: Responsibility) => {
    await markComplete(r.id, todayISO());
    await load();
  };

  const confirmAdd = async (category: ResponsibilityCategory) => {
    const name = newName.trim();
    setAddingCategory(null);
    setNewName("");
    if (!name) return;
    const id = await addResponsibility(name, category);
    onNavigate({ type: "responsibility-detail", responsibilityId: id });
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
      <h1 className="page-title">Responsibilities</h1>

      <div className="resp-quick-grid">
        {/* 1. Pending list */}
        <div className="resp-widget">
          <div className="resp-widget-title">Pending</div>
          {pending.length === 0 ? (
            <p className="resp-empty">Nothing pending right now.</p>
          ) : (
            <ul className="resp-pending-list">
              {pending.map((r) => (
                <li key={r.id} className="resp-pending-item">
                  <button
                    className="resp-pending-label"
                    onClick={() => onNavigate({ type: "responsibility-detail", responsibilityId: r.id })}
                  >
                    <span className="resp-icon">{r.icon}</span> {r.name}
                  </button>
                  <button className="resp-done-btn" onClick={() => handleQuickComplete(r)}>
                    Done
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* 2. Hourly timeline (daily only) */}
        <div className="resp-widget">
          <div className="resp-widget-title">Today</div>
          <div className="resp-hourly-track">
            <div className="resp-hourly-now" style={{ left: `${(nowMinutes / 1440) * 100}%` }} />
            {[0, 6, 12, 18, 24].map((h) => (
              <div key={h} className="resp-hour-tick" style={{ left: `${(h / 24) * 100}%` }}>
                {h}
              </div>
            ))}
            {daily.map((r) => {
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

        {/* 3. Weekly timeline (weekly/biweekly only) */}
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

        {/* 4. Completion bar */}
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

      {(
        [
          ["daily", "Daily"],
          ["weekly", "Weekly / Bi-weekly"],
          ["yearly", "Yearly"],
        ] as [ResponsibilityCategory, string][]
      ).map(([category, title]) => {
        const items =
          category === "daily" ? daily : category === "weekly" ? weekly : yearly;
        return (
          <div key={category} className="resp-category-section">
            <div className="resp-category-header">
              <h2 className="resp-category-title">{title}</h2>
              <button className="icon-button" onClick={() => setAddingCategory(category)} title="Add">
                +
              </button>
            </div>

            {addingCategory === category && (
              <input
                className="inline-add-input"
                autoFocus
                placeholder="New responsibility name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") confirmAdd(category);
                  if (e.key === "Escape") {
                    setAddingCategory(null);
                    setNewName("");
                  }
                }}
                onBlur={() => {
                  setAddingCategory(null);
                  setNewName("");
                }}
              />
            )}

            {items.length === 0 ? (
              <p className="resp-empty">Nothing here yet.</p>
            ) : (
              <ul className="list">
                {items.map((r) => (
                  <li key={r.id}>
                    <button
                      className="list-item"
                      onClick={() => onNavigate({ type: "responsibility-detail", responsibilityId: r.id })}
                    >
                      <span className="resp-icon">{r.icon}</span> {r.name}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}
