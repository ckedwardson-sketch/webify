import { useEffect, useState } from "react";
import { View } from "../types/nav";
import { fetchQuickAppTitle, setQuickAppTitle } from "../db/quickApps";
import { fetchLog, fetchStartDate, fetchTestResults } from "../db/sleepStudy";
import { outstandingSummary, studyDayNumber } from "../quickApps/sleepStudy";
import { SLEEP_STUDY_APP_KEY, SLEEP_STUDY_DEFAULT_TITLE } from "../quickApps/sleepStudyConstants";
import { todayISO } from "../responsibilities/scheduling";
import { EditableTitle } from "./EditableTitle";
import "./SleepStudyPane.css";

// Deliberately minimal — the real interaction (sleep log + daily tests)
// all happens on the dedicated full screen; this pane is just a header
// and a one-line "what's still due today" reminder that opens it.
export function SleepStudyPane({ onNavigate }: { onNavigate: (view: View) => void }) {
  const [title, setTitle] = useState(SLEEP_STUDY_DEFAULT_TITLE);
  const [summary, setSummary] = useState("Loading…");

  useEffect(() => {
    fetchQuickAppTitle(SLEEP_STUDY_APP_KEY, SLEEP_STUDY_DEFAULT_TITLE).then(setTitle);

    const load = async () => {
      const startDate = await fetchStartDate();
      const dayNumber = studyDayNumber(startDate, new Date());
      const date = todayISO();
      const [log, results] = await Promise.all([fetchLog(date), fetchTestResults(date)]);
      setSummary(outstandingSummary(dayNumber, !!log, new Set(results.map((r) => r.testKey))));
    };
    load();
  }, []);

  const handleRenameTitle = async (next: string) => {
    setTitle(next);
    await setQuickAppTitle(SLEEP_STUDY_APP_KEY, next, SLEEP_STUDY_DEFAULT_TITLE);
  };

  return (
    <div className="sleep-study-pane" onClick={() => onNavigate({ type: "quick-apps-sleep-study" })}>
      <div className="sleep-study-header-wrap" onClick={(e) => e.stopPropagation()}>
        <EditableTitle
          value={title}
          onSave={handleRenameTitle}
          className="sleep-study-header"
          inputClassName="sleep-study-header-input"
        />
      </div>
      <div className="sleep-study-reminder">{summary}</div>
    </div>
  );
}
