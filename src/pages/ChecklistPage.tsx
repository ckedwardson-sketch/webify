import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View } from "../types/nav";
import { ChecklistEditor } from "../checklist/ChecklistEditor";
import {
  archiveChecked,
  classifyLines,
  clearChecked,
  countChecked,
} from "../checklist/checklistLogic";
import {
  defaultChecklistList,
  fetchChecklistSettings,
  fetchChecklistState,
  saveChecklistState,
} from "../checklist/checklistStorage";
import { ChecklistLine, ChecklistList, ChecklistSettings, ChecklistState } from "../checklist/checklistTypes";
import { pushLockScreenNow } from "../lockscreen/lockScreenSync";
import "./ChecklistPage.css";

const SAVE_DELAY_MS = 300;

function activeListOf(state: ChecklistState): ChecklistList {
  return state.lists.find((l) => l.id === state.activeListId) ?? state.lists[0];
}

function nextListName(lists: ChecklistList[]): string {
  const taken = new Set(lists.map((l) => l.name));
  let n = lists.length + 1;
  while (taken.has(`List ${n}`)) n += 1;
  return `List ${n}`;
}

// Two-step delete, same idea as components/ConfirmDeleteIconButton: the
// first tap arms it, the second (within 3s) does it.
function TabClose({ onConfirm }: { onConfirm: () => void }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 3000);
    return () => clearTimeout(t);
  }, [armed]);
  return (
    <button
      type="button"
      className={`cl-tab-close${armed ? " armed" : ""}`}
      title={armed ? "Tap again to delete this list" : "Delete this list"}
      onClick={(e) => {
        e.stopPropagation();
        if (armed) onConfirm();
        else setArmed(true);
      }}
    >
      {armed ? "Delete?" : "×"}
    </button>
  );
}

function RenameField({ initial, onDone }: { initial: string; onDone: (name: string | null) => void }) {
  const [value, setValue] = useState(initial);
  const done = useRef(false);
  const finish = (name: string | null) => {
    if (done.current) return;
    done.current = true;
    onDone(name);
  };
  return (
    <input
      className="cl-tab-rename"
      autoFocus
      value={value}
      maxLength={40}
      onChange={(e) => setValue(e.target.value)}
      onFocus={(e) => e.currentTarget.select()}
      onBlur={() => finish(value.trim() || null)}
      onKeyDown={(e) => {
        if (e.key === "Enter") finish(value.trim() || null);
        else if (e.key === "Escape") finish(null);
      }}
    />
  );
}

// The small "picture" of a list shown in grid view — a scaled-down
// version of the list itself rather than a screenshot, so it's always
// current and costs nothing.
function ListThumbnail({ lines }: { lines: ChecklistLine[] }) {
  const infos = useMemo(() => classifyLines(lines), [lines]);
  const shown = lines.slice(0, 18);
  const empty = lines.every((l) => l.text.trim() === "");
  return (
    <div className="cl-thumb" aria-hidden="true">
      {empty ? (
        <span className="cl-thumb-empty">empty</span>
      ) : (
        shown.map((line, i) => (
          <div key={line.id} className={`cl-thumb-row${infos[i].checked && infos[i].kind !== "free" ? " done" : ""}`}>
            {line.checkbox ? (
              <span className={`cl-thumb-box${line.checked ? " on" : ""}`} />
            ) : (
              infos[i].kind === "cont" && <span className="cl-thumb-box-spacer" />
            )}
            <span className="cl-thumb-text">{line.text || "\u00a0"}</span>
          </div>
        ))
      )}
    </div>
  );
}

