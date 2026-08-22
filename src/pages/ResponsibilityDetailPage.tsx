import { useEffect, useState } from "react";
import { View } from "../types/nav";
import { Responsibility, DailySchedule, WeeklySchedule, YearlySchedule } from "../types/responsibility";
import {
  fetchResponsibility,
  updateResponsibilityDetails,
  updateResponsibilitySchedule,
  updateResponsibilityIcon,
  updateResponsibilitySound,
  deleteResponsibility,
} from "../db/responsibilities";
import { RESPONSIBILITY_ICON_CHOICES } from "../responsibilities/iconChoices";
import { SOUND_PRESETS, playSound } from "../responsibilities/soundChoices";
import { WEEKDAY_LABELS } from "../responsibilities/scheduling";
import { Breadcrumb } from "../components/Breadcrumb";
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
  const [showIconPicker, setShowIconPicker] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetchResponsibility(responsibilityId).then((r) => {
      if (r) {
        setResp(r);
        setDescription(r.description);
        setConsequences(r.consequences);
        setReasoning(r.reasoning);
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
    await updateResponsibilitySchedule(responsibilityId, schedule);
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
        <div className="resp-section-title">Schedule</div>
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
  const [alarmDraft, setAlarmDraft] = useState("");

  const addAlarm = () => {
    if (!alarmDraft) return;
    onChange({ ...schedule, alarms: [...schedule.alarms, alarmDraft].sort() });
    setAlarmDraft("");
  };

  const removeAlarm = (time: string) => {
    onChange({ ...schedule, alarms: schedule.alarms.filter((a) => a !== time) });
  };

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

      <div className="resp-field-label">
        Alarms
        <div className="resp-alarm-row">
          <input type="time" value={alarmDraft} onChange={(e) => setAlarmDraft(e.target.value)} />
          <button className="add-button secondary" onClick={addAlarm}>
            Add alarm
          </button>
        </div>
        {schedule.alarms.length > 0 && (
          <ul className="resp-alarm-list">
            {schedule.alarms.map((a) => (
              <li key={a}>
                {a}
                <button className="resp-alarm-remove" onClick={() => removeAlarm(a)}>
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
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

  return (
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
  );
}
