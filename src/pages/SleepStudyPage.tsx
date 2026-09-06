import { useEffect, useState } from "react";
import { View } from "../types/nav";
import { fetchQuickAppTitle, setQuickAppTitle } from "../db/quickApps";
import {
  SleepLog,
  TestResult,
  fetchAllLogs,
  fetchAllTestResults,
  fetchLog,
  fetchStartDate,
  fetchTestResults,
  saveTestResult,
  setStartDate,
  upsertLog,
} from "../db/sleepStudy";
import { STUDY_LENGTH_DAYS, currentPhase, defaultLogTimes, dueTestKeys, studyDayNumber, testDef } from "../quickApps/sleepStudy";
import { SLEEP_STUDY_APP_KEY, SLEEP_STUDY_DEFAULT_TITLE } from "../quickApps/sleepStudyConstants";
import { buildSleepStudyCsv } from "../quickApps/sleepStudyExport";
import { renderSleepStudyTest } from "../quickApps/tests";
import { downloadBlob } from "../capture/captureEngine";
import { todayISO } from "../responsibilities/scheduling";
import { EditableTitle } from "../components/EditableTitle";
import "./Page.css";
import "./SleepStudyPage.css";

interface LogDraft {
  bedtime: string;
  wakeTime: string;
  sleepLatencyMinutes: string;
  awakeningsCount: string;
  awakeningsMinutes: string;
  sleepQuality: number;
  sleepiness: number;
  energy: number;
  mood: number;
}

const EMPTY_LOG_DRAFT: LogDraft = {
  bedtime: "",
  wakeTime: "",
  sleepLatencyMinutes: "",
  awakeningsCount: "",
  awakeningsMinutes: "",
  sleepQuality: 5,
  sleepiness: 5,
  energy: 5,
  mood: 5,
};

