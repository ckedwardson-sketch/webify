// src/components/OutputWebNode.tsx
//
// A small card representing an Output — something actually produced by
// a Task (see db/outputs.ts). Deliberately distinct from every other
// card type on the web (amber/artifact styling, framed-picture icon)
// so it reads as "a finished thing" rather than another task/note.
// Clicking it opens the output's editor; the ✕ deletes the output
// itself (unlike NoteWebNode's ✕, which only unlinks — an Output has
// no life outside its parent task, so there's nothing to "keep").
import { GoalWebLinkHandles } from "./GoalGraphNodes";
import { useTheme } from "../theme/ThemeContext";

export interface OutputWebNodeData {
  title: string;
  onOpen: () => void;
  onDelete: () => void;
}

export function OutputWebNode({ data }: { data: OutputWebNodeData }) {
  const { theme } = useTheme();
  return (
    <div
      onClick={data.onOpen}
      style={{
        width: "150px",
        minHeight: "52px",
        borderRadius: "8px",
        border: `2px solid ${theme.outputNodeOutlineColor}`,
        background: theme.outputNodeBackground,
        color: "#fff7ed",
        padding: "8px 10px",
        boxSizing: "border-box",
        cursor: "pointer",
        boxShadow: "0 3px 8px rgba(0,0,0,0.3)",
        position: "relative",
        display: "flex",
        alignItems: "center",
        gap: "6px",
      }}
      title={data.title}
    >
      <GoalWebLinkHandles />
      <button
        onClick={(e) => {
          e.stopPropagation();
          if (confirm(`Delete output "${data.title}"? This can't be undone.`)) data.onDelete();
        }}
        title="Delete this output"
        style={{
          position: "absolute",
          top: 4,
          right: 4,
          border: "none",
          background: "rgba(0,0,0,0.3)",
          color: "#fff",
          borderRadius: "4px",
          width: 16,
          height: 16,
          lineHeight: "16px",
          fontSize: "10px",
          cursor: "pointer",
          padding: 0,
        }}
      >
        ✕
      </button>
      <span style={{ fontSize: "14px" }}>🖼</span>
      <span
        style={{
          fontSize: "12px",
          fontWeight: 600,
          overflow: "hidden",
          textOverflow: "ellipsis",
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          paddingRight: "14px",
        }}
      >
        {data.title || "Untitled"}
      </span>
    </div>
  );
}
