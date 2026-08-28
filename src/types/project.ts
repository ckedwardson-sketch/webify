export interface Project {
  id: number;
  // Optional — a project can just exist on its own; linking it to a
  // dream is never required or automatic.
  dreamId: number | null;
  // Optional — same idea as dreamId, one layer up. A project linked to
  // a goal auto-appears as a node on that goal's Goal Web.
  goalId: number | null;
  name: string;
  goals: string;
  reasoning: string;
  needsDoing: string;
  // A rough single-day guess at when work begins — distinct from
  // expectedDateStart/End below, which is the target/done-by range.
  estimatedStartDate?: string;
  expectedDateStart?: string;
  expectedDateEnd?: string;
  sortOrder: number;
  createdAt?: string;
  updatedAt?: string;
}

// One layer above projects — same shape, same optional dream link.
export interface Goal {
  id: number;
  dreamId: number | null;
  name: string;
  goals: string;
  reasoning: string;
  needsDoing: string;
  // Horizontal position on the Dream Web, once dragged there — null
  // until then, meaning "use the computed position under its parent
  // dream." See db/database.ts's add_goals_pos_x migration.
  posX: number | null;
  // Dream-side anchor angle for this goal's dashed attachment edge,
  // once re-dragged — null means "auto-compute, point at the goal."
  dreamAttachAngle: number | null;
  // "Passion projects" are goals shown on the Projects page instead of
  // the Goals page — see ProjectsHomePage.tsx. Everything else about
  // them (fields, widgets, Goal Web) is identical to a regular goal.
  isPassionProject: boolean;
  estimatedStartDate?: string;
  expectedDateStart?: string;
  expectedDateEnd?: string;
  sortOrder: number;
  createdAt?: string;
  updatedAt?: string;
}

export type ProjectWidgetType = "journal" | "linkboard" | "table" | "photo" | "dock";

// Belongs to exactly one of a project or a goal — never both, never
// neither. Whichever owner fetched it already knows which one it is, so
// callers don't need to branch on this to use fetchJournalEntries /
// fetchBoardItems / deleteWidget, which only ever key off widgetId.
export interface ProjectWidget {
  id: number;
  projectId: number | null;
  goalId: number | null;
  widgetType: ProjectWidgetType;
  title: string;
  sortOrder: number;
  createdAt?: string;
}

export interface ProjectJournalEntry {
  id: number;
  widgetId: number;
  content: string;
  createdAt: string;
}

export type ProjectBoardItemType = "text" | "link" | "image";

export interface ProjectBoardItem {
  id: number;
  widgetId: number;
  itemType: ProjectBoardItemType;
  textContent?: string;
  linkHref?: string;
  linkLabel?: string;
  imageData?: string;
  sortOrder: number;
  createdAt?: string;
}

// A plain grid, no formulas/math — one JSON blob per widget rather than
// one DB row per cell, since there's no relational/query need for
// individual cells. See db/tables.ts.
export interface ProjectTableData {
  columns: string[];
  rows: string[][];
  // Pixel width per column, same order as `columns` — optional/sparse
  // (a column with no stored width just uses the CSS default) so old
  // tables saved before resizing existed don't need a migration.
  columnWidths?: number[];
}

export type PhotoDisplayMode = "camera" | "slideshow" | "carddeck";
export type PhotoOrientation = "portrait" | "landscape";

// Per-widget settings for the Quick Photo widget — see
// components/QuickPhotoWidget.tsx.
export interface PhotoWidgetSettings {
  displayMode: PhotoDisplayMode;
  slideshowIntervalSeconds: number;
  // 0 = don't auto-advance, only advance when a card is clicked.
  carddeckIntervalSeconds: number;
  // Only meaningful for slideshow/carddeck — camera view's orientation
  // is changed live from within the widget itself, not here.
  orientation: PhotoOrientation;
  // Which camera slideshow/carddeck's "click anywhere to capture" uses
  // (they don't keep a live preview open, so there's no on-the-fly flip
  // button like camera-view has — this is the only way to pick for
  // them). Camera view ignores this; it has its own live flip toggle.
  preferredCamera: "front" | "rear";
  // If true, capturing a photo opens a small note field before saving
  // instead of saving instantly.
  askForCaption: boolean;
  captureLocation: boolean;
}

export interface PhotoEntry {
  id: number;
  widgetId: number;
  imageData: string;
  caption?: string;
  latitude?: number;
  longitude?: number;
  takenAt: string;
  sortOrder: number;
}

// One freely-positioned image within an Image Dock widget — percent
// coordinates (of the dock's own box) so the layout holds up at any
// dock size. See components/ImageDockWidget.tsx.
export interface DockImage {
  id: number;
  widgetId: number;
  imageData: string;
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
}