export function SleepStudyPage({ onNavigate }: { onNavigate: (view: View) => void }) {
  const studyDate = todayISO();
  const [title, setTitle] = useState(SLEEP_STUDY_DEFAULT_TITLE);
  const [startDate, setStartDateState] = useState<string | null | undefined>(undefined);
  const [startDateDraft, setStartDateDraft] = useState(studyDate);
  const [log, setLog] = useState<SleepLog | null>(null);
  const [draft, setDraft] = useState<LogDraft>(EMPTY_LOG_DRAFT);
  const [results, setResults] = useState<TestResult[]>([]);
  const [activeTestKey, setActiveTestKey] = useState<string | null>(null);
  const [allLogs, setAllLogs] = useState<SleepLog[]>([]);
  const [allResults, setAllResults] = useState<TestResult[]>([]);
  const [editingStartDate, setEditingStartDate] = useState(false);

  const load = async () => {
    const [sd, l, r, logs, res] = await Promise.all([
      fetchStartDate(),
      fetchLog(studyDate),
      fetchTestResults(studyDate),
      fetchAllLogs(),
      fetchAllTestResults(),
    ]);
    setStartDateState(sd);
    setLog(l);
    setResults(r);
    setAllLogs(logs);
    setAllResults(res);
    setDraft(
      l
        ? {
            bedtime: l.bedtime ?? "",
            wakeTime: l.wakeTime ?? "",
            sleepLatencyMinutes: l.sleepLatencyMinutes?.toString() ?? "",
            awakeningsCount: l.awakeningsCount?.toString() ?? "",
            awakeningsMinutes: l.awakeningsMinutes?.toString() ?? "",
            sleepQuality: l.sleepQuality ?? 5,
            sleepiness: l.sleepiness ?? 5,
            energy: l.energy ?? 5,
            mood: l.mood ?? 5,
          }
        : { ...EMPTY_LOG_DRAFT, ...defaultLogTimes(sd, new Date()) }
    );
  };

  useEffect(() => {
    fetchQuickAppTitle(SLEEP_STUDY_APP_KEY, SLEEP_STUDY_DEFAULT_TITLE).then(setTitle);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRenameTitle = async (next: string) => {
    setTitle(next);
    await setQuickAppTitle(SLEEP_STUDY_APP_KEY, next, SLEEP_STUDY_DEFAULT_TITLE);
  };

  const handleStartStudy = async () => {
    await setStartDate(startDateDraft);
    setEditingStartDate(false);
    await load();
  };

  const openDateEditor = () => {
    setStartDateDraft(startDate ?? studyDate);
    setEditingStartDate(true);
  };

  const handleSaveLog = async () => {
    await upsertLog({
      studyDate,
      bedtime: draft.bedtime || null,
      wakeTime: draft.wakeTime || null,
      sleepLatencyMinutes: draft.sleepLatencyMinutes ? Number(draft.sleepLatencyMinutes) : null,
      awakeningsCount: draft.awakeningsCount ? Number(draft.awakeningsCount) : null,
      awakeningsMinutes: draft.awakeningsMinutes ? Number(draft.awakeningsMinutes) : null,
      sleepQuality: draft.sleepQuality,
      sleepiness: draft.sleepiness,
      energy: draft.energy,
      mood: draft.mood,
    });
    await load();
  };

  const handleTestComplete = async (score: Record<string, unknown>) => {
    if (!activeTestKey) return;
    await saveTestResult(studyDate, activeTestKey, score);
    setActiveTestKey(null);
    await load();
  };

  const handleExport = () => {
    const csv = buildSleepStudyCsv(startDate ?? null, allLogs, allResults);
    downloadBlob(new Blob([csv], { type: "text/csv" }), `sleep-study-${studyDate}.csv`);
  };

  if (startDate === undefined) return null;

  const dayNumber = studyDayNumber(startDate, new Date());
  const inRange = dayNumber !== null && dayNumber >= 1 && dayNumber <= STUDY_LENGTH_DAYS;
  const phase = inRange ? currentPhase(dayNumber!) : null;
  const finished = dayNumber !== null && dayNumber > STUDY_LENGTH_DAYS;
  const due = inRange ? dueTestKeys(dayNumber!) : [];
  const resultsByKey = new Map(results.map((r) => [r.testKey, r]));

  const historyDates = Array.from(
    new Set([...allLogs.map((l) => l.studyDate), ...allResults.map((r) => r.studyDate)])
  )
    .sort()
    .reverse();

  return (
    <div className="page">
      <div className="detail-header">
        <h1 className="page-title">
          <EditableTitle value={title} onSave={handleRenameTitle} inputClassName="title-rename-input" />
        </h1>
        <div className="detail-header-actions">
          {startDate && !editingStartDate && (
            <button className="add-button secondary" onClick={openDateEditor}>
              Change start date
            </button>
          )}
          <button className="add-button secondary" onClick={handleExport}>
            Export CSV
          </button>
          <button className="add-button secondary" onClick={() => onNavigate({ type: "quick-apps-home" })}>
            ‹ Back
          </button>
        </div>
      </div>

      {!startDate || editingStartDate ? (
        <div className="sleep-study-start-card">
          <p className="page-text">
            {editingStartDate
              ? "Change the study's start date — day numbers, phase, and every test's due-date all shift to match."
              : "Set a start date to begin the 42-day study (8h for two weeks, then 7.5h, then 7h)."}
          </p>
          <input
            type="date"
            className="inline-add-input"
            style={{ maxWidth: 200 }}
            value={startDateDraft}
            onChange={(e) => setStartDateDraft(e.target.value)}
          />
          <div style={{ display: "flex", gap: 8 }}>
            <button className="add-button" onClick={handleStartStudy}>
              {editingStartDate ? "Save start date" : "Start study"}
            </button>
            {editingStartDate && (
              <button className="add-button secondary" onClick={() => setEditingStartDate(false)}>
                Cancel
              </button>
            )}
          </div>
        </div>
      ) : finished ? (
        <p className="page-text">Study complete — all {STUDY_LENGTH_DAYS} days recorded. Export your data below.</p>
      ) : dayNumber !== null && dayNumber < 1 ? (
        <p className="page-text">Study starts {startDate}.</p>
      ) : (
        <>
          <div className="sleep-study-day-banner">
            Day {dayNumber} of {STUDY_LENGTH_DAYS} — {phase?.label} phase
          </div>

          <section className="sleep-study-section">
            <h2 className="sleep-study-section-title">Sleep log</h2>
            <div className="sleep-study-log-grid">
              <label className="project-field-label">
                Bedtime
                <input
                  type="time"
                  className="inline-add-input"
                  value={draft.bedtime}
                  onChange={(e) => setDraft({ ...draft, bedtime: e.target.value })}
                />
              </label>
              <label className="project-field-label">
                Wake time
                <input
                  type="time"
                  className="inline-add-input"
                  value={draft.wakeTime}
                  onChange={(e) => setDraft({ ...draft, wakeTime: e.target.value })}
                />
              </label>
              <label className="project-field-label">
                Time to fall asleep (min)
                <input
                  type="number"
                  min={0}
                  className="inline-add-input"
                  value={draft.sleepLatencyMinutes}
                  onChange={(e) => setDraft({ ...draft, sleepLatencyMinutes: e.target.value })}
                />
              </label>
              <label className="project-field-label">
                Awakenings (count)
                <input
                  type="number"
                  min={0}
                  className="inline-add-input"
                  value={draft.awakeningsCount}
                  onChange={(e) => setDraft({ ...draft, awakeningsCount: e.target.value })}
                />
              </label>
              <label className="project-field-label">
                Awakenings (total min)
                <input
                  type="number"
                  min={0}
                  className="inline-add-input"
                  value={draft.awakeningsMinutes}
                  onChange={(e) => setDraft({ ...draft, awakeningsMinutes: e.target.value })}
                />
              </label>
              <RatingSlider label="Sleep quality" value={draft.sleepQuality} onChange={(v) => setDraft({ ...draft, sleepQuality: v })} />
              <RatingSlider label="Sleepiness" value={draft.sleepiness} onChange={(v) => setDraft({ ...draft, sleepiness: v })} />
              <RatingSlider label="Energy" value={draft.energy} onChange={(v) => setDraft({ ...draft, energy: v })} />
              <RatingSlider label="Mood" value={draft.mood} onChange={(v) => setDraft({ ...draft, mood: v })} />
            </div>
            <button className="add-button" style={{ marginTop: 10 }} onClick={handleSaveLog}>
              {log ? "Update sleep log" : "Save sleep log"}
            </button>
          </section>

          <section className="sleep-study-section">
            <h2 className="sleep-study-section-title">Today's tests</h2>
            <div className="sleep-study-test-list">
              {due.map((key) => {
                const def = testDef(key)!;
                const result = resultsByKey.get(key);
                return (
                  <div key={key} className="sleep-study-test-row">
                    <div className="sleep-study-test-info">
                      <span className="sleep-study-test-label">{def.label}</span>
                      <span className="sleep-study-test-measures">{def.measures}</span>
                    </div>
                    <button className={`add-button${result ? " secondary" : ""}`} onClick={() => setActiveTestKey(key)}>
                      {result ? "Redo" : "Start"}
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
        </>
      )}

      {startDate && (
        <section className="sleep-study-section">
          <h2 className="sleep-study-section-title">History</h2>
          {historyDates.length === 0 ? (
            <p className="page-text">No days recorded yet.</p>
          ) : (
            <div className="sleep-study-history-scroll">
              <table className="sleep-study-history-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Phase</th>
                    <th>Quality</th>
                    <th>Sleepiness</th>
                    <th>Tests done</th>
                  </tr>
                </thead>
                <tbody>
                  {historyDates.map((date) => {
                    const l = allLogs.find((x) => x.studyDate === date);
                    const testCount = allResults.filter((r) => r.studyDate === date).length;
                    const dn = studyDayNumber(startDate, new Date(date + "T00:00:00"));
                    const ph = dn !== null ? currentPhase(dn) : null;
                    return (
                      <tr key={date}>
                        <td>{date}</td>
                        <td>{ph?.label ?? "—"}</td>
                        <td>{l?.sleepQuality ?? "—"}</td>
                        <td>{l?.sleepiness ?? "—"}</td>
                        <td>{testCount}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {activeTestKey && (
        <>
          <div className="menu-backdrop" onClick={() => setActiveTestKey(null)} />
          <div className="sleep-study-test-modal">
            <button className="raft-dog-camera-close" onClick={() => setActiveTestKey(null)}>
              ✕
            </button>
            <h3 style={{ marginTop: 0 }}>{testDef(activeTestKey)?.label}</h3>
            {renderSleepStudyTest(activeTestKey, handleTestComplete)}
          </div>
        </>
      )}
    </div>
  );
}

function RatingSlider({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="project-field-label">
      {label} ({value}/10)
      <input type="range" min={1} max={10} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  );
}
