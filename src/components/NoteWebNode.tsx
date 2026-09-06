// src/components/NoteWebNode.tsx
//
// A small card representing an existing Notes page attached to a Goal
// Web or Dream Web canvas — a reference, not a copy. Clicking it
// navigates to the note itself; the ✕ only removes this attachment
// (note_web_links row), never the underlying note.
import { GoalWebLinkHandles } from "./GoalGraphNodes";
import { useTheme } from "../theme/ThemeContext";

export interface NoteWebNodeData {
  title: string;
  onRemove: () => void;
}

export function NoteWebNode({ data }: { data: NoteWebNodeData }) {
  const { theme } = useTheme();
  return (
    <div
      style={{
        width: "160px",
        minHeight: "56px",
        borderRadius: "10px",
        border: `2px solid ${theme.noteNodeOutlineColor}`,
        background: theme.noteNodeBackground,
        color: "#ffffff",
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
          data.onRemove();
        }}
        title="Remove from this web (keeps the note itself)"
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
      <span style={{ fontSize: "14px" }}>📝</span>
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
