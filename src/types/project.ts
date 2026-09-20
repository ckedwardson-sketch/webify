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
  // Dragged offset from this project card's automatic grid slot on its
  // goal's web (see webGraph/goalCluster.ts) — null = sits exactly at
  // the grid slot.
  webPosX: number | null;
  webPosY: number | null;
  sortOrder: number;
  createdAt?: string;
  updatedAt?: string;
  // Cover image shown as a thumbnail in pane/icon-grid view and list-
  // image-left mode — same convention as recipes.imageData. undefined/""
  // = no cover, falls back to the initial-letter placeholder.
  imageData?: string;
  // "Looks" section of the Goal Web's ctrl-click NodeFieldVisibilityPopover
  // — null = 100% (the card's normal 180px width).
  webCardScale: number | null;
  // Same popover's accent color override for this project's Goal Web
  // card — null = use the theme's goalProjectNodeBackground.
  webCardColor: string | null;
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
  // Vertical counterpart to posX — only used for a goal with no
  // goal_dream_links (nothing to compute a position under), so it can
  // still be placed and dragged on the Dream Web as a standalone node.
  posY: number | null;
  // Dream-side anchor angle for this goal's dashed attachment edge,
  // once re-dragged — null means "auto-compute, point at the goal."
  dreamAttachAngle: number | null;
  // Multiplier on this goal's own cluster layout (projects/tasks/
  // responsibilities spacing) — null means 1x. Shared by GoalWebPage and
  // DreamWebPage's "full" view via webGraph/goalCluster.ts.
  webScale: number | null;
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
  // Cover image — same convention as Project.imageData.
  imageData?: string;
}

export type ProjectWidgetType = "journal" | "linkboard" | "table" | "photo" | "dock" | "costlog" | "calculator" | "mastercostlog";

// A collection of other Cost Log widgets (from anywhere in the app)
// aggregated together, with the option to group some of them under a
// named label — e.g. "Materials" grouping a handful of per-purchase
// cost logs so their total shows as one line rather than several. Owned
// by exactly one Master Cost Log widget. See db/costLog.ts's
// fetchCostGroupings/createCostGrouping and components/
// MasterCostLogWidget.tsx.
export interface CostGrouping {
  id: number;
  masterWidgetId: number;
  name: string;
  sortOrder: number;
}

// One Cost Log widget included in a Master Cost Log's totals — ungrouped
// (groupingId null) counts toward the master's overall total only;
// grouped ones also count toward their grouping's subtotal. A given
// source widget can only be added once per master (enforced by a unique
// index — see database.ts's create_cost_grouping_tables migration).
export interface MasterCostLogSource {
  id: number;
  masterWidgetId: number;
  costLogWidgetId: number;
  // Null = ungrouped (counts only toward the master's overall total).
  groupingId: number | null;
}

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
  // Set instead of projectId/goalId when this row is a free-floating
  // widget placed directly on a Goal Web or Dream Web canvas (see
  // components/WebWidgetNode.tsx) rather than living in a project's/
  // goal's detail-page widget grid — null for every grid widget.
  webType?: "goal" | "dream" | null;
  webOwnerId?: number | null;
  posX?: number | null;
  posY?: number | null;
  width?: number | null;
  height?: number | null;
  // Only meaningful for widgetType "dock" — true (the default) shows the
  // dock's actual photos inline on a Web card instead of a small emoji
  // button that opens an overlay. See db/projects.ts's mapWidgetRow.
  dockBigDisplay: boolean;
}

// A purely visual grouping rectangle on a Goal Web or Dream Web canvas
// — see components/PaneNode.tsx. Same "goal"/"dream" + owner id
// convention as ProjectWidget's web columns, but panes are never grid
// widgets, so webType/webOwnerId are always set (not optional).
export interface Pane {
  id: number;
  webType: "goal" | "dream";
  webOwnerId: number;
  title: string;
  color: string;
  opacity: number;
  posX: number;
  posY: number;
  width: number;
  height: number;
  isFront: boolean;
  // Header label styling — headerColor null = the theme's default text color.
  headerFontSize: number;
  headerColor: string | null;
  // Pins this one pane against mouse dragging regardless of the
  // canvas-wide node lock (see context/WebNodeLockContext.tsx).
  locked: boolean;
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

// One logged expense within a Cost Log widget — see
// components/CostLogWidget.tsx.
export interface CostEntry {
  id: number;
  widgetId: number;
  amount: number;
  description: string;
  createdAt: string;
}
