import { useEffect, useRef, useState } from "react";
import { View } from "../types/nav";
import {
  RaftDogBankEntry,
  RaftDogWeek,
  addToBank,
  completeWeekTask,
  drawRandomTaskFromBank,
  fetchBank,
  fetchHistory,
  fetchWeek,
  reshuffleRandomTask,
  setWeekTask,
} from "../db/raftWithDog";
import { fetchQuickAppTitle, setQuickAppTitle } from "../db/quickApps";
import { RAFT_DOG_APP_KEY, RAFT_DOG_DEFAULT_TITLE } from "../quickApps/raftWithDogConstants";
import { cycleWeekStartISO, formatCountdown, isSaturday, isWeekend, msUntilDeadline } from "../quickApps/raftWithDogTime";
import { EditableTitle } from "./EditableTitle";
import "./RaftWithDogPane.css";

const JPEG_QUALITY = 0.85;

function formatWeekLabel(weekStart: string): string {
  const d = new Date(weekStart + "T00:00:00");
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// Live camera preview — click the video to capture the frame, same
// pattern as QuickPhotoWidget's CameraStage.
function CameraLiveView({ onCapture }: { onCapture: (dataUrl: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let cancelled = false;
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "environment" } })
      .then((s) => {
        if (cancelled) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        stream = s;
        if (videoRef.current) videoRef.current.srcObject = s;
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Camera unavailable — check app permissions."));
    return () => {
      cancelled = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const handleClick = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")!.drawImage(video, 0, 0);
    onCapture(canvas.toDataURL("image/jpeg", JPEG_QUALITY));
  };

  if (error) return <div className="raft-dog-error">{error}</div>;
  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      muted
      className="raft-dog-camera-video"
      onClick={handleClick}
    />
  );
}

export function RaftWithDogPane({ onNavigate }: { onNavigate: (view: View) => void }) {
  const [now, setNow] = useState(() => new Date());
  const [title, setTitle] = useState(RAFT_DOG_DEFAULT_TITLE);
  const [week, setWeek] = useState<RaftDogWeek | null | undefined>(undefined);
  const [history, setHistory] = useState<RaftDogWeek[]>([]);
  const [bank, setBank] = useState<RaftDogBankEntry[]>([]);
  const [draft, setDraft] = useState("");
  const [revealing, setRevealing] = useState(false);
  const [bankEmptyError, setBankEmptyError] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [captureError, setCaptureError] = useState<string | null>(null);
  const weekendFillTriedRef = useRef<string | null>(null);

  const weekStart = cycleWeekStartISO(now);

  const load = async () => {
    const [w, h, b] = await Promise.all([fetchWeek(weekStart), fetchHistory(weekStart), fetchBank()]);
    setWeek(w);
    setHistory(h);
    setBank(b);
    return w;
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStart]);

  useEffect(() => {
    fetchQuickAppTitle(RAFT_DOG_APP_KEY, RAFT_DOG_DEFAULT_TITLE).then(setTitle);
  }, []);

  const handleRenameTitle = async (next: string) => {
    setTitle(next);
    await setQuickAppTitle(RAFT_DOG_APP_KEY, next, RAFT_DOG_DEFAULT_TITLE);
  };

  // Ticks the clock forward once a minute so the countdown stays live
  // and the week auto-rolls over at the Tuesday boundary without a reload.
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  // Weekend auto-fill — on landing here Sat/Sun with an empty slot, pull
  // a random saved task in (with a reveal flash), once per week.
  useEffect(() => {
    if (week === undefined) return;
    if (weekendFillTriedRef.current === weekStart) return;
    if (week?.taskText || !isWeekend(now)) return;
    weekendFillTriedRef.current = weekStart;

    if (bank.length === 0) {
      setBankEmptyError(true);
      return;
    }
    setRevealing(true);
    drawRandomTaskFromBank(weekStart).then(() => {
      load().then(() => setTimeout(() => setRevealing(false), 900));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [week, weekStart, bank.length, now]);

  if (week === undefined) return null;

  const handleAddTask = async () => {
    const text = draft.trim();
    if (!text) return;
    setBankEmptyError(false);
    await setWeekTask(weekStart, text, false);
    setDraft("");
    await load();
  };

  // Saves straight to the saved list without touching whatever's
  // currently sitting in this week's slot.
  const handleSaveToList = async () => {
    const text = draft.trim();
    if (!text) return;
    await addToBank(text);
    setDraft("");
    await load();
  };

  // Always-available random draw — boots whatever's active (if
  // anything, and not already completed) into the saved list, then
  // pulls a fresh pick out of it.
  const handleRandom = async () => {
    if (week?.completed) return;
    setBankEmptyError(false);
    setRevealing(true);
    const picked = await reshuffleRandomTask(weekStart);
    await load();
    setTimeout(() => setRevealing(false), 600);
    if (picked === null) setBankEmptyError(true);
  };

  const handleCapture = async (dataUrl: string) => {
    if (!week?.taskText || week.completed || capturing) return;
    setCapturing(true);
    setCaptureError(null);
    try {
      await completeWeekTask(weekStart, dataUrl);
      setShowCamera(false);
      await load();
    } catch (err) {
      setCaptureError(err instanceof Error ? err.message : "Couldn't save the photo.");
    } finally {
      setCapturing(false);
    }
  };

  const msLeft = msUntilDeadline(weekStart, now);
  const showNudgeBanner = isSaturday(now) && now.getHours() >= 10 && !week?.taskText;

  return (
    <div className={`raft-dog-pane${revealing ? " raft-dog-revealing" : ""}`}>
      <div className="raft-dog-countdown">{formatCountdown(msLeft)}</div>
      <EditableTitle
        value={title}
        onSave={handleRenameTitle}
        className="raft-dog-header"
        inputClassName="raft-dog-header-input"
      />

      <div className="raft-dog-top-row">
        <input
          className="raft-dog-input"
          placeholder="This week's quest…"
          value={draft}
          disabled={!!week?.completed}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleAddTask();
          }}
        />
        <button className="raft-dog-icon-btn" title="Add quest" disabled={!!week?.completed} onClick={handleAddTask}>
          ✓
        </button>
        <button
          className="raft-dog-icon-btn"
          title="Save to list without changing this week's quest"
          disabled={!draft.trim()}
          onClick={handleSaveToList}
        >
          💾
        </button>
        <button className="raft-dog-icon-btn" title="Random quest from the saved list" disabled={!!week?.completed} onClick={handleRandom}>
          🎲
        </button>
        <button
          className="raft-dog-icon-btn"
          title="Take a photo to mark the quest complete"
          disabled={!week?.taskText || !!week?.completed}
          onClick={() => setShowCamera(true)}
        >
          📷
        </button>
      </div>

      <div className="raft-dog-status">
        {week?.completed ? (
          <>
            <div className="raft-dog-status-complete">Quest complete! 🎉</div>
            <div className="raft-dog-status-task">{week.taskText}</div>
            {week.photoData && <img className="raft-dog-status-photo" src={week.photoData} alt="" />}
          </>
        ) : week?.taskText ? (
          <div className="raft-dog-status-task">{week.taskText}</div>
        ) : (
          <div className="raft-dog-status-empty">Add a quest here</div>
        )}
      </div>

      {bankEmptyError && !week?.taskText && (
        <div className="raft-dog-error">No saved quests to pull from — add one to get this week going.</div>
      )}
      {showNudgeBanner && (
        <div className="raft-dog-nudge">
          {bank.length > 0
            ? "Nothing set for this week yet — shuffle in a saved quest or add your own."
            : "Nothing set for this week yet — add a quest to get started."}
        </div>
      )}

      <div className="raft-dog-history-wrap">
        <div className="raft-dog-history-header">
          <span>History</span>
          <button
            className="raft-dog-fullscreen-btn"
            title="Open full view"
            onClick={() => onNavigate({ type: "quick-apps-raft-dog-fullscreen" })}
          >
            ⤢
          </button>
        </div>
        <div className="raft-dog-history-scroll">
          {history.length === 0 ? (
            <div className="raft-dog-history-empty">No past weeks yet</div>
          ) : (
            history.map((h) => (
              <div key={h.id} className="raft-dog-history-row">
                {h.photoData && <img className="raft-dog-history-thumb" src={h.photoData} alt="" />}
                <div className="raft-dog-history-info">
                  <span className="raft-dog-history-date">{formatWeekLabel(h.weekStart)}</span>
                  <span className="raft-dog-history-task">{h.taskText || "—"}</span>
                </div>
                <span className={`raft-dog-history-badge${h.completed ? " done" : ""}`}>
                  {h.completed ? "✓" : "✕"}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      {showCamera && (
        <>
          <div className="menu-backdrop" onClick={() => setShowCamera(false)} />
          <div className="raft-dog-camera-modal">
            <button className="raft-dog-camera-close" onClick={() => setShowCamera(false)}>
              ✕
            </button>
            {captureError && <div className="raft-dog-error">{captureError}</div>}
            <CameraLiveView onCapture={handleCapture} />
            <div className="raft-dog-camera-hint">{capturing ? "Saving…" : "Tap the video to capture"}</div>
          </div>
        </>
      )}
    </div>
  );
}