export function ChecklistPage({ onNavigate }: { onNavigate: (view: View) => void }) {
  const [state, setState] = useState<ChecklistState | null>(null);
  const [settings, setSettings] = useState<ChecklistSettings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [gridOpen, setGridOpen] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  // The list that was just added: its editor takes the caret on first show.
  const [autoFocusId, setAutoFocusId] = useState<string | null>(null);

  // ---- Loading / saving --------------------------------------------------

  const stateRef = useRef<ChecklistState | null>(null);
  stateRef.current = state;
  const dirty = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchChecklistState(), fetchChecklistSettings()])
      .then(([s, cfg]) => {
        if (cancelled) return;
        setState(s);
        setSettings(cfg);
      })
      .catch((err) => !cancelled && setError(`Couldn't load the checklist: ${err instanceof Error ? err.message : String(err)}`));
    return () => {
      cancelled = true;
    };
  }, []);

  const flush = useCallback(async () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    const current = stateRef.current;
    if (!dirty.current || !current) return;
    dirty.current = false;
    try {
      await saveChecklistState(current);
    } catch (err) {
      dirty.current = true;
      setError(`Couldn't save: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, []);

  // Every edit goes through here: apply it, then save shortly after the
  // typing settles.
  const update = useCallback(
    (change: (s: ChecklistState) => ChecklistState) => {
      setState((prev) => (prev ? change(prev) : prev));
      dirty.current = true;
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void flush(), SAVE_DELAY_MS);
    },
    [flush]
  );

  // Leaving the page or the app must not lose the last few keystrokes —
  // and on the phone, the lock screen should pick them up straight away.
  useEffect(() => {
    const onHidden = () => {
      if (document.visibilityState !== "hidden") return;
      void flush().then(() => pushLockScreenNow());
    };
    document.addEventListener("visibilitychange", onHidden);
    return () => {
      document.removeEventListener("visibilitychange", onHidden);
      void flush();
    };
  }, [flush]);

  // ---- Actions -----------------------------------------------------------

  const setActiveLines = useCallback(
    (lines: ChecklistLine[]) =>
      update((s) => ({ ...s, lists: s.lists.map((l) => (l.id === s.activeListId ? { ...l, lines } : l)) })),
    [update]
  );

  const clearOrArchive = () => {
    if (!settings) return;
    update((s) => {
      const list = activeListOf(s);
      if (settings.archiveMode) {
        const result = archiveChecked(list.lines, Date.now());
        if (result.removed === 0) return s;
        return {
          ...s,
          lists: s.lists.map((l) =>
            l.id === list.id ? { ...l, lines: result.lines, archive: [...result.items, ...l.archive] } : l
          ),
        };
      }
      const result = clearChecked(list.lines);
      if (result.removed === 0) return s;
      return { ...s, lists: s.lists.map((l) => (l.id === list.id ? { ...l, lines: result.lines } : l)) };
    });
  };

  const addList = () => {
    const current = stateRef.current;
    if (!current) return;
    const list = defaultChecklistList(nextListName(current.lists));
    setGridOpen(false);
    setRenamingId(null);
    setAutoFocusId(list.id);
    update((s) => ({ ...s, lists: [...s.lists, list], activeListId: list.id }));
  };

  const switchList = (id: string) => {
    setGridOpen(false);
    setRenamingId(null);
    setAutoFocusId(null);
    update((s) => (s.activeListId === id ? s : { ...s, activeListId: id }));
  };

  const renameList = (id: string, name: string) =>
    update((s) => ({ ...s, lists: s.lists.map((l) => (l.id === id ? { ...l, name } : l)) }));

  const deleteList = (id: string) =>
    update((s) => {
      if (s.lists.length <= 1) return s;
      const index = s.lists.findIndex((l) => l.id === id);
      const lists = s.lists.filter((l) => l.id !== id);
      const activeListId =
        s.activeListId === id ? lists[Math.min(Math.max(index - 1, 0), lists.length - 1)].id : s.activeListId;
      return { ...s, lists, activeListId };
    });

  // ---- Render ------------------------------------------------------------

  if (error && (!state || !settings)) {
    return (
      <div className="checklist-page">
        <p className="cl-error">{error}</p>
      </div>
    );
  }
  if (!state || !settings) {
    return (
      <div className="checklist-page">
        <p className="page-text">Loading…</p>
      </div>
    );
  }

  const active = activeListOf(state);
  const checkedCount = countChecked(active.lines);
  const showGrid = settings.multiList && gridOpen;
  const clearLabel = settings.archiveMode ? "Send checked to bottom" : "Clear checked items";

  return (
    <div className="checklist-page">
      <div className="cl-topbar">
        <div className="cl-topbar-left">
          {settings.multiList && (
            <button
              type="button"
              className={`cl-btn cl-gridbtn${gridOpen ? " active" : ""}`}
              aria-pressed={gridOpen}
              title={gridOpen ? "Back to the list" : "Grid view — see all your lists at once"}
              onClick={() => setGridOpen((v) => !v)}
            >
              ▦
            </button>
          )}
          {settings.multiList && (
            <div className="cl-tabs" role="tablist" aria-label="Lists">
              {state.lists.map((list) => {
                const isActive = list.id === active.id;
                return (
                  <div key={list.id} role="tab" aria-selected={isActive} className={`cl-tab${isActive ? " active" : ""}`}>
                    {renamingId === list.id ? (
                      <RenameField
                        initial={list.name}
                        onDone={(name) => {
                          setRenamingId(null);
                          if (name) renameList(list.id, name);
                        }}
                      />
                    ) : (
                      <button
                        type="button"
                        className="cl-tab-name"
                        title={isActive ? "Tap again to rename" : undefined}
                        onClick={() => (isActive && !gridOpen ? setRenamingId(list.id) : switchList(list.id))}
                      >
                        {list.name}
                      </button>
                    )}
                    {isActive && state.lists.length > 1 && <TabClose onConfirm={() => deleteList(list.id)} />}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="cl-topbar-right">
          {settings.multiList && (
            <button type="button" className="cl-btn cl-newlist" title="Add a new list" onClick={addList}>
              ＋ New list
            </button>
          )}
          <button
            type="button"
            className="cl-btn cl-clear"
            disabled={checkedCount === 0 || showGrid}
            title={checkedCount === 0 ? "Tick some tasks first" : `${checkedCount} checked`}
            onClick={clearOrArchive}
          >
            {clearLabel}
          </button>
          <button
            type="button"
            className="cl-btn cl-settings"
            aria-label="Settings"
            title="Settings"
            onClick={() => onNavigate({ type: "checklist-settings" })}
          >
            ⚙ <span className="cl-settings-label">Settings</span>
          </button>
        </div>
      </div>

      {error && <p className="cl-error">{error}</p>}

      {showGrid ? (
        <div className="cl-grid" aria-label="All lists">
          {state.lists.map((list) => (
            <button
              key={list.id}
              type="button"
              className={`cl-card${list.id === active.id ? " active" : ""}`}
              onClick={() => switchList(list.id)}
            >
              <ListThumbnail lines={list.lines} />
              <span className="cl-card-name">{list.name}</span>
            </button>
          ))}
        </div>
      ) : (
        <ChecklistEditor
          key={active.id}
          lines={active.lines}
          archive={active.archive}
          settings={settings}
          onLinesChange={setActiveLines}
          autoFocus={autoFocusId === active.id}
        />
      )}
    </div>
  );
}
