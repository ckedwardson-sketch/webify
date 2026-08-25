// src/components/ProgressGraphNodes.tsx
import { useTheme } from "../theme/ThemeContext";
import { ProgressCategory, ProgressDifficulty } from "../types/models";

export const PROGRESS_BASE_SIZE = 76;

// Difficulty drives size directly, same convention as dream priority —
// bigger bite of work, bigger dot on the web.
const DIFFICULTY_SCALE: Record<ProgressDifficulty, number> = {
  quick: 0.7,
  moderate: 1,
  involved: 1.3,
  major: 1.6,
};

export const DIFFICULTY_LABELS: Record<ProgressDifficulty, string> = {
  quick: "Quick",
  moderate: "Moderate",
  involved: "Involved",
  major: "Major",
};

export const CATEGORY_LABELS: Record<ProgressCategory, string> = {
  labor: "Labor",
  purchase: "Purchase",
  design: "Design",
  conceive: "Conceive",
  task: "Task",
};

export function categoryColorFor(theme: ReturnType<typeof useTheme>["theme"], category: ProgressCategory): string {
  const map: Record<ProgressCategory, string> = {
    labor: theme.progressLaborColor,
    purchase: theme.progressPurchaseColor,
    design: theme.progressDesignColor,
    conceive: theme.progressConceiveColor,
    task: theme.progressTaskColor,
  };
  return map[category] ?? theme.progressTaskColor;
}

export function progressNodeSize(difficulty: ProgressDifficulty): number {
  return PROGRESS_BASE_SIZE * (DIFFICULTY_SCALE[difficulty] ?? 1);
}

export interface ProgressNodeData {
  category: ProgressCategory;
  shortDescription: string;
  difficulty: ProgressDifficulty;
  isComplete: boolean;
  isRead: boolean;
  imageData?: string;
}

// A colored "dot": category sets the ring color (always visible, even
// once complete), difficulty sets the size, and the center shows either
// the user's short description or — once there's a completion image —
// that image instead. An unread badge and a complete checkmark sit in
// the corners so both are visible without opening the node.
export function ProgressNode({ data }: { data: ProgressNodeData }) {
  const { theme } = useTheme();
  const size = progressNodeSize(data.difficulty);
  const color = categoryColorFor(theme, data.category);
  const showImage = data.isComplete && data.imageData;

  return (
    <div
      className="progress-node"
      style={{
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: "50%",
        border: `3px solid ${color}`,
        background: showImage ? "transparent" : color,
        boxShadow: "0 4px 12px rgba(0,0,0,0.35)",
        position: "relative",
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxSizing: "border-box",
      }}
      title={data.shortDescription}
    >
      {showImage ? (
        <img
          src={data.imageData}
          alt=""
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      ) : (
        <span
          style={{
            color: "#ffffff",
            fontSize: `${Math.max(9, size * 0.13)}px`,
            fontWeight: 600,
            textAlign: "center",
            padding: "6px",
            overflow: "hidden",
            display: "-webkit-box",
            WebkitLineClamp: 3,
            WebkitBoxOrient: "vertical",
            lineHeight: 1.15,
          }}
        >
          {data.shortDescription || "Untitled"}
        </span>
      )}

      {!data.isRead && (
        <span
          className="progress-node-unread-badge"
          title="Unread"
          style={{
            position: "absolute",
            top: 2,
            right: 2,
            width: 12,
            height: 12,
            borderRadius: "50%",
            background: theme.accent,
            border: "2px solid rgba(0,0,0,0.4)",
          }}
        />
      )}

      {data.isComplete && (
        <span
          className="progress-node-complete-badge"
          title="Complete"
          style={{
            position: "absolute",
            bottom: -1,
            left: "50%",
            transform: "translateX(-50%)",
            fontSize: 11,
            lineHeight: 1,
            background: "rgba(0,0,0,0.55)",
            color: "#22c55e",
            borderRadius: "8px",
            padding: "2px 5px",
          }}
        >
          ✓
        </span>
      )}
    </div>
  );
}
