import { useEffect, useRef, useState } from "react";
import { PathEntry } from "../nav/navHistory";
import { View } from "../types/nav";
import "./NavHistoryBar.css";

interface NavHistoryBarProps {
  path: PathEntry[];
  onJump: (view: View) => void;
}

// The "user path" bar — a running trail of pages actually visited, as
// opposed to Breadcrumb.tsx's per-page entity ancestry. App.tsx compacts
// the trail when the user doubles back onto an earlier entry and resets it
// when the sidebar is used to jump sections (see App.tsx's navigate()).
// This component just renders whatever trail it's handed, plus the
// overflow scroll/fade treatment for when it gets long.
export function NavHistoryBar({ path, onJump }: NavHistoryBarProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [fadeLeft, setFadeLeft] = useState(false);
  const [fadeRight, setFadeRight] = useState(false);

  const updateFades = () => {
    const el = scrollRef.current;
    if (!el) return;
    setFadeLeft(el.scrollLeft > 4);
    setFadeRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  };

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    // New entry (or a jump) lands — keep the newest page in view without
    // moving the bar itself, i.e. scroll the trail, not the page.
    el.scrollLeft = el.scrollWidth;
    updateFades();
  }, [path]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onResize = () => updateFades();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  if (path.length <= 1) return null;

  return (
    <div className={`nav-history-bar${fadeLeft ? " fade-left" : ""}${fadeRight ? " fade-right" : ""}`}>
      <div className="nav-history-scroll" ref={scrollRef} onScroll={updateFades}>
        {path.map((entry, i) => {
          const isCurrent = i === path.length - 1;
          return (
            <span key={entry.key} className="nav-history-segment">
              {isCurrent ? (
                <span className="nav-history-current">{entry.label}</span>
              ) : (
                <button className="nav-history-link" onClick={() => onJump(entry.view)}>
                  {entry.label}
                </button>
              )}
              {!isCurrent && <span className="nav-history-sep">›</span>}
            </span>
          );
        })}
      </div>
    </div>
  );
}
