import { useEffect, useState } from "react";
import { useReactFlow } from "@xyflow/react";
import "./WebControls.css";

// Replaces React Flow's default <Controls/> (a hardcoded white panel,
// bottom-left, with a "lock" button that toggles node/edge
// interactivity — the "weird white thing" and "lock button" the
// canvases were built with) with a themed panel flush in the corner:
// zoom in/out, a bigger and more obvious "Fit view" button, and a
// fullscreen toggle in place of the interactivity lock, which nobody
// was using and just added a confusing extra state to canvases that are
// otherwise always interactive.
export function WebControls() {
  const { zoomIn, zoomOut, fitView } = useReactFlow();
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      document.documentElement.requestFullscreen().catch(() => {});
    }
  };

  return (
    <div className="web-controls">
      <button className="web-controls-button" onClick={() => zoomIn({ duration: 150 })} title="Zoom in">
        +
      </button>
      <button className="web-controls-button" onClick={() => zoomOut({ duration: 150 })} title="Zoom out">
        −
      </button>
      <button
        className="web-controls-button web-controls-fit"
        onClick={() => fitView({ duration: 300 })}
        title="Fit everything in view"
      >
        ⛶ Fit
      </button>
      <button
        className="web-controls-button"
        onClick={toggleFullscreen}
        title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
      >
        {isFullscreen ? "⤡" : "⤢"}
      </button>
    </div>
  );
}
