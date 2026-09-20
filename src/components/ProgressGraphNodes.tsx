// src/components/ProgressGraphNodes.tsx
import { useTheme } from "../theme/ThemeContext";
import { ProgressCategory, ProgressDifficulty } from "../types/models";
import { CardAngleRing } from "./DreamGraphNodes";
import "../pages/GoalWebPage.css";

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

// A task can be checked off as multiple labor types at once now, so its
// node background is split accordingly instead of one flat color: two
// categories split the circle straight down the middle, three into
// thirds, four into quadrants — an even conic-gradient pie handles all
// of those with the same formula. Single-category tasks (the common
// case) stay a flat fill.
export function categoryBackgroundFor(theme: ReturnType<typeof useTheme>["theme"], categories: ProgressCategory[]): string {
  const colors = categories.map((c) => categoryColorFor(theme, c));
  if (colors.length <= 1) return colors[0] ?? theme.progressTaskColor;
  const step = 100 / colors.length;
  const stops = colors.map((c, i) => `${c} ${i * step}% ${(i + 1) * step}%`);
  return `conic-gradient(${stops.join(", ")})`;
}

export function progressNodeSize(difficulty: ProgressDifficulty): number {
  return PROGRESS_BASE_SIZE * (DIFFICULTY_SCALE[difficulty] ?? 1);
}

export interface ProgressNodeData {
  categories: ProgressCategory[];
  shortDescription: string;
  difficulty: ProgressDifficulty;
  isComplete: boolean;
  isRead: boolean;
  imageData?: string;
  // Optional — only rendered when set, never forced onto every node.
  cost?: number | null;
  // "Looks" section of NodeFieldVisibilityPopover (see GoalWebPage.tsx's
  // ctrl+click on a task) — a percentage scale on top of whatever size
  // difficulty already gives the dot, and a favorite glow outline.
  webScale?: number | null;
  favorite?: boolean;
  glowAmount?: number | null;
  glowColor?: string | null;
}

const DEFAULT_GLOW_AMOUNT = 50;
const DEFAULT_GLOW_COLOR = "#facc15";

// A colored "dot": category sets the ring color (always visible, even
// once complete), difficulty sets the size, and the center shows either
// the user's short description or — once there's a completion image —
// that image instead. An unread badge and a complete checkmark sit in
// the corners so both are visible without opening the node.
export function ProgressNode({ data }: { data: ProgressNodeData }) {
  const { theme } = useTheme();
  const baseSize = progressNodeSize(data.difficulty);
  const scale = (data.webScale ?? 100) / 100;
  const size = baseSize * scale;
  const background = categoryBackgroundFor(theme, data.categories);
  const borderColor = categoryColorFor(theme, data.categories[0] ?? "task");
  const showImage = data.isComplete && data.imageData;
  const glowAmount = data.glowAmount ?? DEFAULT_GLOW_AMOUNT;
  const glowColor = data.glowColor ?? DEFAULT_GLOW_COLOR;
  const glowShadow = data.favorite
    ? `, 0 0 ${glowAmount * 0.3}px ${glowAmount * 0.15}px ${glowColor}, 0 0 ${glowAmount * 0.6}px ${glowAmount * 0.3}px ${glowColor}`
    : "";

  return (
    <div
      className="progress-node"
      style={{
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: "50%",
        border: `3px solid ${borderColor}`,
        background: showImage ? "transparent" : background,
        boxShadow: `0 4px 12px rgba(0,0,0,0.35)${glowShadow}`,
        position: "relative",
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxSizing: "border-box",
      }}
      title={data.shortDescription}
    >
      {/* Same 32-point ring convention as GoalGraphNodes.tsx's cards
          (see DreamGraphNodes.tsx's CardAngleRing) — approximated
          against the node's square bounding box since there's no
          "circle" shape in the boundary-math table, close enough for a
          small round node. Harmless when this component renders
          outside the Goal/Dream Web (no drag ever originates there). */}
      <CardAngleRing />
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

      {data.cost != null && (
        <span
          className="progress-node-cost-badge"
          title={`Cost: $${data.cost.toFixed(2)}`}
          style={{
            position: "absolute",
            top: 2,
            left: 2,
            fontSize: 9,
            lineHeight: 1,
            background: "rgba(0,0,0,0.55)",
            color: "#facc15",
            borderRadius: "8px",
            padding: "2px 4px",
            fontWeight: 700,
          }}
        >
          ${data.cost.toFixed(0)}
        </span>
      )}
    </div>
  );
}
