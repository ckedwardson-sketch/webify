import { useEffect, useState } from "react";
import { View } from "../types/nav";
import {
  Responsibility,
  ResponsibilityCompletion,
  DailySchedule,
  WeeklySchedule,
  YearlySchedule,
  YearlyAlarmMode,
  defaultYearlyAlarm,
} from "../types/responsibility";
import {
  fetchResponsibility,
  updateResponsibilityDetails,
  updateResponsibilitySchedule,
  updateResponsibilityIcon,
  updateResponsibilitySound,
  updateResponsibilityPendingLeadTime,
  deleteResponsibility,
  fetchCompletionsForResponsibility,
} from "../db/responsibilities";
import { RESPONSIBILITY_ICON_CHOICES } from "../responsibilities/iconChoices";
import { SOUND_PRESETS, playSound } from "../responsibilities/soundChoices";
import { WEEKDAY_LABELS } from "../responsibilities/scheduling";
import { Breadcrumb } from "../components/Breadcrumb";
import { useSaveFeedback } from "../hooks/useSaveFeedback";
import { SaveStatusIndicator } from "../components/SaveStatusIndicator";
import "./Page.css";
import "./Responsibilities.css";

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export function ResponsibilityDetailPage({
  responsibilityId,
  onNavigate,
}: {
  responsibilityId: number;
  onNavigate: (view: View) => void;
}) {
  const [resp, setResp] = useState<Responsibility | null>(null);
  const [loading, setLoading] = useState(true);
  const [description, setDescription] = useState("");
  const [consequences, setConsequences] = useState("");
  const [reasoning, setReasoning] = useState("");
  const [leadTimeDraft, setLeadTimeDraft] = useState("0");
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [tab, setTab] = useState<"details" | "history">("details");
  const scheduleSave = useSaveFeedback();

  useEffect(() => {
    setLoading(true);
    fetchResponsibility(responsibilityId).then((r) => {
      if (r) {
        setResp(r);
        setDescription(r.description);
        setConsequences(r.consequences);
        setReasoning(r.reasoning);
        setLeadTimeDraft(String(r.pendingLeadTimeHours));
      }
      setLoading(false);
    });
  }, [responsibilityId]);

  const saveDetails = async (fields: Partial<{ description: string; consequences: string; reasoning: string }>) => {
    await updateResponsibilityDetails(responsibilityId, fields);
  };

  const saveSchedule = async (schedule: Responsibility["schedule"]) => {
    if (!resp) return;
    setResp({ ...resp, schedule });
    await scheduleSave.run(() => updateResponsibilitySchedule(responsibilityId, schedule));
  };

  const pickIcon = async (icon: string) => {
    if (!resp) return;
    setResp({ ...resp, icon });
    setShowIconPicker(false);
    await updateResponsibilityIcon(responsibilityId, icon);
  };

  const pickSound = async (soundKey: string) => {
    if (!resp) return;
    setResp({ ...resp, soundKey });
    await updateResponsibilitySound(responsibilityId, soundKey);
  };

  const saveLeadTime = async () => {
    const hours = Math.max(0, Number(leadTimeDraft) || 0);
    setLeadTimeDraft(String(hours));
    if (!resp) return;
    setResp({ ...resp, pendingLeadTimeHours: hours });
    await updateResponsibilityPendingLeadTime(responsibilityId, hours);
  };

  const handleDelete = async () => {
    if (!window.confirm(`Delete "${resp?.name}"? This can't be undone.`)) return;
    await deleteResponsibility(responsibilityId);
    onNavigate({ type: "responsibilities-home" });
  };

  if (loading) {
    return (
      <div className="page">
        <p className="page-text">Loading…</p>
      </div>
    );
  }
  if (!resp) {
    return (
      <div className="page">
        <p className="page-text">Responsibility not found.</p>
      </div>
    );
  }

  return (
    <div className="page">
      <Breadcrumb
        crumbs={[
          { label: "Responsibilities", onClick: () => onNavigate({ type: "responsibilities-home" }) },
          { label: resp.name },
        ]}
      />

      <div className="resp-detail-header">
        <div className="resp-icon-picker-wrapper">
          <button className="resp-icon-button" onClick={() => setShowIconPicker((v) => !v)}>
            {resp.icon}
          </button>
          {showIconPicker && (
            <>
              <div className="menu-backdrop" onClick={() => setShowIconPicker(false)} />
              <div className="resp-icon-grid">
                {RESPONSIBILITY_ICON_CHOICES.map((icon) => (
                  <button key={icon} className="resp-icon-choice" onClick={() => pickIcon(icon)}>
                    {icon}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
        <h1 className="page-title">{resp.name}</h1>
        <button className="add-button danger" onClick={handleDelete}>
          Delete
        </button>
      </div>

      <div className="resp-tab-bar">
        <button className={tab === "details" ? "resp-tab active" : "resp-tab"} onClick={() => setTab("details")}>
          Details
        </button>
        <button className={tab === "history" ? "resp-tab active" : "resp-tab"} onClick={() => setTab("history")}>
          History
        </button>
      </div>

      {tab === "history" ? (
        <HistoryTab responsibilityId={responsibilityId} />
      ) : (
        <>
      <label className="resp-field-label">
        Description
        <textarea
          className="resp-textarea"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onBlur={() => saveDetails({ description })}
          rows={3}
        />
      </label>

      <label className="resp-field-label">
        Consequences of missing this
        <textarea
          className="resp-textarea"
          value={consequences}
          onChange={(e) => setConsequences(e.target.value)}
          onBlur={() => saveDetails({ consequences })}
          rows={3}
        />
      </label>

      <details className="resp-reasoning">
        <summary>Why this responsibility was taken on</summary>
        <textarea
          className="resp-textarea"
          value={reasoning}
          onChange={(e) => setReasoning(e.target.value)}
          onBlur={() => saveDetails({ reasoning })}
          rows={3}
        />
      </details>

      <div className="resp-section">
        <div className="resp-section-title" style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          Schedule
          <SaveStatusIndicator status={scheduleSave.status} />
        </div>
        {resp.category === "daily" && (
          <DailyScheduleEditor schedule={resp.schedule as DailySchedule} onChange={saveSchedule} />
        )}
        {resp.category === "weekly" && (
          <WeeklyScheduleEditor schedule={resp.schedule as WeeklySchedule} onChange={saveSchedule} />
        )}
        {resp.category === "yearly" && (
          <YearlyScheduleEditor schedule={resp.schedule as YearlySchedule} onChange={saveSchedule} />
        )}
      </div>

      <div className="resp-section">
        <div className="resp-section-title">When it shows up as pending</div>
        <label className="resp-field-label">
          Show as pending starting this many hours before it's due (0 = show for the whole period)
          <input
            className="resp-lead-time-input"
            type="number"
            min={0}
            step={0.5}
            value={leadTimeDraft}
            onChange={(e) => setLeadTimeDraft(e.target.value)}
            onBlur={saveLeadTime}
          />
        </label>
      </div>

      <div className="resp-section">
        <div className="resp-section-title">Alarm sound</div>
        <div className="resp-sound-list">
          {SOUND_PRESETS.map((s) => (
            <label key={s.key} className="resp-sound-row">
              <input
                type="radio"
                name="sound"
                checked={resp.soundKey === s.key}
                onChange={() => pickSound(s.key)}
              />
              {s.label}
              <button className="resp-sound-test" onClick={() => playSound(s.key)}>
                ▶
              </button>
            </label>
          ))}
        </div>
      </div>
        </>
      )}
    </div>
  );
}

// ---- History ----------------------------------------------------------

function formatCompletionDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { weekday: "short", year: "numeric", month: "short", day: "numeric" });
}

function formatCompletedAt(iso: string): string {
  const d = new Date(iso.includes("T") ? iso : iso.replace(" ", "T") + "Z");
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

// Bare-foundation completion log — just a reverse-chronological list of
// every occurrence this responsibility has been marked done for. No
// streak stats or filtering yet, just visibility into the raw history.
function HistoryTab({ responsibilityId }: { responsibilityId: number }) {
  const [completions, setCompletions] = useState<ResponsibilityCompletion[] | null>(null);

  useEffect(() => {
    setCompletions(null);
    fetchCompletionsForResponsibility(responsibilityId).then(setCompletions);
  }, [responsibilityId]);

  if (completions === null) {
    return <p className="page-text">Loading…</p>;
  }

  if (completions.length === 0) {
    return <p className="page-text">No completions recorded yet.</p>;
  }

  return (
    <div className="resp-section">
      <div className="resp-section-title">{completions.length} completion{completions.length === 1 ? "" : "s"}</div>
      <ul className="resp-history-list">
        {completions.map((c) => (
          <li key={c.id} className="resp-history-row">
            <span className="resp-history-date">{formatCompletionDate(c.occurrenceDate)}</span>
            <span className="resp-history-completed-at">completed {formatCompletedAt(c.completedAt)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---- Shared: a simple add/remove list of HH:MM times --------------

function TimeListEditor({
  times,
  onChange,
  label,
}: {
  times: string[];
  onChange: (times: string[]) => void;
  label: string;
}) {
  const [draft, setDraft] = useState("");

  const add = () => {
    if (!draft) return;
    onChange([...times, draft].sort());
    setDraft("");
  };

  const remove = (time: string) => {
    onChange(times.filter((t) => t !== time));
  };

  return (
    <div className="resp-field-label">
      {label}
      <div className="resp-alarm-row">
        <input type="time" value={draft} onChange={(e) => setDraft(e.target.value)} />
        <button className="add-button secondary" onClick={add}>
          Add
        </button>
      </div>
      {times.length > 0 && (
        <ul className="resp-alarm-list">
          {times.map((t) => (
            <li key={t}>
              {t}
              <button className="resp-alarm-remove" onClick={() => remove(t)}>
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ---- Daily ----------------------------------------------------------

function DailyScheduleEditor({
  schedule,
  onChange,
}: {
  schedule: DailySchedule;
  onChange: (s: DailySchedule) => void;
}) {
  const toggleActiveDay = (day: number) => {
    const has = schedule.activeDays.includes(day);
    const activeDays = has
      ? schedule.activeDays.filter((d) => d !== day)
      : [...schedule.activeDays, day].sort();
    onChange({ ...schedule, activeDays });
  };

  const setAllDays = (days: number[]) => onChange({ ...schedule, activeDays: days });

  return (
    <div className="resp-schedule-grid">
      <label className="resp-field-label">
        Earliest acceptable time
        <input
          type="time"
          value={schedule.rangeStart}
          onChange={(e) => onChange({ ...schedule, rangeStart: e.target.value })}
        />
      </label>
      <label className="resp-field-label">
        Latest acceptable time
        <input
          type="time"
          value={schedule.rangeEnd}
          onChange={(e) => onChange({ ...schedule, rangeEnd: e.target.value })}
        />
      </label>
      <label className="resp-field-label">
        Suggested time
        <input
          type="time"
          value={schedule.suggestedTime}
          onChange={(e) => onChange({ ...schedule, suggestedTime: e.target.value })}
        />
      </label>
      <label className="resp-field-label">
        Task duration in hours (optional — for a real block of time, not just an instant)
        <input
          type="number"
          min={0}
          step={0.25}
          className="resp-lead-time-input"
          value={schedule.taskTimeHours ?? ""}
          placeholder="none"
          onChange={(e) =>
            onChange({
              ...schedule,
              taskTimeHours: e.target.value === "" ? undefined : Math.max(0, Number(e.target.value)),
            })
          }
        />
      </label>

      <div className="resp-field-label">
        Active days
        <div className="resp-day-toggle">
          {WEEKDAY_LABELS.map((label, idx) => (
            <button
              key={label}
              className={schedule.activeDays.includes(idx) ? "active" : ""}
              onClick={() => toggleActiveDay(idx)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="resp-day-presets">
          <button onClick={() => setAllDays([0, 1, 2, 3, 4, 5, 6])}>Every day</button>
          <button onClick={() => setAllDays([1, 2, 3, 4, 5])}>Weekdays</button>
          <button onClick={() => setAllDays([0, 6])}>Weekends</button>
        </div>
      </div>

      <TimeListEditor
        label="Alarms"
        times={schedule.alarms}
        onChange={(alarms) => onChange({ ...schedule, alarms })}
      />
    </div>
  );
}

// ---- Weekly / Bi-weekly ---------------------------------------------

function WeeklyScheduleEditor({
  schedule,
  onChange,
}: {
  schedule: WeeklySchedule;
  onChange: (s: WeeklySchedule) => void;
}) {
  const toggleDay = (day: number) => {
    const has = schedule.allowedDays.includes(day);
    const allowedDays = has
      ? schedule.allowedDays.filter((d) => d !== day)
      : [...schedule.allowedDays, day].sort();
    onChange({ ...schedule, allowedDays });
  };

  return (
    <div>
      <div className="resp-field-label">
        Frequency
        <div className="resp-freq-toggle">
          <button
            className={schedule.frequency === "weekly" ? "active" : ""}
            onClick={() => onChange({ ...schedule, frequency: "weekly" })}
          >
            Weekly
          </button>
          <button
            className={schedule.frequency === "biweekly" ? "active" : ""}
            onClick={() => onChange({ ...schedule, frequency: "biweekly" })}
          >
            Bi-weekly
          </button>
        </div>
      </div>

      <div className="resp-field-label">
        Must be done on any of (OR):
        <div className="resp-day-toggle">
          {WEEKDAY_LABELS.map((label, idx) => (
            <button
              key={label}
              className={schedule.allowedDays.includes(idx) ? "active" : ""}
              onClick={() => toggleDay(idx)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <TimeListEditor
        label="Alarms (on whichever allowed day it's due)"
        times={schedule.alarms}
        onChange={(alarms) => onChange({ ...schedule, alarms })}
      />
    </div>
  );
}

// ---- Yearly -----------------------------------------------------------

function YearlyScheduleEditor({
  schedule,
  onChange,
}: {
  schedule: YearlySchedule;
  onChange: (s: YearlySchedule) => void;
}) {
  const daysInMonth = (month: number) => new Date(2028, month, 0).getDate(); // 2028: leap year, safe for Feb 29

  const setAlarmMode = (mode: YearlyAlarmMode) => {
    onChange({ ...schedule, alarm: defaultYearlyAlarm(mode) });
  };

  const toggleAlarmWeekDay = (day: number) => {
    if (!schedule.alarm) return;
    const has = schedule.alarm.weekDays.includes(day);
    const weekDays = has
      ? schedule.alarm.weekDays.filter((d) => d !== day)
      : [...schedule.alarm.weekDays, day].sort();
    onChange({ ...schedule, alarm: { ...schedule.alarm, weekDays } });
  };

  return (
    <div>
      <div className="resp-yearly-grid">
        <label className="resp-field-label">
          From
          <div className="resp-yearly-date">
            <select
              value={schedule.startMonth}
              onChange={(e) => onChange({ ...schedule, startMonth: Number(e.target.value) })}
            >
              {MONTH_NAMES.map((m, i) => (
                <option key={m} value={i + 1}>
                  {m}
                </option>
              ))}
            </select>
            <select
              value={schedule.startDay}
              onChange={(e) => onChange({ ...schedule, startDay: Number(e.target.value) })}
            >
              {Array.from({ length: daysInMonth(schedule.startMonth) }, (_, i) => i + 1).map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
        </label>

        <label className="resp-field-label">
          To
          <div className="resp-yearly-date">
            <select
              value={schedule.endMonth}
              onChange={(e) => onChange({ ...schedule, endMonth: Number(e.target.value) })}
            >
              {MONTH_NAMES.map((m, i) => (
                <option key={m} value={i + 1}>
                  {m}
                </option>
              ))}
            </select>
            <select
              value={schedule.endDay}
              onChange={(e) => onChange({ ...schedule, endDay: Number(e.target.value) })}
            >
              {Array.from({ length: daysInMonth(schedule.endMonth) }, (_, i) => i + 1).map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
        </label>
      </div>

      <div className="resp-field-label" style={{ marginTop: 8 }}>
        Recurring alarm while within this range
        <div className="resp-freq-toggle">
          <button className={!schedule.alarm ? "active" : ""} onClick={() => onChange({ ...schedule, alarm: null })}>
            None
          </button>
          <button
            className={schedule.alarm?.mode === "day" ? "active" : ""}
            onClick={() => setAlarmMode("day")}
          >
            Every day
          </button>
          <button
            className={schedule.alarm?.mode === "week" ? "active" : ""}
            onClick={() => setAlarmMode("week")}
          >
            Certain weekdays
          </button>
          <button
            className={schedule.alarm?.mode === "hours" ? "active" : ""}
            onClick={() => setAlarmMode("hours")}
          >
            Every N hours
          </button>
        </div>
      </div>

      {schedule.alarm?.mode === "day" && (
        <TimeListEditor
          label="Times each day"
          times={schedule.alarm.dayTimes}
          onChange={(dayTimes) => onChange({ ...schedule, alarm: { ...schedule.alarm!, dayTimes } })}
        />
      )}

      {schedule.alarm?.mode === "week" && (
        <>
          <div className="resp-field-label">
            Which weekdays
            <div className="resp-day-toggle">
              {WEEKDAY_LABELS.map((label, idx) => (
                <button
                  key={label}
                  className={schedule.alarm!.weekDays.includes(idx) ? "active" : ""}
                  onClick={() => toggleAlarmWeekDay(idx)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <TimeListEditor
            label="Times on those days"
            times={schedule.alarm.weekTimes}
            onChange={(weekTimes) => onChange({ ...schedule, alarm: { ...schedule.alarm!, weekTimes } })}
          />
        </>
      )}

      {schedule.alarm?.mode === "hours" && (
        <label className="resp-field-label">
          Every how many hours
          <input
            type="number"
            min={1}
            max={24}
            className="resp-lead-time-input"
            value={schedule.alarm.everyHours}
            onChange={(e) =>
              onChange({
                ...schedule,
                alarm: { ...schedule.alarm!, everyHours: Math.max(1, Number(e.target.value) || 1) },
              })
            }
          />
        </label>
      )}
    </div>
  );
}
