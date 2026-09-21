import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  backspaceAtStart,
  classifyLines,
  deleteAtEnd,
  EditResult,
  LineKind,
  pasteIntoLine,
  setChecked,
  splitLine,
  typeInLine,
} from "./checklistLogic";
import { formatArchiveDate } from "./checklistFormat";
import { ArchivedItem, ChecklistLine, ChecklistSettings } from "./checklistTypes";
import "./ChecklistEditor.css";

// The "big text field". Under the hood it's one auto-growing <textarea>
// per line (with a checkbox in front of the lines that have one) rather
// than a single contentEditable: soft keyboards on Android are far more
// predictable with real form fields, and Enter/Backspace need to be
// intercepted per line anyway. All the actual rules live in
// checklistLogic.ts — this file only wires DOM events to them.

interface EditorProps {
  lines: ChecklistLine[];
  archive: ArchivedItem[];
  settings: ChecklistSettings;
  onLinesChange: (lines: ChecklistLine[]) => void;
  // Put the caret in the first line when the editor first appears (used
  // right after a new list is added).
  autoFocus?: boolean;
}

interface RowHandlers {
  onText: (id: string, text: string) => void;
  onToggle: (id: string, checked: boolean) => void;
  onEnter: (id: string, caret: number, soft: boolean) => void;
  onBackspaceAtStart: (id: string) => void;
  onDeleteAtEnd: (id: string) => void;
  onArrow: (id: string, dir: -1 | 1) => void;
  onPaste: (id: string, start: number, end: number, text: string) => void;
  register: (id: string, el: HTMLTextAreaElement | null) => void;
}

interface RowProps extends RowHandlers {
  line: ChecklistLine;
  kind: LineKind;
  // Whether the task this line belongs to is ticked. Primitives (not a
  // LineInfo object) so memo() can tell an untouched row from a changed one.
  blockChecked: boolean;
  // Changes when the editor's width changes, so wrapped lines re-measure.
  layoutTick: number;
}

const LineRow = memo(function LineRow({ line, kind, blockChecked, layoutTick, ...handlers }: RowProps) {
  const ref = useRef<HTMLTextAreaElement | null>(null);
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;
  const idRef = useRef(line.id);
  idRef.current = line.id;

  // Grow with the text.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [line.text, layoutTick]);

  // Android's soft keyboard often reports keydown as "Unidentified" (key
  // code 229), so Enter/Backspace can't be caught there. `beforeinput`
  // carries the same intent reliably. On desktop keydown handles the key
  // first and calls preventDefault, so this never fires twice.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onBeforeInput = (ev: Event) => {
      const e = ev as InputEvent;
      if (e.isComposing) return;
      if (e.inputType === "insertLineBreak" || e.inputType === "insertParagraph") {
        e.preventDefault();
        handlersRef.current.onEnter(idRef.current, el.selectionStart ?? el.value.length, false);
      } else if (e.inputType === "deleteContentBackward" && el.selectionStart === 0 && el.selectionEnd === 0) {
        e.preventDefault();
        handlersRef.current.onBackspaceAtStart(idRef.current);
      }
    };
    el.addEventListener("beforeinput", onBeforeInput);
    return () => el.removeEventListener("beforeinput", onBeforeInput);
  }, []);

  const setRef = useCallback(
    (el: HTMLTextAreaElement | null) => {
      ref.current = el;
      handlersRef.current.register(idRef.current, el);
    },
    []
  );

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.nativeEvent.isComposing || e.keyCode === 229) return;
    const el = e.currentTarget;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const collapsed = start === end;
    if (e.key === "Enter") {
      e.preventDefault();
      handlers.onEnter(line.id, start, e.shiftKey);
    } else if (e.key === "Backspace" && collapsed && start === 0) {
      e.preventDefault();
      handlers.onBackspaceAtStart(line.id);
    } else if (e.key === "Delete" && collapsed && start === el.value.length) {
      e.preventDefault();
      handlers.onDeleteAtEnd(line.id);
    } else if (e.key === "ArrowUp" && collapsed && start === 0 && !e.shiftKey) {
      e.preventDefault();
      handlers.onArrow(line.id, -1);
    } else if (e.key === "ArrowDown" && collapsed && start === el.value.length && !e.shiftKey) {
      e.preventDefault();
      handlers.onArrow(line.id, 1);
    }
  };

  const onPaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const text = e.clipboardData.getData("text");
    if (!/[\r\n]/.test(text)) return; // single-line paste: let the browser do it
    e.preventDefault();
    const el = e.currentTarget;
    handlers.onPaste(line.id, el.selectionStart, el.selectionEnd, text);
  };

  const struck = blockChecked && kind !== "free";
  return (
    <div className={`cl-row cl-${kind}${struck ? " is-checked" : ""}`}>
      {line.checkbox ? (
        <input
          className="cl-box"
          type="checkbox"
          checked={line.checked}
          aria-label="Done"
          onChange={(e) => handlers.onToggle(line.id, e.target.checked)}
        />
      ) : (
        kind === "cont" && <span className="cl-box-spacer" aria-hidden="true" />
      )}
      <textarea
        ref={setRef}
        className="cl-input"
        rows={1}
        value={line.text}
        spellCheck
        autoCapitalize="sentences"
        enterKeyHint="next"
        onChange={(e) => handlers.onText(line.id, e.target.value)}
        onKeyDown={onKeyDown}
        onPaste={onPaste}
      />
    </div>
  );
});

export function ChecklistEditor({ lines, archive, settings, onLinesChange, autoFocus }: EditorProps) {
  const inputs = useRef(new Map<string, HTMLTextAreaElement>());
  const pendingFocus = useRef<{ id: string; caret: number } | null>(null);
  const linesRef = useRef(lines);
  linesRef.current = lines;
  const rootRef = useRef<HTMLDivElement>(null);
  const [layoutTick, setLayoutTick] = useState(0);

  const infos = useMemo(() => classifyLines(lines), [lines]);

  // Wrapped lines change height when the editor's width does.
  useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    let frame = 0;
    let lastWidth = el.clientWidth;
    const observer = new ResizeObserver(() => {
      if (el.clientWidth === lastWidth) return;
      lastWidth = el.clientWidth;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setLayoutTick((t) => t + 1));
    });
    observer.observe(el);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, []);

  // A text-size change re-wraps everything too.
  useLayoutEffect(() => {
    setLayoutTick((t) => t + 1);
  }, [settings.textSize]);

  // Applies a caret request made by the last edit, once the lines it
  // refers to exist in the DOM.
  useLayoutEffect(() => {
    const f = pendingFocus.current;
    if (!f) return;
    const el = inputs.current.get(f.id);
    if (!el) return;
    pendingFocus.current = null;
    el.focus();
    el.setSelectionRange(f.caret, f.caret);
  });

  useEffect(() => {
    if (!autoFocus) return;
    const first = linesRef.current[0];
    const el = first && inputs.current.get(first.id);
    if (el) {
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
    }
    // Once, on mount — switching tabs later must not pop the keyboard.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const commit = useCallback(
    (result: EditResult | null) => {
      if (!result) return;
      if (result.focus) pendingFocus.current = result.focus;
      onLinesChange(result.lines);
    },
    [onLinesChange]
  );

  const indexOf = (id: string) => linesRef.current.findIndex((l) => l.id === id);

  const handlers = useMemo<RowHandlers>(
    () => ({
      onText: (id, text) => {
        const i = indexOf(id);
        if (i >= 0) commit(typeInLine(linesRef.current, i, text, Date.now()));
      },
      onToggle: (id, checked) => onLinesChange(setChecked(linesRef.current, id, checked, Date.now())),
      onEnter: (id, caret, soft) => {
        const i = indexOf(id);
        if (i >= 0) commit(splitLine(linesRef.current, i, caret, soft));
      },
      onBackspaceAtStart: (id) => {
        const i = indexOf(id);
        if (i >= 0) commit(backspaceAtStart(linesRef.current, i));
      },
      onDeleteAtEnd: (id) => {
        const i = indexOf(id);
        if (i >= 0) commit(deleteAtEnd(linesRef.current, i));
      },
      onArrow: (id, dir) => {
        const i = indexOf(id);
        const target = linesRef.current[i + dir];
        if (!target) return;
        const el = inputs.current.get(target.id);
        if (!el) return;
        el.focus();
        const caret = dir < 0 ? el.value.length : 0;
        el.setSelectionRange(caret, caret);
      },
      onPaste: (id, start, end, text) => {
        const i = indexOf(id);
        if (i >= 0) commit(pasteIntoLine(linesRef.current, i, start, end, text, Date.now()));
      },
      register: (id, el) => {
        if (el) inputs.current.set(id, el);
        else inputs.current.delete(id);
      },
    }),
    // indexOf only reads refs; commit/onLinesChange are the real inputs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [commit, onLinesChange]
  );

  // Tapping the empty space under the last line puts the caret there,
  // like clicking below the text in any text field.
  const onBackgroundClick = (e: React.MouseEvent) => {
    if (e.target !== e.currentTarget) return;
    const last = linesRef.current[linesRef.current.length - 1];
    const el = last && inputs.current.get(last.id);
    if (el) {
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
    }
  };

  const showArchive = settings.archiveMode && archive.length > 0;

  return (
    <div
      ref={rootRef}
      className="cl-editor"
      style={{ ["--cl-font-size" as string]: `${settings.textSize}px` }}
      onClick={onBackgroundClick}
    >
      {lines.map((line, i) => (
        <LineRow
          key={line.id}
          line={line}
          kind={infos[i].kind}
          blockChecked={infos[i].checked}
          layoutTick={layoutTick}
          {...handlers}
        />
      ))}

      {showArchive && (
        <>
          <div className="cl-archive-gap" aria-hidden="true" />
          <div className="cl-archive" aria-label="Archived tasks">
            {archive.map((item) => (
              <div className="cl-arow" key={item.id}>
                <input className="cl-box" type="checkbox" checked readOnly disabled aria-label="Archived" />
                <span className="cl-atext">{item.text}</span>
                {settings.showDate && (
                  <span className="cl-adate">{formatArchiveDate(item.checkedAt, settings.dateFormat)}</span>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
