// src/pages/DreamWebPage.tsx
import React, { Dispatch, SetStateAction, useEffect, useMemo, useRef, useState } from "react";
import { htmlToPlainText } from "../utils/richText";
import {
  ReactFlow,
  ReactFlowProvider,
  Node,
  Edge,
  Connection,
  NodeChange,
  Background,
  Panel,
  ViewportPortal,
  ConnectionMode,
  ConnectionLineType,
  Viewport,
  applyNodeChanges,
  useViewport,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  fetchDreamGraphData,
  addDream,
  updateDreamPosition,
  updateDreamPositionX,
  addDreamLink,
  removeDreamLink,
} from "../db/dreams";
import { fetchAllGoals, updateGoalWebPosition } from "../db/goals";
import {
  fetchAllGoalDreamLinks,
  addOrUpdateGoalDreamLink,
  removeGoalDreamLink,
  updateGoalDreamLinkPosX,
  updateGoalDreamLinkAngle,
  GoalDreamLink,
} from "../db/goalDreamLinks";
import { fetchViewport, saveViewport } from "../db/viewports";
import { fetchFieldLayout, fetchFreetextFields, updateFieldStyle, FieldLayoutRow, FieldStylePatch, FreetextField } from "../db/fieldLayout";
import { buildNodeCardTextItems } from "../theme/nodeCardFields";
import { mergeFieldStylePatch } from "../rearrange/fieldStyle";
import { NodeFieldVisibilityPopover } from "../components/NodeFieldVisibilityPopover";
import { Dream, DreamLink, DreamPriority, ProgressNode as ProgressNodeModel } from "../types/models";
import { Goal, Project, ProjectWidget, ProjectWidgetType, Pane } from "../types/project";
import { NodeWidgetOverlay } from "../components/NodeWidgetOverlay";
import { Responsibility, ResponsibilityCompletion } from "../types/responsibility";
import {
  DreamNode,
  DREAM_BASE_WIDTH,
  DREAM_BASE_HEIGHT,
  zoomCompensation,
  PRIORITY_SCALE,
  DreamGoalNode,
  GOAL_NODE_WIDTH,
  GOAL_NODE_HEIGHT,
  SkillDreamNode,
  SKILL_NODE_WIDTH,
  SKILL_NODE_HEIGHT,
  AngleEdge,
  AngleEdgeData,
  anchorPoint,
  parseAngleHandleId,
  snapToAnchor,
} from "../components/DreamGraphNodes";
import { GoalSummaryNode, ProjectCardNode, ResponsibilityCardNode, ResponsibilityCardData } from "../components/GoalGraphNodes";
import { ProgressNode as ProgressNodeView } from "../components/ProgressGraphNodes";
import { computeGoalCluster, GoalClusterLayout, nodeBoxFor } from "../webGraph/goalCluster";
import { fetchProjectsForGoal, updateProjectGoalId } from "../db/projects";
import { fetchProgressNodesForGoal, fetchProgressNodesForProjectsOfGoal, updateProgressPosition } from "../db/progress";
import { fetchResponsibilitiesForGoal, fetchAllCompletions, unlinkResponsibilityFromGoal } from "../db/responsibilities";
import { consistencyPercent, daysPerWeek as daysPerWeekFor } from "../responsibilities/scheduling";
import { fetchGoalWebLinksForGoals, GoalWebLink } from "../db/goalWebLinks";
import { fetchDreamWebLinks, addDreamWebLink, removeDreamWebLink, DreamWebLink } from "../db/dreamWebLinks";
import {
  fetchNoteWebLinksForOwners,
  addNoteWebLink,
  removeNoteWebLink,
  updateNoteWebLinkPosition,
  fetchNotePagesForPicker,
  NoteWebLink,
  NotePickerOption,
} from "../db/noteWebLinks";
import { addPage } from "../db/notes";
import { NoteWebNode } from "../components/NoteWebNode";
import { WebWidgetNode, WEB_WIDGET_DEFAULT_WIDTH, WEB_WIDGET_DEFAULT_HEIGHT } from "../components/WebWidgetNode";
import { PaneNode, PaneNodeData } from "../components/PaneNode";
import {
  fetchWidgetsForWebOwners,
  addWebWidget,
  updateWebWidgetPosition,
  updateWebWidgetSize,
  deleteWidget,
} from "../db/projects";
import {
  fetchPanesForWebOwners,
  addPane,
  updatePanePosition,
  updatePaneSize,
  updatePaneTitle,
  updatePaneColor,
  updatePaneOpacity,
  updatePaneFront,
  updatePaneHeaderFontSize,
  updatePaneHeaderColor,
  updatePaneLocked,
  deletePane,
} from "../db/panes";
import { WIDGET_TYPE_LABELS } from "../rearrange/AddFieldMenu";
import { fetchSkillsForDreams, updateDreamSkillPosition } from "../db/skills";
import { Skill } from "../types/skill";
import { angleFromDirection } from "../theme/nodeBoundary";
import { View } from "../types/nav";
import { WebControls } from "../components/WebControls";
import { LaborLegend } from "../components/LaborLegend";
import { HintTooltip } from "../components/HintTooltip";
import { StyledButton } from "../icons/StyledButton";
import { useTheme } from "../theme/ThemeContext";
import { parseDecals } from "../theme/decals";
import { DecalLayer } from "../theme/DecalLayer";
import { usePageBackground, pageSurfaceStyle } from "../theme/PageBackgroundContext";
import { useMobileLayout } from "../theme/useMobileLayout";
import { useUiPreferences } from "../context/UiPreferencesContext";
import { useWebNodeLock } from "../context/WebNodeLockContext";
import "./Page.css";
import "./DreamWebPage.css";

const nodeTypes = {
  dreamNode: DreamNode,
  dreamGoalNode: DreamGoalNode,
  skillNode: SkillDreamNode,
  goalSummaryNode: GoalSummaryNode,
  goalProjectNode: ProjectCardNode,
  goalTaskNode: ProgressNodeView,
  goalRespNode: ResponsibilityCardNode,
  noteNode: NoteWebNode,
  widgetNode: WebWidgetNode,
  paneNode: PaneNode,
};
const edgeTypes = { angleEdge: AngleEdge };

// A goal's node id on Dream Web is either one of these (attached
// instance, keyed by the goal_dream_links row) or a standalone one
// (goal with zero links, keyed by the goal itself) — full-mode cluster
// sub-nodes are namespaced under whichever of these the cluster hangs
// off of, so the same project/task can render correctly under several
// instances if its goal is attached to more than one dream.
const standaloneGoalNodeId = (goalId: number) => `gs-${goalId}`;
const isStandaloneGoalNodeId = (id: string) => id.startsWith("gs-");
const parseStandaloneGoalNodeId = (id: string) => Number(id.slice(3));
const skillNodeId = (linkId: number) => `sk-${linkId}`;
const parseSkillNodeId = (id: string) => Number(id.slice(3));
// Notes attached directly to a dream (web_type "dream", owner_id the
// dream id) — keyed by the note_web_links row id, "dn-" so it can't
// collide with any other prefix on this canvas.
const dreamNoteNodeId = (linkId: number) => `dn-${linkId}`;
const parseDreamNoteNodeId = (id: string) => Number(id.slice(3));
const NEW_NOTE_SENTINEL = "__new__";
// Free-floating widgets (see components/WebWidgetNode.tsx) attached
// directly to a dream (web_type "dream", web_owner_id the dream id) —
// keyed by the project_widgets row id, "wg-" so it can't collide with
// any other prefix on this canvas.
const widgetNodeId = (id: number) => `wg-${id}`;
const parseWidgetNodeId = (id: string) => Number(id.slice(3));
// Purely visual grouping panes (see components/PaneNode.tsx) attached
// directly to a dream (web_type "dream", web_owner_id the dream id) —
// keyed by the web_panes row id, "pn-" so it can't collide with any
// other prefix on this canvas.
const paneNodeId = (id: number) => `pn-${id}`;
const parsePaneNodeId = (id: string) => Number(id.slice(3));

// A resize drag needs the box to visibly track the cursor every frame,
// not just jump into place on release — but routing that through the
// canonical `panes` state (and the big node-rebuild effect it drives)
// would rebuild the entire node graph on every pointer-move tick. This
// patches only the live-resizing pane's own node entry directly, the
// same "touch `nodes` during the gesture, sync canonical state only at
// the end" split position-dragging already uses (see onNodesChange).
function patchPaneSizeLive(setNodes: Dispatch<SetStateAction<Node[]>>, nodeId: string, width: number, height: number) {
  setNodes((nds) =>
    nds.map((n) =>
      n.id === nodeId
        ? { ...n, data: { ...n.data, pane: { ...(n.data as unknown as PaneNodeData).pane, width, height } } }
        : n
    )
  );
}

function rectsOverlap(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number }
): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

// Full-mode cluster sub-node ids are namespaced by their goal instance
// id (see above) plus GoalWebPage's own id scheme, joined by "::" so
// they can't collide with any other node on the canvas.
const clusterNodeId = (instanceId: string, inner: string) => `${instanceId}::${inner}`;
function parseClusterNodeId(id: string): { instanceId: string; inner: string } | null {
  const i = id.indexOf("::");
  if (i === -1) return null;
  return { instanceId: id.slice(0, i), inner: id.slice(i + 2) };
}

const UNDATED_GOAL_LANE_X = 650;

// Everything one goal owns, fetched once per unique goal id (not per
// rendered instance) when Full view is on.
interface GoalClusterData {
  goal: Goal;
  projects: Project[];
  tasks: ProgressNodeModel[];
  responsibilities: Responsibility[];
  links: GoalWebLink[];
  layout: GoalClusterLayout;
}

const dreamNodeId = (id: number) => `d-${id}`;
const parseDreamNodeId = (nodeId: string) => Number(nodeId.slice(2));
// Keyed by goal_dream_links.id (not goal id) — a goal attached to
// several dreams renders one node per link, so the link id is what's
// actually unique per rendered instance.
const goalNodeId = (linkId: number) => `g-${linkId}`;
const parseGoalNodeId = (nodeId: string) => Number(nodeId.slice(2));
const goalEdgeId = (linkId: number) => `goal-edge-${linkId}`;
const parseGoalEdgeId = (edgeId: string) => Number(edgeId.slice("goal-edge-".length));
const linkEdgeId = (id: number) => `link-${id}`;
const parseLinkEdgeId = (edgeId: string) => Number(edgeId.slice(5));

// snapToAnchor is imported from DreamGraphNodes.tsx (shared with
// GoalWebPage's own link rendering).

const GOAL_SHAPE = "rectangle";
const GOAL_SIZE = { width: GOAL_NODE_WIDTH, height: GOAL_NODE_HEIGHT };

// A goal-dream link's x is either wherever the user has dragged that
// particular attachment (link.posX), or — until then — clustered
// horizontally under the dream it's attached to. Y follows the *goal's
// own* date, same mechanism as a dated dream, when it has one; only an
// undated goal falls back to sitting just below whichever dream this
// instance is attached to. This means a dated goal can end up far from
// its parent vertically (it's tracking its own place in time, not just
// "attached to the dream visually") — the dashed edge (see edges below)
// is what keeps the parent relationship visible regardless of how far
// apart they land.
const GOAL_CLUSTER_GAP = 28;
const GOAL_CLUSTER_Y_OFFSET = DREAM_BASE_HEIGHT + 50;

function goalClusterXs(dreamX: number, count: number): number[] {
  const totalWidth = count * GOAL_NODE_WIDTH + (count - 1) * GOAL_CLUSTER_GAP;
  const startX = dreamX + DREAM_BASE_WIDTH / 2 - totalWidth / 2;
  return Array.from({ length: count }, (_, i) => startX + i * (GOAL_NODE_WIDTH + GOAL_CLUSTER_GAP));
}

function goalPositionsFor(
  dreamPos: { x: number; y: number },
  dreamLinks: GoalDreamLink[],
  goalById: Map<number, Goal>
): { x: number; y: number }[] {
  const xs = goalClusterXs(dreamPos.x, dreamLinks.length);
  return dreamLinks.map((link, i) => {
    const goal = goalById.get(link.goalId);
    return {
      x: link.posX ?? xs[i],
      // Centered on its date range's midpoint, same "subtract half the
      // box height" rule positionFor uses for a dated dream — without
      // it the node's top edge sits on the date instead of its visual
      // center.
      y: goal?.expectedDateStart
        ? rangeMidY(goal.expectedDateStart, goal.expectedDateEnd) - GOAL_NODE_HEIGHT / 2
        : dreamPos.y + GOAL_CLUSTER_Y_OFFSET,
    };
  });
}

// ---- Date <-> canvas-Y mapping ---------------------------------------
// Vertical timeline: today sits at y=0, the future runs up (negative
// y), the past runs down (positive y). A dated dream's y always comes
// from this — it isn't something you can drag around; only x is free.

const TODAY = new Date();
const EPOCH_YEAR = TODAY.getFullYear() - 5;
const END_YEAR = TODAY.getFullYear() + 10;
const TODAY_MS = new Date(TODAY.getFullYear(), TODAY.getMonth(), TODAY.getDate()).getTime();
const PIXELS_PER_DAY = 1;
const DAY_MS = 86400000;
const MONTH_ZOOM_THRESHOLD = 0.6;
const UNDATED_LANE_X = -650;

function isoToY(iso: string): number {
  const t = new Date(`${iso}T00:00:00`).getTime();
  return -((t - TODAY_MS) / DAY_MS) * PIXELS_PER_DAY;
}

function rangeMidY(start: string, end?: string): number {
  const s = isoToY(start);
  const e = end ? isoToY(end) : s;
  return (s + e) / 2;
}

interface GridLine {
  y: number;
  label: string;
  isYear: boolean;
  // The one line marking "now" — the current month, not just the
  // current year's Jan 1 — is what gets the golden highlight below.
  isCurrentMonth: boolean;
}

function buildGridLines(): GridLine[] {
  const lines: GridLine[] = [];
  const currentYear = TODAY.getFullYear();
  const currentMonth = TODAY.getMonth() + 1;
  for (let y = EPOCH_YEAR; y <= END_YEAR; y++) {
    lines.push({
      y: isoToY(`${y}-01-01`),
      label: String(y),
      isYear: true,
      isCurrentMonth: y === currentYear && currentMonth === 1,
    });
    for (let m = 2; m <= 12; m++) {
      const mm = String(m).padStart(2, "0");
      lines.push({
        y: isoToY(`${y}-${mm}-01`),
        label: new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: "short" }),
        isYear: false,
        isCurrentMonth: y === currentYear && m === currentMonth,
      });
    }
  }
  return lines;
}

function formatShortDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// A vertical "flagpole" spanning a dream's date range — flared,
// beveled caps at each end (rather than the old flat T-bar) so it
// reads as one connected piece growing out of the node's edge instead
// of a disconnected line floating beside it. Widths/lengths clamp to
// the actual bar height so a short range (a few days) doesn't turn the
// taper sections inside-out.
const RANGE_BAR_WIDTH = 5;
const RANGE_BAR_FLARE_WIDTH = 22;
const RANGE_BAR_FLARE_LENGTH = 16;
const RANGE_BAR_CAP_THICKNESS = 4;

function rangeBarPath(cx: number, yTop: number, yBottom: number): string {
  const barHalf = RANGE_BAR_WIDTH / 2;
  const flareHalf = RANGE_BAR_FLARE_WIDTH / 2;
  const flareLen = Math.max(2, Math.min(RANGE_BAR_FLARE_LENGTH, (yBottom - yTop) / 2 - 2));
  const capThick = Math.min(RANGE_BAR_CAP_THICKNESS, flareLen - 1);
  return [
    `M ${cx - flareHalf} ${yTop}`,
    `L ${cx + flareHalf} ${yTop}`,
    `L ${cx + flareHalf} ${yTop + capThick}`,
    `L ${cx + barHalf} ${yTop + flareLen}`,
    `L ${cx + barHalf} ${yBottom - flareLen}`,
    `L ${cx + flareHalf} ${yBottom - capThick}`,
    `L ${cx + flareHalf} ${yBottom}`,
    `L ${cx - flareHalf} ${yBottom}`,
    `L ${cx - flareHalf} ${yBottom - capThick}`,
    `L ${cx - barHalf} ${yBottom - flareLen}`,
    `L ${cx - barHalf} ${yTop + flareLen}`,
    `L ${cx - flareHalf} ${yTop + capThick}`,
    "Z",
  ].join(" ");
}

function nodeSizeFor(priority: DreamPriority, zoom: number): { width: number; height: number } {
  const scale = PRIORITY_SCALE[priority] * zoomCompensation(zoom);
  return { width: DREAM_BASE_WIDTH * scale, height: DREAM_BASE_HEIGHT * scale };
}

function timelineSort(a: Dream, b: Dream) {
  if (!a.expectedDateStart && !b.expectedDateStart) return a.name.localeCompare(b.name);
  if (!a.expectedDateStart) return 1;
  if (!b.expectedDateStart) return -1;
  return a.expectedDateStart.localeCompare(b.expectedDateStart);
}

function DreamWebInner({ onNavigate }: { onNavigate: (view: View) => void }) {
  const { theme } = useTheme();
  const { overrides: pageBgOverrides } = usePageBackground();
  const mobile = useMobileLayout();
  const { preferences: uiPreferences, setPreference: setUiPreference } = useUiPreferences();
  const { locked: nodesLocked } = useWebNodeLock();
  const { zoom } = useViewport();
  const decals = useMemo(() => parseDecals(theme.decals), [theme.decals]);
  const [dreams, setDreams] = useState<Dream[]>([]);
  const [links, setLinks] = useState<DreamLink[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [goalDreamLinks, setGoalDreamLinks] = useState<GoalDreamLink[]>([]);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [initialViewport, setInitialViewport] = useState<Viewport | null>(null);
  const [dreamFieldsById, setDreamFieldsById] = useState<Map<number, FieldLayoutRow[]>>(new Map());
  const [freetextById, setFreetextById] = useState<Map<number, FreetextField>>(new Map());
  const [fieldVisibilityDreamId, setFieldVisibilityDreamId] = useState<number | null>(null);
  const [dreamSkills, setDreamSkills] = useState<
    (Skill & { linkId: number; dreamId: number; posX: number | null; posY: number | null })[]
  >([]);
  const [dreamWebLinks, setDreamWebLinks] = useState<DreamWebLink[]>([]);
  // "Simple" (default) shows just dreams/goals/skills, same as before
  // this feature existed. "Full" additionally clusters every goal's
  // projects/tasks/responsibilities around it, exactly as that goal's
  // own Goal Web lays them out (see webGraph/goalCluster.ts). A plain
  // view-mode toggle, not a theme setting — persisted via the DB-backed
  // ui_preferences store (see UiPreferencesContext) rather than bare
  // localStorage, same mechanism as every other DB-backed setting.
  const fullView = uiPreferences["dreamWebFullView"] === "1";
  const [clusterDataByGoalId, setClusterDataByGoalId] = useState<Map<number, GoalClusterData>>(new Map());
  const [completions, setCompletions] = useState<ResponsibilityCompletion[]>([]);
  const [noteLinks, setNoteLinks] = useState<NoteWebLink[]>([]);
  const [notePickerOptions, setNotePickerOptions] = useState<NotePickerOption[]>([]);
  const [showNotesPanel, setShowNotesPanel] = useState(false);
  const [noteDreamChoice, setNoteDreamChoice] = useState("");
  const [noteChoice, setNoteChoice] = useState("");
  const [creatingNote, setCreatingNote] = useState(false);
  // Free-floating widgets attached directly to a dream (see
  // components/WebWidgetNode.tsx) — same picker pattern as notes above:
  // pick which dream owns it, then which widget type to add.
  const [webWidgets, setWebWidgets] = useState<ProjectWidget[]>([]);
  // A free-floating Image Dock widget's edit click opens this instead of
  // its own internal overlay — see WebWidgetNode.tsx's onEditDock.
  const [openWidget, setOpenWidget] = useState<ProjectWidget | null>(null);
  const [showWidgetsPanel, setShowWidgetsPanel] = useState(false);
  const [widgetDreamChoice, setWidgetDreamChoice] = useState("");
  const [widgetChoice, setWidgetChoice] = useState<ProjectWidgetType | "">("");
  // Purely visual grouping rectangles attached directly to a dream — see
  // components/PaneNode.tsx. Same picker pattern as widgets above: pick
  // which dream owns it, then add.
  const [panes, setPanes] = useState<Pane[]>([]);
  const [showPanesPanel, setShowPanesPanel] = useState(false);
  const [paneDreamChoice, setPaneDreamChoice] = useState("");
  const [addingPane, setAddingPane] = useState(false);
  // Ctrl+click a pane — same "Looks" popup convention as dream/goal
  // cards, just editing color/fill opacity instead of a scale percent.
  const [paneLooksTargetId, setPaneLooksTargetId] = useState<number | null>(null);

  const gridLines = useMemo(buildGridLines, []);

  const load = async () => {
    const [{ dreams, links }, goals, goalDreamLinks, viewport] = await Promise.all([
      fetchDreamGraphData(),
      fetchAllGoals(),
      fetchAllGoalDreamLinks(),
      fetchViewport("dream-web"),
    ]);
    setDreams(dreams);
    setLinks(links);
    setGoals(goals);
    setGoalDreamLinks(goalDreamLinks);
    setInitialViewport(viewport);
    setLoading(false);

    // Per-dream "show on web" field config (see FieldStylePopover.tsx) —
    // fetched for every active dream, not lazily per-node, so the node-
    // building effect below can stay a synchronous map over already-
    // loaded data.
    const activeDreams = dreams.filter((d) => !d.isAsleep);
    const fieldLists = await Promise.all(activeDreams.map((d) => fetchFieldLayout("dream", d.id)));
    setDreamFieldsById(new Map(activeDreams.map((d, i) => [d.id, fieldLists[i]])));
    const freetextIds = fieldLists.flat().filter((f) => f.fieldType === "freetext" && f.refId !== null).map((f) => f.refId!);
    setFreetextById(await fetchFreetextFields(freetextIds));

    setDreamSkills(await fetchSkillsForDreams(activeDreams.map((d) => d.id)));
    setDreamWebLinks(await fetchDreamWebLinks());
    setNoteLinks(await fetchNoteWebLinksForOwners("dream", activeDreams.map((d) => d.id)));
    setNotePickerOptions(await fetchNotePagesForPicker());
    setWebWidgets(await fetchWidgetsForWebOwners("dream", activeDreams.map((d) => d.id)));
    setPanes(await fetchPanesForWebOwners("dream", activeDreams.map((d) => d.id)));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleFullView = () => {
    setUiPreference("dreamWebFullView", fullView ? "0" : "1").catch((err) =>
      console.warn("Failed to persist dreamWebFullView preference:", err)
    );
  };

  const handleMoveEnd = (_: unknown, viewport: Viewport) => {
    saveViewport("dream-web", viewport);
  };

  const dreamById = useMemo(() => new Map(dreams.map((d) => [d.id, d])), [dreams]);

  const activeDreams = useMemo(() => dreams.filter((d) => !d.isAsleep), [dreams]);
  const sleepingDreams = useMemo(() => dreams.filter((d) => d.isAsleep), [dreams]);

  // A React Flow node's `position` is its top-left corner, but the
  // timeline (gridlines, the date-range flagpole below) is drawn against
  // each date's literal isoToY value — which is meant to line up with a
  // dated dream's visual *center*, not its top edge. Without this
  // offset, a dated node's top edge sits on its date instead of its
  // center, i.e. the whole box reads roughly half a node-height too low
  // relative to the line/flagpole marking its actual date. Uses the
  // zoom=1 reference size (same simplification anchorPoint/edges below
  // already make) rather than the live zoom-compensated size, so this
  // stays a plain function of the dream alone.
  const positionFor = (dream: Dream): { x: number; y: number } => {
    if (dream.expectedDateStart) {
      const { height } = nodeSizeFor(dream.priority, 1);
      return { x: dream.posX, y: rangeMidY(dream.expectedDateStart, dream.expectedDateEnd) - height / 2 };
    }
    return { x: dream.posX, y: dream.posY };
  };

  // A stale link (goal deleted, or is now a passion project and no
  // longer in fetchAllGoals' result) simply doesn't render — same rule
  // dreams themselves already follow (sleeping dreams are excluded from
  // the canvas entirely).
  const goalById = useMemo(() => new Map(goals.map((g) => [g.id, g])), [goals]);

  const linksByDream = useMemo(() => {
    const map = new Map<number, GoalDreamLink[]>();
    for (const link of goalDreamLinks) {
      if (!goalById.has(link.goalId)) continue;
      const list = map.get(link.dreamId) ?? [];
      list.push(link);
      map.set(link.dreamId, list);
    }
    return map;
  }, [goalDreamLinks, goalById]);

  const linkById = useMemo(() => new Map(goalDreamLinks.map((l) => [l.id, l])), [goalDreamLinks]);

  // Y for a given attachment, independent of any live drag — same rule
  // goalPositionsFor uses, factored out so onNodesChange can snap a
  // node's y back to it on every drag tick (mirroring how a dated
  // dream's y is locked below).
  const goalYFor = (link: GoalDreamLink): number => {
    const goal = goalById.get(link.goalId);
    if (goal?.expectedDateStart) return rangeMidY(goal.expectedDateStart, goal.expectedDateEnd) - GOAL_NODE_HEIGHT / 2;
    const dream = dreamById.get(link.dreamId);
    return (dream ? positionFor(dream).y : 0) + GOAL_CLUSTER_Y_OFFSET;
  };

  // Computed once here and reused by both the node-building effect and
  // the edges useMemo below, rather than each recomputing it separately
  // — recomputing goalPositionsFor with just one link at a time (as an
  // earlier version of this did, for the edge endpoint) gives a
  // different x than the real node whenever that dream has more than
  // one attached goal, since the cluster is centered based on the
  // *whole* sibling group.
  const goalPositionById = useMemo(() => {
    const map = new Map<number, { x: number; y: number }>();
    for (const dream of activeDreams) {
      const dreamLinks = linksByDream.get(dream.id) ?? [];
      if (dreamLinks.length === 0) continue;
      const positions = goalPositionsFor(positionFor(dream), dreamLinks, goalById);
      dreamLinks.forEach((link, i) => map.set(link.id, positions[i]));
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDreams, linksByDream, goalById]);

  // Goals with zero goal_dream_links have nothing to compute a position
  // under, so they get one standalone node each instead of being left
  // off the canvas entirely (see the feature's "every goal, attached or
  // not" requirement). Positioned by their own date if they have one,
  // else their own dragged webPos, else a lane off to the side — same
  // fallback chain dreams themselves use for the undated lane.
  const attachedGoalIds = useMemo(() => new Set(goalDreamLinks.map((l) => l.goalId)), [goalDreamLinks]);
  const standaloneGoals = useMemo(
    () => goals.filter((g) => !attachedGoalIds.has(g.id)),
    [goals, attachedGoalIds]
  );

  const standaloneGoalPositionFor = (goal: Goal, indexInLane: number): { x: number; y: number } => {
    if (goal.expectedDateStart) {
      return {
        x: goal.posX ?? UNDATED_GOAL_LANE_X,
        y: rangeMidY(goal.expectedDateStart, goal.expectedDateEnd) - GOAL_NODE_HEIGHT / 2,
      };
    }
    if (goal.posX != null && goal.posY != null) return { x: goal.posX, y: goal.posY };
    const x = UNDATED_GOAL_LANE_X + Math.floor(indexInLane / 5) * 240;
    const y = (indexInLane % 5) * 130 - 260;
    return { x, y };
  };

  const standaloneGoalPositionById = useMemo(() => {
    const map = new Map<number, { x: number; y: number }>();
    standaloneGoals.forEach((g, i) => map.set(g.id, standaloneGoalPositionFor(g, i)));
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [standaloneGoals]);

  // Same position logic the node-building effect below uses for skill
  // nodes, factored out here (keyed by "sk-<linkId>", matching skillNodeId)
  // so link-anchor math (edges below) can resolve a skill's position
  // without duplicating the fallback chain.
  const skillPositionById = useMemo(() => {
    const map = new Map<string, { x: number; y: number }>();
    for (const s of dreamSkills) {
      const dream = dreamById.get(s.dreamId);
      if (!dream) continue;
      const dp = positionFor(dream);
      const ds = nodeSizeFor(dream.priority, 1);
      map.set(
        skillNodeId(s.linkId),
        s.posX != null && s.posY != null
          ? { x: s.posX, y: s.posY }
          : { x: dp.x + ds.width / 2 - SKILL_NODE_WIDTH / 2, y: dp.y - 110 }
      );
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dreamSkills, dreamById]);

  // Every goal *instance* rendered on the canvas right now — one entry
  // per attached link plus one per standalone goal — is what Full view
  // clusters projects/tasks/responsibilities around. Recomputed whenever
  // the underlying goal set or positions change.
  const goalInstances = useMemo(() => {
    const list: { instanceId: string; goalId: number; pos: { x: number; y: number } }[] = [];
    for (const link of goalDreamLinks) {
      const pos = goalPositionById.get(link.id);
      if (pos) list.push({ instanceId: goalNodeId(link.id), goalId: link.goalId, pos });
    }
    for (const goal of standaloneGoals) {
      const pos = standaloneGoalPositionById.get(goal.id);
      if (pos) list.push({ instanceId: standaloneGoalNodeId(goal.id), goalId: goal.id, pos });
    }
    return list;
  }, [goalDreamLinks, goalPositionById, standaloneGoals, standaloneGoalPositionById]);

  // Full view's per-goal data, fetched once per unique goal id (not per
  // instance) whenever the toggle is on and the visible goal set
  // changes. Cleared (not fetched) while off, so Simple mode never pays
  // this cost.
  useEffect(() => {
    if (!fullView) return;
    const uniqueGoalIds = [...new Set(goalInstances.map((i) => i.goalId))];
    if (uniqueGoalIds.length === 0) {
      setClusterDataByGoalId(new Map());
      return;
    }
    let cancelled = false;
    Promise.all([
      Promise.all(
        uniqueGoalIds.map((id) =>
          Promise.all([
            fetchProjectsForGoal(id),
            fetchProgressNodesForGoal(id),
            fetchProgressNodesForProjectsOfGoal(id),
            fetchResponsibilitiesForGoal(id),
          ])
        )
      ),
      fetchGoalWebLinksForGoals(uniqueGoalIds),
      fetchAllCompletions(),
    ]).then(([perGoal, allLinks, allCompletions]) => {
      if (cancelled) return;
      setCompletions(allCompletions);
      const linksByGoal = new Map<number, GoalWebLink[]>();
      for (const l of allLinks) linksByGoal.set(l.goalId, [...(linksByGoal.get(l.goalId) ?? []), l]);
      const map = new Map<number, GoalClusterData>();
      uniqueGoalIds.forEach((id, i) => {
        const goal = goalById.get(id);
        if (!goal) return;
        const [projects, goalTasks, projectTasks, responsibilities] = perGoal[i];
        const tasks = [...goalTasks, ...projectTasks];
        map.set(id, {
          goal,
          projects,
          tasks,
          responsibilities,
          links: linksByGoal.get(id) ?? [],
          layout: computeGoalCluster(goal, projects, tasks, responsibilities, goal.webScale ?? 1, theme.goalClusterDirection as "horizontal" | "vertical"),
        });
      });
      setClusterDataByGoalId(map);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fullView, goalInstances, goalById, theme.goalClusterDirection]);

  // Nodes are rebuilt from `activeDreams`/`goalDreamLinks` whenever
  // either changes. A dated dream's y always comes from its date —
  // dragging can only ever move x (see onNodesChange) — so there's no
  // "live drag position" for y to preserve here. Goal attachments are
  // draggable horizontally too (see item 10) — same x-only rule, y
  // always computed via goalYFor.
  useEffect(() => {
    const dreamNodes: Node[] = activeDreams.map((dream) => ({
      id: dreamNodeId(dream.id),
      type: "dreamNode",
      position: positionFor(dream),
      data: {
        name: dream.name,
        priority: dream.priority,
        expectedDateStart: dream.expectedDateStart,
        expectedDateEnd: dream.expectedDateEnd,
        webFields: buildNodeCardTextItems(
          dreamFieldsById.get(dream.id) ?? [],
          freetextById,
          (type) =>
            type === "dream_reasoning_text" ? dream.reasoning : type === "dream_notes_text" ? dream.notes : undefined,
          (type) =>
            type === "dream_expected_date"
              ? { start: dream.expectedDateStart, end: dream.expectedDateEnd }
              : type === "estimated_start"
              ? { start: dream.estimatedStartDate }
              : undefined
        ),
      },
    }));

    // One node per attachment — a goal linked to three dreams renders
    // three separate nodes, one clustered under each.
    const goalNodes: Node[] = goalDreamLinks
      .filter((link) => goalPositionById.has(link.id))
      .map((link) => {
        const goal = goalById.get(link.goalId)!;
        return {
          id: goalNodeId(link.id),
          type: "dreamGoalNode",
          position: goalPositionById.get(link.id)!,
          deletable: false,
          data: {
            name: goal.name,
            onOpenWeb: () => onNavigate({ type: "goal-web", goalId: goal.id }),
          },
        };
      });

    // Every goal, whether attached to a dream or not — see
    // standaloneGoals above.
    const standaloneGoalNodes: Node[] = standaloneGoals.map((goal) => ({
      id: standaloneGoalNodeId(goal.id),
      type: "dreamGoalNode",
      position: standaloneGoalPositionById.get(goal.id) ?? { x: 0, y: 0 },
      deletable: false,
      data: {
        name: goal.name,
        onOpenWeb: () => onNavigate({ type: "goal-web", goalId: goal.id }),
      },
    }));

    const skillNodes: Node[] = dreamSkills
      .filter((s) => dreamById.has(s.dreamId))
      .map((s) => ({
        id: skillNodeId(s.linkId),
        type: "skillNode",
        position: skillPositionById.get(skillNodeId(s.linkId)) ?? { x: 0, y: 0 },
        deletable: false,
        data: {
          name: s.name,
          currentLevelName: s.currentLevelName,
          onOpen: () => onNavigate({ type: "skill-tree", skillId: s.id }),
        },
      }));

    // Full view: every visible goal's projects/tasks/responsibilities,
    // laid out by the exact same function GoalWebPage itself uses (see
    // webGraph/goalCluster.ts) — just translated to sit under wherever
    // this goal instance actually landed on the Dream Web.
    const clusterNodes: Node[] = fullView
      ? goalInstances.flatMap(({ instanceId, goalId, pos }) => {
          const data = clusterDataByGoalId.get(goalId);
          if (!data) return [];
          const { layout } = data;
          const projectNodes: Node[] = data.projects.map((project) => {
            const p = layout.projectPos.get(project.id) ?? { x: 0, y: 0 };
            return {
              id: clusterNodeId(instanceId, `pr-${project.id}`),
              type: "goalProjectNode",
              position: { x: pos.x + p.x, y: pos.y + p.y },
              draggable: false,
              deletable: false,
              data: {
                name: project.name,
                onUnlink: () => updateProjectGoalId(project.id, null).then(load),
                onAddTask: () => {},
                webFields: [],
                widgets: [],
                onOpenWidget: () => {},
              },
            };
          });
          const respNodes: Node[] = data.responsibilities.map((resp) => {
            const p = layout.respPos.get(resp.id) ?? { x: 0, y: 0 };
            return {
              id: clusterNodeId(instanceId, `rs-${resp.id}`),
              type: "goalRespNode",
              position: { x: pos.x + p.x, y: pos.y + p.y },
              draggable: false,
              deletable: false,
              data: {
                name: resp.name,
                description: htmlToPlainText(resp.description),
                consistencyPct: consistencyPercent(resp, completions),
                daysPerWeek: daysPerWeekFor(resp),
                onUnlink: () => unlinkResponsibilityFromGoal(resp.id, goalId).then(load),
              } satisfies ResponsibilityCardData,
            };
          });
          const taskNodes: Node[] = data.tasks.map((task) => {
            const p = layout.taskPos.get(task.id) ?? { x: 0, y: 0 };
            return {
              id: clusterNodeId(instanceId, `tk-${task.id}`),
              type: "goalTaskNode",
              position: { x: pos.x + p.x, y: pos.y + p.y },
              deletable: false,
              data: {
                categories: task.categories,
                shortDescription: task.shortDescription,
                difficulty: task.difficulty,
                isComplete: task.isComplete,
                isRead: task.isRead,
                imageData: task.imageData,
                cost: task.cost,
                webScale: task.webScale,
                favorite: task.favorite,
                glowAmount: task.glowAmount,
                glowColor: task.glowColor,
              },
            };
          });
          return [...projectNodes, ...respNodes, ...taskNodes];
        })
      : [];

    // Notes attached to a dream default to a spot just below its skill
    // row (skills sit at dp.y - 110, see skillPositionById above) until
    // dragged, same "default near the owner, then free" convention as
    // skill nodes use — offset per sibling so several notes on the same
    // dream don't stack exactly on top of each other.
    const notesByDream = new Map<number, NoteWebLink[]>();
    for (const link of noteLinks) {
      const list = notesByDream.get(link.ownerId) ?? [];
      list.push(link);
      notesByDream.set(link.ownerId, list);
    }
    const noteNodes: Node[] = noteLinks
      .filter((link) => dreamById.has(link.ownerId))
      .map((link) => {
        const dream = dreamById.get(link.ownerId)!;
        const dp = positionFor(dream);
        const ds = nodeSizeFor(dream.priority, 1);
        const siblings = notesByDream.get(link.ownerId) ?? [];
        const idx = siblings.indexOf(link);
        const hasStoredPos = link.posX !== 0 || link.posY !== 0;
        return {
          id: dreamNoteNodeId(link.id),
          type: "noteNode",
          position: hasStoredPos
            ? { x: link.posX, y: link.posY }
            : { x: dp.x + ds.width / 2 - 80 + idx * 20, y: dp.y + ds.height + 20 + idx * 20 },
          deletable: false,
          data: {
            title: link.title,
            onRemove: () => removeNoteWebLink(link.id).then(load),
          },
        };
      });

    // Widgets attached to a dream default to a spot just below its notes
    // (which sit at dp.y + ds.height + 20, see noteNodes above) until
    // dragged — same "default near the owner, then free" convention.
    const widgetsByDream = new Map<number, ProjectWidget[]>();
    for (const w of webWidgets) {
      const ownerId = w.webOwnerId ?? 0;
      const list = widgetsByDream.get(ownerId) ?? [];
      list.push(w);
      widgetsByDream.set(ownerId, list);
    }
    const widgetNodes: Node[] = webWidgets
      .filter((w) => w.webOwnerId !== null && w.webOwnerId !== undefined && dreamById.has(w.webOwnerId))
      .map((w) => {
        const dream = dreamById.get(w.webOwnerId!)!;
        const dp = positionFor(dream);
        const ds = nodeSizeFor(dream.priority, 1);
        const siblings = widgetsByDream.get(w.webOwnerId!) ?? [];
        const idx = siblings.indexOf(w);
        const hasStoredPos = (w.posX ?? 0) !== 0 || (w.posY ?? 0) !== 0;
        return {
          id: widgetNodeId(w.id),
          type: "widgetNode",
          position: hasStoredPos
            ? { x: w.posX ?? 0, y: w.posY ?? 0 }
            : { x: dp.x + ds.width / 2 + 100, y: dp.y + ds.height + 20 + idx * 40 },
          deletable: false,
          data: {
            widget: w,
            onDelete: () => deleteWidget(w.id).then(load),
            onResize: (width: number, height: number) => {
              updateWebWidgetSize(w.id, width, height);
              setWebWidgets((prev) => prev.map((x) => (x.id === w.id ? { ...x, width, height } : x)));
            },
            onOpen: () => handleOpenWebWidget(w),
            onEditDock: () => setOpenWidget(w),
          },
        };
      });

    // Panes default to a spot just below a dream's widgets (which sit at
    // dp.y + ds.height + 20 + siblings*40, see widgetNodes above) until
    // dragged — same "default near the owner, then free" convention.
    // Always rendered behind every other node (negative zIndex) except
    // while brought to front, which jumps it far above everything else
    // instead (see PaneNode.tsx).
    const panesByDream = new Map<number, Pane[]>();
    for (const p of panes) {
      const list = panesByDream.get(p.webOwnerId) ?? [];
      list.push(p);
      panesByDream.set(p.webOwnerId, list);
    }
    const paneNodes: Node[] = panes
      .filter((p) => dreamById.has(p.webOwnerId))
      .map((p) => {
        const dream = dreamById.get(p.webOwnerId)!;
        const dp = positionFor(dream);
        const ds = nodeSizeFor(dream.priority, 1);
        const siblings = panesByDream.get(p.webOwnerId) ?? [];
        const idx = siblings.indexOf(p);
        const hasStoredPos = p.posX !== 0 || p.posY !== 0;
        return {
          id: paneNodeId(p.id),
          type: "paneNode",
          position: hasStoredPos
            ? { x: p.posX, y: p.posY }
            : { x: dp.x - ds.width / 2 - 60, y: dp.y + ds.height + 20 + idx * 40 },
          deletable: false,
          // Explicit false pins this one pane regardless of the
          // canvas-wide drag lock; undefined (not true) lets it inherit
          // that default instead of always overriding it, so the mobile
          // auto-lock still applies to an unlocked pane.
          draggable: p.locked ? false : undefined,
          zIndex: p.isFront ? 1000 : -1,
          data: {
            pane: p,
            isMobile: mobile,
            onResizeLive: (width: number, height: number) => {
              patchPaneSizeLive(setNodes, paneNodeId(p.id), width, height);
            },
            onResizeEnd: (width: number, height: number) => {
              updatePaneSize(p.id, width, height);
              setPanes((prev) => prev.map((x) => (x.id === p.id ? { ...x, width, height } : x)));
            },
            onRename: () => {
              const name = window.prompt("Rename pane:", p.title);
              if (name === null) return;
              const trimmed = name.trim() || "Pane";
              updatePaneTitle(p.id, trimmed);
              setPanes((prev) => prev.map((x) => (x.id === p.id ? { ...x, title: trimmed } : x)));
            },
            onToggleFront: () => {
              updatePaneFront(p.id, !p.isFront);
              setPanes((prev) => prev.map((x) => (x.id === p.id ? { ...x, isFront: !x.isFront } : x)));
            },
            onToggleLocked: () => {
              updatePaneLocked(p.id, !p.locked);
              setPanes((prev) => prev.map((x) => (x.id === p.id ? { ...x, locked: !x.locked } : x)));
            },
            onDelete: () => deletePane(p.id).then(load),
          },
        };
      });

    setNodes([...paneNodes, ...dreamNodes, ...goalNodes, ...standaloneGoalNodes, ...skillNodes, ...clusterNodes, ...noteNodes, ...widgetNodes]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    activeDreams,
    goalDreamLinks,
    goalById,
    goalPositionById,
    onNavigate,
    dreamFieldsById,
    freetextById,
    standaloneGoals,
    standaloneGoalPositionById,
    dreamSkills,
    skillPositionById,
    dreamById,
    fullView,
    goalInstances,
    clusterDataByGoalId,
    completions,
    noteLinks,
    webWidgets,
    panes,
    mobile,
  ]);

  const edges: Edge[] = useMemo(() => {
    const activeIds = new Set(activeDreams.map((d) => d.id));
    const dreamPos = new Map(activeDreams.map((d) => [d.id, positionFor(d)]));
    const dreamSize = new Map(activeDreams.map((d) => [d.id, nodeSizeFor(d.priority, 1)]));

    const linkEdges: Edge[] = links
      .filter((l) => activeIds.has(l.sourceDreamId) && activeIds.has(l.targetDreamId))
      .map((link) => {
        const sp = dreamPos.get(link.sourceDreamId)!;
        const ss = dreamSize.get(link.sourceDreamId)!;
        const tp = dreamPos.get(link.targetDreamId)!;
        const ts = dreamSize.get(link.targetDreamId)!;
        const sCenter = { x: sp.x + ss.width / 2, y: sp.y + ss.height / 2 };
        const tCenter = { x: tp.x + ts.width / 2, y: tp.y + ts.height / 2 };
        const sourceAngle = link.sourceAngle ?? angleFromDirection(tCenter.x - sCenter.x, tCenter.y - sCenter.y);
        const targetAngle = link.targetAngle ?? angleFromDirection(sCenter.x - tCenter.x, sCenter.y - tCenter.y);
        const p1 = anchorPoint(sp, ss, theme.dreamNodeShape, sourceAngle);
        const p2 = anchorPoint(tp, ts, theme.dreamNodeShape, targetAngle);
        return {
          id: linkEdgeId(link.id),
          source: dreamNodeId(link.sourceDreamId),
          target: dreamNodeId(link.targetDreamId),
          sourceHandle: `out-${snapToAnchor(sourceAngle)}`,
          targetHandle: `in-${snapToAnchor(targetAngle)}`,
          reconnectable: true,
          type: "angleEdge",
          data: { x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y, cuttable: true } satisfies AngleEdgeData,
          style: { stroke: theme.dreamLinkColor, strokeWidth: 2 },
        };
      });

    // Thin dashed lines from a dream to each goal attached to it —
    // purely visual "attached to parent" indicators for real
    // goal_dream_links rows, but (unlike the old single-attachment
    // version) genuinely deletable/reconnectable now: removing one just
    // detaches that one instance, since a goal can have others. The
    // dream end still uses real shape-boundary math; the goal end is
    // always angle 0 on a plain rectangle (goals have no shape system).
    const goalEdges: Edge[] = activeDreams.flatMap((dream) => {
      const dreamLinks = linksByDream.get(dream.id) ?? [];
      const dp = positionFor(dream);
      const ds = nodeSizeFor(dream.priority, 1);
      return dreamLinks.map((link) => {
        // Same map the node itself is positioned from (goalPositionById,
        // built once above) — not recomputed per-link, so a dream with
        // multiple attached goals gets the exact same x every sibling
        // actually renders at, not a stand-alone "just this one" position.
        const resolved = goalPositionById.get(link.id)!;
        const dCenter = { x: dp.x + ds.width / 2, y: dp.y + ds.height / 2 };
        const gCenter = { x: resolved.x + GOAL_SIZE.width / 2, y: resolved.y + GOAL_SIZE.height / 2 };
        // A dragged attachment point (see item 4's fix) sticks instead
        // of snapping back to auto-pointing at the goal every render.
        const dreamAngle = link.attachAngle ?? angleFromDirection(gCenter.x - dCenter.x, gCenter.y - dCenter.y);
        const p1 = anchorPoint(dp, ds, theme.dreamNodeShape, dreamAngle);
        const p2 = anchorPoint(resolved, GOAL_SIZE, GOAL_SHAPE, 0);
        return {
          id: goalEdgeId(link.id),
          source: dreamNodeId(dream.id),
          target: goalNodeId(link.id),
          sourceHandle: `out-${snapToAnchor(dreamAngle)}`,
          targetHandle: "in-0",
          deletable: true,
          selectable: true,
          reconnectable: true,
          type: "angleEdge",
          data: { x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y, cuttable: true } satisfies AngleEdgeData,
          style: { stroke: theme.dreamGoalNodeOutlineColor, strokeWidth: 1.5, strokeDasharray: "4 3", opacity: 0.7 },
        };
      });
    });

    // Full view: each visible goal's own goal_web_links, translated by
    // that goal instance's position — read-only here (editing them is
    // still only done from that goal's own Goal Web page). A link
    // touching "goal-end" itself (the 🎯 summary card) has no matching
    // node here — Full view reuses the already-rendered dream/standalone
    // goal node instead of duplicating a second goal card — so React
    // Flow just silently drops that one edge; every project/task/
    // responsibility-to-project/task/responsibility link still renders.
    const clusterLinkEdges: Edge[] = fullView
      ? goalInstances.flatMap(({ instanceId, goalId, pos }) => {
          const data = clusterDataByGoalId.get(goalId);
          if (!data) return [];
          const { layout } = data;
          const taskById = new Map(data.tasks.map((t) => [t.id, t]));
          const layoutPosFor = (innerId: string): { x: number; y: number } | null => {
            if (innerId === "goal-end") return layout.goalPos;
            if (innerId.startsWith("pr-")) return layout.projectPos.get(Number(innerId.slice(3))) ?? null;
            if (innerId.startsWith("rs-")) return layout.respPos.get(Number(innerId.slice(3))) ?? null;
            if (innerId.startsWith("tk-")) return layout.taskPos.get(Number(innerId.slice(3))) ?? null;
            return null;
          };
          const result: Edge[] = [];
          for (const link of data.links) {
            const sp = layoutPosFor(link.sourceNodeId);
            const tp = layoutPosFor(link.targetNodeId);
            // A link touching "goal-end" itself has no matching node
            // here — Full view reuses the already-rendered dream/
            // standalone goal node instead of duplicating a second goal
            // card — so it's silently dropped; every other link renders.
            if (!sp || !tp) continue;
            const ss = nodeBoxFor(link.sourceNodeId, taskById);
            const ts = nodeBoxFor(link.targetNodeId, taskById);
            const sCenter = { x: sp.x + ss.width / 2, y: sp.y + ss.height / 2 };
            const tCenter = { x: tp.x + ts.width / 2, y: tp.y + ts.height / 2 };
            const sourceAngle = link.sourceAngle ?? angleFromDirection(tCenter.x - sCenter.x, tCenter.y - sCenter.y);
            const targetAngle = link.targetAngle ?? angleFromDirection(sCenter.x - tCenter.x, sCenter.y - tCenter.y);
            const p1 = anchorPoint({ x: pos.x + sp.x, y: pos.y + sp.y }, ss, "rectangle", sourceAngle);
            const p2 = anchorPoint({ x: pos.x + tp.x, y: pos.y + tp.y }, ts, "rectangle", targetAngle);
            result.push({
              id: `wl-${instanceId}-${link.id}`,
              source: clusterNodeId(instanceId, link.sourceNodeId),
              target: clusterNodeId(instanceId, link.targetNodeId),
              sourceHandle: `out-${snapToAnchor(sourceAngle)}`,
              targetHandle: `in-${snapToAnchor(targetAngle)}`,
              type: "angleEdge",
              data: { x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y },
              deletable: false,
              reconnectable: false,
              style: { stroke: theme.accent, strokeWidth: 1.5, opacity: 0.75 },
            });
          }
          return result;
        })
      : [];

    // Freeform links a user draws directly on Dream Web (currently only
    // reachable from a skill node's ring, see SkillDreamNode) — resolves
    // against whichever of the four node kinds is at each end.
    const boxFor = (id: string): { pos: { x: number; y: number }; size: { width: number; height: number }; shape: string } | null => {
      if (id.startsWith("d-")) {
        const dream = dreamById.get(parseDreamNodeId(id));
        if (!dream) return null;
        return { pos: positionFor(dream), size: nodeSizeFor(dream.priority, 1), shape: theme.dreamNodeShape };
      }
      if (id.startsWith("gs-")) {
        const pos = standaloneGoalPositionById.get(parseStandaloneGoalNodeId(id));
        return pos ? { pos, size: GOAL_SIZE, shape: GOAL_SHAPE } : null;
      }
      if (id.startsWith("g-")) {
        const pos = goalPositionById.get(parseGoalNodeId(id));
        return pos ? { pos, size: GOAL_SIZE, shape: GOAL_SHAPE } : null;
      }
      if (id.startsWith("sk-")) {
        const pos = skillPositionById.get(id);
        return pos ? { pos, size: { width: SKILL_NODE_WIDTH, height: SKILL_NODE_HEIGHT }, shape: "rectangle" } : null;
      }
      return null;
    };

    const skillWebLinkEdges: Edge[] = dreamWebLinks.flatMap((link) => {
      const s = boxFor(link.sourceNodeId);
      const t = boxFor(link.targetNodeId);
      if (!s || !t) return [];
      const sCenter = { x: s.pos.x + s.size.width / 2, y: s.pos.y + s.size.height / 2 };
      const tCenter = { x: t.pos.x + t.size.width / 2, y: t.pos.y + t.size.height / 2 };
      const sourceAngle = link.sourceAngle ?? angleFromDirection(tCenter.x - sCenter.x, tCenter.y - sCenter.y);
      const targetAngle = link.targetAngle ?? angleFromDirection(sCenter.x - tCenter.x, sCenter.y - tCenter.y);
      const p1 = anchorPoint(s.pos, s.size, s.shape, sourceAngle);
      const p2 = anchorPoint(t.pos, t.size, t.shape, targetAngle);
      return [
        {
          id: `dwl-${link.id}`,
          source: link.sourceNodeId,
          target: link.targetNodeId,
          sourceHandle: `out-${snapToAnchor(sourceAngle)}`,
          targetHandle: `in-${snapToAnchor(targetAngle)}`,
          type: "angleEdge",
          data: { x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y, cuttable: true },
          reconnectable: false,
          style: { stroke: theme.dreamGoalNodeOutlineColor, strokeWidth: 1.5, opacity: 0.75 },
        },
      ];
    });

    return [...linkEdges, ...goalEdges, ...clusterLinkEdges, ...skillWebLinkEdges];
  }, [
    links,
    activeDreams,
    linksByDream,
    goalPositionById,
    standaloneGoalPositionById,
    skillPositionById,
    dreamWebLinks,
    dreamById,
    theme.dreamLinkColor,
    theme.dreamGoalNodeOutlineColor,
    theme.dreamNodeShape,
    theme.accent,
    fullView,
    goalInstances,
    clusterDataByGoalId,
  ]);

  const onNodesChange = (changes: NodeChange[]) => {
    const adjusted = changes
      .filter((c) => c.type !== "remove")
      .map((c) => {
        if (c.type !== "position" || !c.position) return c;
        // Cluster sub-nodes (Full view) and skill/standalone-goal nodes
        // are freely draggable in both axes — only real goal attachments
        // and dated dreams below get an axis locked.
        if (c.id.includes("::") || c.id.startsWith("sk-") || c.id.startsWith("gs-") || c.id.startsWith("dn-")) return c;
        if (c.id.startsWith("g-")) {
          const link = linkById.get(parseGoalNodeId(c.id));
          if (!link) return c;
          // Goal attachments only ever move horizontally — y snaps back
          // to its computed value every change, same "locked axis" trick
          // dated dreams use.
          return { ...c, position: { x: c.position.x, y: goalYFor(link) } };
        }
        const dream = dreamById.get(parseDreamNodeId(c.id));
        if (!dream?.expectedDateStart) return c;
        // Dated dreams can only move horizontally — y snaps back to the
        // date-derived position every change, not just on drop, so the
        // node visually tracks a straight horizontal line while dragging.
        return { ...c, position: { x: c.position.x, y: positionFor(dream).y } };
      });
    setNodes((nds) => applyNodeChanges(adjusted, nds));
  };

  const goalInstanceById = useMemo(() => new Map(goalInstances.map((i) => [i.instanceId, i])), [goalInstances]);

  // A pane brought to front is meant to act like everything grouped
  // inside it got packed into one glass box (see PaneNode.tsx's front
  // toggle) — dragging the pane itself should carry those nodes along
  // instead of leaving them behind. Captured at drag START (whatever
  // currently overlaps the pane's rect, even partially — it's on the
  // user to not overlap nodes they don't want swept up) rather than at
  // toggle time, so a pane that's been sitting "in front" for a while
  // still picks up whatever has since been dropped into it.
  const packedDragRef = useRef<null | {
    paneNodeId: string;
    paneStart: { x: number; y: number };
    children: { id: string; startX: number; startY: number }[];
  }>(null);

  const onNodeDragStart = (_: MouseEvent | TouchEvent, node: Node) => {
    if (!node.id.startsWith("pn-")) return;
    const id = parsePaneNodeId(node.id);
    const pane = panes.find((p) => p.id === id);
    if (!pane?.isFront) return;
    const rect = { x: node.position.x, y: node.position.y, width: pane.width, height: pane.height };
    const children = nodes
      .filter((n) => n.id !== node.id)
      .filter((n) => {
        const nw = n.measured?.width ?? 200;
        const nh = n.measured?.height ?? 140;
        return rectsOverlap(rect, { x: n.position.x, y: n.position.y, width: nw, height: nh });
      })
      .map((n) => ({ id: n.id, startX: n.position.x, startY: n.position.y }));
    packedDragRef.current = { paneNodeId: node.id, paneStart: { x: node.position.x, y: node.position.y }, children };
  };

  // Live-follow for the packed children, same "move with the cursor, not
  // just on drop" reasoning as PaneNode's own resize (see onResizeLive).
  const onNodeDrag = (_: MouseEvent | TouchEvent, node: Node) => {
    const packed = packedDragRef.current;
    if (!packed || packed.paneNodeId !== node.id) return;
    const dx = node.position.x - packed.paneStart.x;
    const dy = node.position.y - packed.paneStart.y;
    setNodes((nds) =>
      nds.map((n) => {
        const child = packed.children.find((c) => c.id === n.id);
        return child ? { ...n, position: { x: child.startX + dx, y: child.startY + dy } } : n;
      })
    );
  };

  // The exact per-node-type "world position -> owner-local position,
  // then persist" logic every drag stop needs — factored out so a
  // packed pane's carried-along children (see onNodeDragStart above) can
  // reuse it for their own final position, not just the node the user's
  // cursor actually dragged.
  const persistNodePosition = (node: { id: string; position: { x: number; y: number } }) => {
    const cluster = parseClusterNodeId(node.id);
    if (cluster) {
      // Only task cards are draggable inside a cluster (see clusterNodes
      // above) — persisted the same way GoalWebPage's own task drag is,
      // just working back from this instance's translated position.
      const m = /^tk-(\d+)$/.exec(cluster.inner);
      if (!m) return;
      const taskId = Number(m[1]);
      const instance = goalInstanceById.get(cluster.instanceId);
      if (!instance) return;
      const data = clusterDataByGoalId.get(instance.goalId);
      const task = data?.tasks.find((t) => t.id === taskId);
      if (!data || !task) return;
      const scale = data.goal.webScale ?? 1;
      const worldBase = { x: instance.pos.x + (data.layout.taskPos.get(taskId)?.x ?? 0) - task.posX * scale, y: instance.pos.y + (data.layout.taskPos.get(taskId)?.y ?? 0) - task.posY * scale };
      const localX = (node.position.x - worldBase.x) / scale;
      const localY = (node.position.y - worldBase.y) / scale;
      updateProgressPosition(taskId, localX, localY);
      return;
    }
    if (node.id.startsWith("sk-")) {
      const linkId = parseSkillNodeId(node.id);
      updateDreamSkillPosition(linkId, node.position.x, node.position.y);
      setDreamSkills((prev) => prev.map((s) => (s.linkId === linkId ? { ...s, posX: node.position.x, posY: node.position.y } : s)));
      return;
    }
    if (node.id.startsWith("dn-")) {
      const linkId = parseDreamNoteNodeId(node.id);
      const { x, y } = node.position;
      updateNoteWebLinkPosition(linkId, x, y);
      setNoteLinks((prev) => prev.map((l) => (l.id === linkId ? { ...l, posX: x, posY: y } : l)));
      return;
    }
    if (node.id.startsWith("wg-")) {
      const id = parseWidgetNodeId(node.id);
      const { x, y } = node.position;
      updateWebWidgetPosition(id, x, y);
      setWebWidgets((prev) => prev.map((w) => (w.id === id ? { ...w, posX: x, posY: y } : w)));
      return;
    }
    if (node.id.startsWith("pn-")) {
      const id = parsePaneNodeId(node.id);
      const { x, y } = node.position;
      updatePanePosition(id, x, y);
      setPanes((prev) => prev.map((p) => (p.id === id ? { ...p, posX: x, posY: y } : p)));
      return;
    }
    if (isStandaloneGoalNodeId(node.id)) {
      const goalId = parseStandaloneGoalNodeId(node.id);
      updateGoalWebPosition(goalId, node.position.x, node.position.y);
      setGoals((prev) => prev.map((g) => (g.id === goalId ? { ...g, posX: node.position.x, posY: node.position.y } : g)));
      return;
    }
    if (node.id.startsWith("g-")) {
      const linkId = parseGoalNodeId(node.id);
      if (!linkById.has(linkId)) return;
      const x = node.position.x;
      updateGoalDreamLinkPosX(linkId, x);
      setGoalDreamLinks((prev) => prev.map((l) => (l.id === linkId ? { ...l, posX: x } : l)));
      return;
    }
    const id = parseDreamNodeId(node.id);
    const dream = dreamById.get(id);
    if (!dream) return;
    const { x, y } = node.position;
    if (dream.expectedDateStart) {
      updateDreamPositionX(id, x);
    } else {
      updateDreamPosition(id, x, y);
    }
    setDreams((prev) => prev.map((d) => (d.id === id ? { ...d, posX: x, posY: y } : d)));
  };

  const onNodeDragStop = (_: MouseEvent | TouchEvent, node: Node) => {
    persistNodePosition(node);
    const packed = packedDragRef.current;
    if (packed && packed.paneNodeId === node.id) {
      const dx = node.position.x - packed.paneStart.x;
      const dy = node.position.y - packed.paneStart.y;
      for (const child of packed.children) {
        persistNodePosition({ id: child.id, position: { x: child.startX + dx, y: child.startY + dy } });
      }
      packedDragRef.current = null;
    }
  };

  const onConnect = (connection: Connection) => {
    if (!connection.source || !connection.target) return;
    const sourceIsDream = connection.source.startsWith("d-");
    const targetIsDream = connection.target.startsWith("d-");
    const sourceIsGoal = connection.source.startsWith("g-");
    const targetIsGoal = connection.target.startsWith("g-");

    if (sourceIsDream && targetIsDream) {
      const sourceId = parseDreamNodeId(connection.source);
      const targetId = parseDreamNodeId(connection.target);
      if (sourceId === targetId) return;
      const sourceAngle = parseAngleHandleId(connection.sourceHandle);
      const targetAngle = parseAngleHandleId(connection.targetHandle);
      addDreamLink(sourceId, targetId, sourceAngle, targetAngle).then(load);
      return;
    }

    // Dragging a fresh connection between a dream's boundary and an
    // already-rendered goal node attaches that goal to this dream too
    // (see item 9) — works either direction, since a drag can start
    // from either side. If the goal is already attached to this exact
    // dream, this just updates the pinned attachment angle (see item 4's
    // fix) instead of duplicating the link; otherwise it's a brand new
    // attachment and the goal will render one more node here.
    if ((sourceIsDream && targetIsGoal) || (sourceIsGoal && targetIsDream)) {
      const dreamHandle = sourceIsDream ? connection.sourceHandle : connection.targetHandle;
      const dreamId = parseDreamNodeId(sourceIsDream ? connection.source : connection.target);
      const linkId = parseGoalNodeId(sourceIsGoal ? connection.source : connection.target);
      const link = linkById.get(linkId);
      if (!link) return;
      const angle = parseAngleHandleId(dreamHandle);
      addOrUpdateGoalDreamLink(link.goalId, dreamId, angle).then(load);
      return;
    }

    // A skill has no dedicated link system of its own — any connection
    // touching a skill node (to a dream, a goal, or another skill) just
    // becomes a plain freeform dream_web_link (see db/dreamWebLinks.ts).
    if (connection.source.startsWith("sk-") || connection.target.startsWith("sk-")) {
      if (connection.source === connection.target) return;
      const sourceAngle = parseAngleHandleId(connection.sourceHandle);
      const targetAngle = parseAngleHandleId(connection.targetHandle);
      addDreamWebLink(connection.source, connection.target, sourceAngle, targetAngle).then(load);
    }
  };

  // Grabbing an existing edge's endpoint and dropping it somewhere else
  // (a different angle on the same node, or a different node entirely)
  // — without this, edges built from a custom edge type (AngleEdge) and
  // rendered with data-driven points aren't reconnectable by default,
  // which was item 4's actual bug: dragging did nothing because there
  // was no handler wired up to react to it at all.
  const onReconnect = (oldEdge: Edge, newConnection: Connection) => {
    if (oldEdge.id.startsWith("link-")) {
      if (!newConnection.source?.startsWith("d-") || !newConnection.target?.startsWith("d-")) return;
      const sourceId = parseDreamNodeId(newConnection.source);
      const targetId = parseDreamNodeId(newConnection.target);
      if (sourceId === targetId) return;
      const sourceAngle = parseAngleHandleId(newConnection.sourceHandle);
      const targetAngle = parseAngleHandleId(newConnection.targetHandle);
      // Old pair may differ from the new one (dragged to a different
      // dream entirely) — remove the old row first so a retarget
      // doesn't leave a stale link behind alongside the new one.
      removeDreamLink(parseLinkEdgeId(oldEdge.id))
        .then(() => addDreamLink(sourceId, targetId, sourceAngle, targetAngle))
        .then(load);
      return;
    }

    if (oldEdge.id.startsWith("goal-edge-")) {
      if (!newConnection.source || !newConnection.target) return;
      const sourceIsDream = newConnection.source.startsWith("d-");
      const targetIsDream = newConnection.target.startsWith("d-");
      if (!sourceIsDream && !targetIsDream) return;
      const linkId = parseGoalEdgeId(oldEdge.id);
      const link = linkById.get(linkId);
      if (!link) return;
      const dreamHandle = sourceIsDream ? newConnection.sourceHandle : newConnection.targetHandle;
      const newDreamId = parseDreamNodeId(sourceIsDream ? newConnection.source : newConnection.target);
      const angle = parseAngleHandleId(dreamHandle);
      if (newDreamId === link.dreamId) {
        // Same dream, just a different angle on it.
        updateGoalDreamLinkAngle(linkId, angle).then(load);
      } else {
        // Dragged this specific edge's end to a different dream — moves
        // that one attachment rather than adding a new one (a fresh
        // connect gesture from the dream's boundary is what adds a new
        // attachment; see onConnect above).
        Promise.all([removeGoalDreamLink(linkId), addOrUpdateGoalDreamLink(link.goalId, newDreamId, angle)]).then(
          load
        );
      }
    }
  };

  const onEdgesDelete = (deleted: Edge[]) => {
    for (const edge of deleted) {
      if (edge.id.startsWith("link-")) {
        removeDreamLink(parseLinkEdgeId(edge.id)).then(load);
      } else if (edge.id.startsWith("goal-edge-")) {
        removeGoalDreamLink(parseGoalEdgeId(edge.id)).then(load);
      } else if (edge.id.startsWith("dwl-")) {
        removeDreamWebLink(Number(edge.id.slice(4))).then(load);
      }
    }
  };

  const onNodeClick = (event: React.MouseEvent, node: Node) => {
    const cluster = parseClusterNodeId(node.id);
    if (cluster) {
      const instance = goalInstanceById.get(cluster.instanceId);
      if (!instance) return;
      const prM = /^pr-(\d+)$/.exec(cluster.inner);
      if (prM) {
        onNavigate({ type: "project-detail", projectId: Number(prM[1]) });
        return;
      }
      const rsM = /^rs-(\d+)$/.exec(cluster.inner);
      if (rsM) {
        onNavigate({ type: "responsibility-detail", responsibilityId: Number(rsM[1]) });
        return;
      }
      const tkM = /^tk-(\d+)$/.exec(cluster.inner);
      if (tkM) {
        const taskId = Number(tkM[1]);
        const task = clusterDataByGoalId.get(instance.goalId)?.tasks.find((t) => t.id === taskId);
        onNavigate({
          type: "progress-node-detail",
          nodeId: taskId,
          projectId: task?.projectId ?? undefined,
          goalId: task?.goalId ?? undefined,
        });
      }
      return;
    }
    if (node.id.startsWith("sk-")) {
      // Opens via the node's own onOpen click handler already.
      return;
    }
    if (node.id.startsWith("dn-")) {
      const linkId = parseDreamNoteNodeId(node.id);
      const link = noteLinks.find((l) => l.id === linkId);
      if (link) onNavigate({ type: "notes", pageId: link.noteId });
      return;
    }
    if (node.id.startsWith("wg-")) {
      // Opens via the node's own click handlers already (open button /
      // inline widget content) — same as skill nodes above.
      return;
    }
    if (node.id.startsWith("pn-")) {
      const id = parsePaneNodeId(node.id);
      if (event.ctrlKey && panes.some((p) => p.id === id)) setPaneLooksTargetId(id);
      return;
    }
    if (isStandaloneGoalNodeId(node.id)) {
      onNavigate({ type: "goal-detail", goalId: parseStandaloneGoalNodeId(node.id) });
      return;
    }
    if (node.id.startsWith("g-")) {
      const link = linkById.get(parseGoalNodeId(node.id));
      if (link) onNavigate({ type: "goal-detail", goalId: link.goalId });
      return;
    }
    const dreamId = parseDreamNodeId(node.id);
    if (event.ctrlKey) {
      setFieldVisibilityDreamId(dreamId);
      return;
    }
    onNavigate({ type: "dream-detail", dreamId });
  };

  const handleUpdateDreamFieldWeb = (dreamId: number, fieldId: number, patch: FieldStylePatch) => {
    setDreamFieldsById((prev) => {
      const next = new Map(prev);
      const list = next.get(dreamId);
      if (list) next.set(dreamId, list.map((f) => (f.id === fieldId ? mergeFieldStylePatch(f, patch) : f)));
      return next;
    });
    updateFieldStyle(fieldId, patch);
  };

  const handleAddDream = async () => {
    setCreating(true);
    try {
      const undatedCount = dreams.filter((d) => !d.expectedDateStart && !d.isAsleep).length;
      const x = UNDATED_LANE_X - Math.floor(undatedCount / 5) * 160;
      const y = (undatedCount % 5) * 110 - 220;
      const id = await addDream("New Dream", x, y);
      onNavigate({ type: "dream-detail", dreamId: id });
    } finally {
      setCreating(false);
    }
  };

  // One dropdown for which dream owns the attachment, one for which note
  // (or "+ Create new") — same one-dropdown-per-choice, one-button
  // convention GoalWebPage's add panel uses. Placed at a default spot
  // just below that dream's skill row (see noteNodes above); only ever
  // inserts a note_web_links row, never copies the note itself.
  const handleNoteAction = async () => {
    if (!noteDreamChoice) return;
    const dreamId = Number(noteDreamChoice);
    if (noteChoice === NEW_NOTE_SENTINEL) {
      setCreatingNote(true);
      try {
        const noteId = await addPage(null, "Notes", "New Note");
        await addNoteWebLink("dream", dreamId, noteId, 0, 0);
        setNoteChoice("");
        load();
      } finally {
        setCreatingNote(false);
      }
      return;
    }
    if (!noteChoice) return;
    await addNoteWebLink("dream", dreamId, Number(noteChoice), 0, 0);
    setNoteChoice("");
    load();
  };

  // Journal/linkboard/table widgets have no inline render on the canvas
  // (see WebWidgetNode.tsx) — clicking their "Open" button navigates to
  // the widget's existing page, same destination GoalWebPage's own
  // handleOpenWidget sends a grid widget to. Photo/dock/costlog/
  // calculator render fully inline on the node itself, so they never
  // call this.
  const handleOpenWebWidget = (widget: ProjectWidget) => {
    if (widget.widgetType === "table") {
      onNavigate({ type: "project-table", widgetId: widget.id });
    } else if (widget.widgetType === "journal") {
      onNavigate({ type: "project-journal", widgetId: widget.id });
    } else if (widget.widgetType === "linkboard") {
      onNavigate({ type: "project-board", widgetId: widget.id });
    }
  };

  // Same one-dropdown-per-choice, one-button convention as
  // handleNoteAction just above — pick which dream owns the widget, then
  // which type to add.
  const handleAddWebWidget = async () => {
    if (!widgetDreamChoice || !widgetChoice) return;
    const dreamId = Number(widgetDreamChoice);
    await addWebWidget(
      "dream",
      dreamId,
      widgetChoice,
      WIDGET_TYPE_LABELS[widgetChoice],
      0,
      0,
      WEB_WIDGET_DEFAULT_WIDTH,
      WEB_WIDGET_DEFAULT_HEIGHT
    );
    setWidgetChoice("");
    load();
  };

  // Same one-dropdown, one-button convention as handleAddWebWidget —
  // pick which dream owns the pane, then add it with default size/color.
  const handleAddPane = async () => {
    if (!paneDreamChoice) return;
    setAddingPane(true);
    try {
      await addPane("dream", Number(paneDreamChoice), 0, 0);
      load();
    } finally {
      setAddingPane(false);
    }
  };

  const timeline = [...activeDreams].sort(timelineSort);
  // Every goal (attached or not) belongs on the same timeline list as
  // dreams — sorted the same "dated first, then alphabetical undated"
  // way, just rendered as a visually distinct row (see .dream-timeline-
  // item-goal in DreamWebPage.css) so the two kinds stay tellable apart
  // at a glance.
  const goalTimeline = [...goals].sort((a, b) => {
    if (!a.expectedDateStart && !b.expectedDateStart) return a.name.localeCompare(b.name);
    if (!a.expectedDateStart) return 1;
    if (!b.expectedDateStart) return -1;
    return a.expectedDateStart.localeCompare(b.expectedDateStart);
  });
  const showMonthLines = zoom >= MONTH_ZOOM_THRESHOLD;

  const priorityColorFor = (p: DreamPriority) =>
    p === "high" ? theme.dreamPriorityHigh : p === "low" ? theme.dreamPriorityLow : theme.dreamPriorityMedium;

  if (loading) {
    return (
      <div className="page">
        <p className="page-text">Loading Dream Web…</p>
      </div>
    );
  }

  return (
    <div className="dream-web-shell" data-color-surface="page-bg" style={pageSurfaceStyle(pageBgOverrides["page-bg"])}>
      <DecalLayer decals={decals} target="page-bg" />
      {mobile && timelineOpen && (
        <div className="dream-timeline-backdrop" onClick={() => setTimelineOpen(false)} />
      )}
      <aside className={`dream-timeline${mobile && timelineOpen ? " is-open" : ""}`}>
        <div className="dream-timeline-header">
          <h2 className="dream-timeline-title">Timeline</h2>
          <button className="add-button" onClick={handleAddDream} disabled={creating}>
            {creating ? "Adding…" : "+ Dream"}
          </button>
        </div>
        {timeline.length === 0 && <p className="page-text">No dreams yet.</p>}
        <ul className="dream-timeline-list">
          {timeline.map((dream) => (
            <li key={dream.id}>
              <button
                className="dream-timeline-item"
                onClick={() => onNavigate({ type: "dream-detail", dreamId: dream.id })}
              >
                <span className="dream-timeline-dot" style={{ background: priorityColorFor(dream.priority) }} />
                <span className="dream-timeline-info">
                  <span className="dream-timeline-name">{dream.name}</span>
                  <span className="dream-timeline-date">{dream.expectedDateStart || "No date set"}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>

        {goalTimeline.length > 0 && (
          <>
            <h2 className="dream-timeline-title dream-timeline-title-goals">Goals</h2>
            <ul className="dream-timeline-list">
              {goalTimeline.map((goal) => (
                <li key={goal.id}>
                  <button
                    className="dream-timeline-item dream-timeline-item-goal"
                    onClick={() => onNavigate({ type: "goal-detail", goalId: goal.id })}
                  >
                    <span className="dream-timeline-dot" style={{ background: theme.dreamGoalNodeOutlineColor }} />
                    <span className="dream-timeline-info">
                      <span className="dream-timeline-name">{goal.name}</span>
                      <span className="dream-timeline-date">{goal.expectedDateStart || "No date set"}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}

        {sleepingDreams.length > 0 && (
          <>
            <h2 className="dream-timeline-title dream-timeline-title-sleeping">Sleeping</h2>
            <ul className="dream-timeline-list">
              {sleepingDreams.map((dream) => (
                <li key={dream.id}>
                  <button
                    className="dream-timeline-item dream-timeline-item-sleeping"
                    onClick={() => onNavigate({ type: "dream-detail", dreamId: dream.id })}
                  >
                    <span className="dream-timeline-info">
                      <span className="dream-timeline-name">{dream.name}</span>
                      <span className="dream-timeline-date">until {dream.sleepUntil}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </aside>

      <div className="dream-canvas-area">
        <div className="web-page-header">
          <h1 className="page-title" style={{ margin: 0, fontSize: "22px" }}>
            Dream Web
          </h1>
          <div className="web-page-header-actions">
            {mobile && (
              <button className="add-button secondary" onClick={() => setTimelineOpen(true)}>
                Timeline
              </button>
            )}
            <button
              className="add-button secondary"
              onClick={toggleFullView}
              title="Toggle between just goals/dreams/skills and everything each goal owns"
            >
              {fullView ? "🕸 Full" : "🕸 Simple"}
            </button>
            <div style={{ position: "relative" }}>
              <button className="add-button secondary" onClick={() => setShowNotesPanel((v) => !v)}>
                📝 Notes
              </button>
              {showNotesPanel && (
                <div className="goal-web-add-panel" style={{ position: "absolute", top: "100%", right: 0, zIndex: 20 }}>
                  <div className="goal-web-add-panel-row">
                    <span className="goal-web-add-panel-label">ATTACH NOTE</span>
                    <div style={{ display: "flex", gap: "4px" }}>
                      <select
                        className="inline-add-input"
                        style={{ marginBottom: 0, flex: 1 }}
                        value={noteDreamChoice}
                        onChange={(e) => setNoteDreamChoice(e.target.value)}
                      >
                        <option value="">To dream…</option>
                        {activeDreams.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div style={{ display: "flex", gap: "4px" }}>
                      <select
                        className="inline-add-input"
                        style={{ marginBottom: 0, flex: 1 }}
                        value={noteChoice}
                        onChange={(e) => setNoteChoice(e.target.value)}
                      >
                        <option value="">Choose note…</option>
                        <option value={NEW_NOTE_SENTINEL}>+ Create new</option>
                        {notePickerOptions.map((n) => (
                          <option key={n.id} value={n.id}>
                            {n.title}
                          </option>
                        ))}
                      </select>
                      <button
                        className="add-button secondary"
                        onClick={handleNoteAction}
                        disabled={!noteDreamChoice || !noteChoice || creatingNote}
                      >
                        {creatingNote ? "Adding…" : noteChoice === NEW_NOTE_SENTINEL ? "New" : "Link"}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div style={{ position: "relative" }}>
              <button className="add-button secondary" onClick={() => setShowWidgetsPanel((v) => !v)}>
                🧩 Widgets
              </button>
              {showWidgetsPanel && (
                <div className="goal-web-add-panel" style={{ position: "absolute", top: "100%", right: 0, zIndex: 20 }}>
                  <div className="goal-web-add-panel-row">
                    <span className="goal-web-add-panel-label">ADD WIDGET</span>
                    <div style={{ display: "flex", gap: "4px" }}>
                      <select
                        className="inline-add-input"
                        style={{ marginBottom: 0, flex: 1 }}
                        value={widgetDreamChoice}
                        onChange={(e) => setWidgetDreamChoice(e.target.value)}
                      >
                        <option value="">To dream…</option>
                        {activeDreams.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div style={{ display: "flex", gap: "4px" }}>
                      <select
                        className="inline-add-input"
                        style={{ marginBottom: 0, flex: 1 }}
                        value={widgetChoice}
                        onChange={(e) => setWidgetChoice(e.target.value as ProjectWidgetType | "")}
                      >
                        <option value="">Choose type…</option>
                        {(Object.keys(WIDGET_TYPE_LABELS) as ProjectWidgetType[]).map((type) => (
                          <option key={type} value={type}>
                            {WIDGET_TYPE_LABELS[type]}
                          </option>
                        ))}
                      </select>
                      <button
                        className="add-button secondary"
                        onClick={handleAddWebWidget}
                        disabled={!widgetDreamChoice || !widgetChoice}
                      >
                        Add
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div style={{ position: "relative" }}>
              <button className="add-button secondary" onClick={() => setShowPanesPanel((v) => !v)}>
                🗂 Panes
              </button>
              {showPanesPanel && (
                <div className="goal-web-add-panel" style={{ position: "absolute", top: "100%", right: 0, zIndex: 20 }}>
                  <div className="goal-web-add-panel-row">
                    <span className="goal-web-add-panel-label">ADD PANE</span>
                    <span style={{ fontSize: "10px", opacity: 0.65 }}>
                      A colored backdrop for grouping nearby nodes. Ctrl+click one to edit its color/opacity.
                    </span>
                    <div style={{ display: "flex", gap: "4px" }}>
                      <select
                        className="inline-add-input"
                        style={{ marginBottom: 0, flex: 1 }}
                        value={paneDreamChoice}
                        onChange={(e) => setPaneDreamChoice(e.target.value)}
                      >
                        <option value="">To dream…</option>
                        {activeDreams.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.name}
                          </option>
                        ))}
                      </select>
                      <button
                        className="add-button secondary"
                        onClick={handleAddPane}
                        disabled={!paneDreamChoice || addingPane}
                      >
                        {addingPane ? "Adding…" : "Add"}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <StyledButton buttonKey="web-zoom-back" iconKey="back" onClick={() => onNavigate({ type: "home" })} />
          </div>
        </div>

        <div
          className="dream-canvas"
          style={{
            backgroundImage: theme.dreamWebBackgroundImage ? `url("${theme.dreamWebBackgroundImage}")` : "none",
            backgroundSize:
              theme.dreamWebBackgroundTile === "1" ? `${theme.dreamWebBackgroundScale || "128"}px` : "cover",
            backgroundRepeat: theme.dreamWebBackgroundTile === "1" ? "repeat" : "no-repeat",
            backgroundPosition: "center",
          }}
        >
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            onNodesChange={onNodesChange}
            onNodeDragStart={onNodeDragStart}
            onNodeDrag={onNodeDrag}
            onNodeDragStop={onNodeDragStop}
            onConnect={onConnect}
            onReconnect={onReconnect}
            onEdgesDelete={onEdgesDelete}
            onNodeClick={onNodeClick}
            onMoveEnd={handleMoveEnd}
            defaultViewport={initialViewport ?? undefined}
            fitView={!initialViewport}
            connectionMode={ConnectionMode.Loose}
            connectionLineType={ConnectionLineType.Straight}
            deleteKeyCode={["Backspace", "Delete"]}
            minZoom={0.05}
            maxZoom={4}
            nodesDraggable={!nodesLocked}
            panOnDrag
            zoomOnPinch
            proOptions={{ hideAttribution: true }}
          >
            <ViewportPortal>
              {/* zIndex: -1 — without it this portal's content (grid
                  lines + the date range bars below) paints on top of the
                  dream/goal node layer instead of behind it, since it's
                  appended to the DOM after them. */}
              <div style={{ position: "absolute", top: 0, left: 0, zIndex: -1 }}>
                {gridLines
                  // The current-month line stays visible regardless of
                  // zoom (it's the one fixed "you are here" marker) —
                  // every other month line still only shows once zoomed
                  // in enough to read them.
                  .filter((l) => l.isYear || l.isCurrentMonth || showMonthLines)
                  .map((l, i) => (
                    <div
                      key={i}
                      style={{
                        position: "absolute",
                        top: l.y,
                        left: -6000,
                        height: l.isCurrentMonth ? 3 : l.isYear ? 2 : 1,
                        width: 13000,
                        background: l.isCurrentMonth
                          ? "#f4c430"
                          : l.isYear
                          ? "rgba(255,255,255,0.22)"
                          : "rgba(255,255,255,0.08)",
                        boxShadow: l.isCurrentMonth ? "0 0 8px rgba(244,196,48,0.6)" : "none",
                        pointerEvents: "none",
                      }}
                    >
                      <span
                        style={{
                          position: "absolute",
                          top: l.isCurrentMonth ? -19 : -16,
                          left: 5980,
                          fontSize: l.isCurrentMonth ? 13 : l.isYear ? 12 : 10,
                          fontWeight: l.isCurrentMonth || l.isYear ? 700 : 400,
                          color: l.isCurrentMonth ? "#f4c430" : "rgba(255,255,255,0.55)",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {l.isCurrentMonth ? `${l.label} (today)` : l.label}
                      </span>
                    </div>
                  ))}

                <svg style={{ position: "absolute", left: 0, top: 0, overflow: "visible", pointerEvents: "none" }}>
                  {activeDreams
                    .filter(
                      (d) => d.expectedDateStart && d.expectedDateEnd && d.expectedDateStart !== d.expectedDateEnd
                    )
                    .map((dream) => {
                      // Future is up (see isoToY) — the later/end date
                      // always ends up with the smaller y, so it's the
                      // top of the bar regardless of which literal field
                      // (start/end) that is.
                      const startY = isoToY(dream.expectedDateStart!);
                      const endY = isoToY(dream.expectedDateEnd!);
                      const { width } = nodeSizeFor(dream.priority, zoom);
                      const centerX = dream.posX + width / 2;
                      // Matches the dream node's own outline color (a
                      // single theme setting, not per-priority) rather
                      // than the priority dot color — see item 10.
                      const color = theme.dreamNodeOutlineColor;
                      const yTop = Math.min(startY, endY);
                      const yBottom = Math.max(startY, endY);
                      const topLabel = yTop === endY ? dream.expectedDateEnd! : dream.expectedDateStart!;
                      const bottomLabel = yTop === endY ? dream.expectedDateStart! : dream.expectedDateEnd!;
                      return (
                        <g key={dream.id}>
                          <path d={rangeBarPath(centerX, yTop, yBottom)} fill={color} opacity={0.75} />
                          <text
                            x={centerX}
                            y={yTop - 8}
                            textAnchor="middle"
                            fontSize={12}
                            fontWeight={700}
                            fill={color}
                            style={{ paintOrder: "stroke", stroke: "rgba(0,0,0,0.55)", strokeWidth: 3 }}
                          >
                            {formatShortDate(topLabel)}
                          </text>
                          <text
                            x={centerX}
                            y={yBottom + 18}
                            textAnchor="middle"
                            fontSize={12}
                            fontWeight={700}
                            fill={color}
                            style={{ paintOrder: "stroke", stroke: "rgba(0,0,0,0.55)", strokeWidth: 3 }}
                          >
                            {formatShortDate(bottomLabel)}
                          </text>
                        </g>
                      );
                    })}

                  {/* Same flagpole convention as dreams above, just for
                      every dated goal with a real range (attached or
                      standalone) — a differently colored bar (the goal
                      outline color, not the dream one) so the two read
                      as distinct at a glance. */}
                  {goalInstances
                    .map((instance) => ({ instance, goal: goalById.get(instance.goalId) }))
                    .filter(
                      (
                        entry
                      ): entry is { instance: (typeof goalInstances)[number]; goal: Goal } =>
                        !!entry.goal?.expectedDateStart &&
                        !!entry.goal.expectedDateEnd &&
                        entry.goal.expectedDateStart !== entry.goal.expectedDateEnd
                    )
                    .map(({ instance, goal }) => {
                      const startY = isoToY(goal.expectedDateStart!);
                      const endY = isoToY(goal.expectedDateEnd!);
                      const centerX = instance.pos.x + GOAL_NODE_WIDTH / 2;
                      const color = theme.dreamGoalNodeOutlineColor;
                      const yTop = Math.min(startY, endY);
                      const yBottom = Math.max(startY, endY);
                      const topLabel = yTop === endY ? goal.expectedDateEnd! : goal.expectedDateStart!;
                      const bottomLabel = yTop === endY ? goal.expectedDateStart! : goal.expectedDateEnd!;
                      return (
                        <g key={instance.instanceId}>
                          <path d={rangeBarPath(centerX, yTop, yBottom)} fill={color} opacity={0.75} />
                          <text
                            x={centerX}
                            y={yTop - 8}
                            textAnchor="middle"
                            fontSize={11}
                            fontWeight={700}
                            fill={color}
                            style={{ paintOrder: "stroke", stroke: "rgba(0,0,0,0.55)", strokeWidth: 3 }}
                          >
                            {formatShortDate(topLabel)}
                          </text>
                          <text
                            x={centerX}
                            y={yBottom + 18}
                            textAnchor="middle"
                            fontSize={11}
                            fontWeight={700}
                            fill={color}
                            style={{ paintOrder: "stroke", stroke: "rgba(0,0,0,0.55)", strokeWidth: 3 }}
                          >
                            {formatShortDate(bottomLabel)}
                          </text>
                        </g>
                      );
                    })}
                </svg>
              </div>
            </ViewportPortal>

            <ViewportPortal>
              <DecalLayer decals={decals} target="canvas" surface="section:dreams-web" />
            </ViewportPortal>

            <Panel position="top-right" className="web-hint-panel">
              <HintTooltip text="Future is up, past is down. Drag from anywhere along a node's edge to link dreams, or to attach a goal to a dream. Dated dreams and goals only move left/right — change the date to move them in time." />
            </Panel>
            <Background
              color={theme.webGridColor}
              bgColor={theme.dreamWebBackgroundImage ? "transparent" : theme.dreamWebBackground}
              gap={16}
            />
            <WebControls />
            {theme.showLaborLegend !== "0" && <LaborLegend />}
          </ReactFlow>
        </div>
      </div>
      {openWidget && <NodeWidgetOverlay widget={openWidget} onClose={() => setOpenWidget(null)} />}
      {fieldVisibilityDreamId != null && (
        <NodeFieldVisibilityPopover
          title={dreamById.get(fieldVisibilityDreamId)?.name ?? "Dream"}
          fields={dreamFieldsById.get(fieldVisibilityDreamId) ?? []}
          onUpdate={(fieldId, patch) => handleUpdateDreamFieldWeb(fieldVisibilityDreamId, fieldId, patch)}
          onClose={() => setFieldVisibilityDreamId(null)}
        />
      )}
      {paneLooksTargetId != null &&
        (() => {
          const pane = panes.find((p) => p.id === paneLooksTargetId);
          if (!pane) return null;
          return (
            <NodeFieldVisibilityPopover
              title={pane.title || "Pane"}
              onClose={() => setPaneLooksTargetId(null)}
              looks={{
                scalePercent: null,
                onScaleChange: () => {},
                hideSize: true,
                color: {
                  value: pane.color,
                  onChange: (color) => {
                    const next = color ?? "#38bdf8";
                    updatePaneColor(pane.id, next);
                    setPanes((prev) => prev.map((p) => (p.id === pane.id ? { ...p, color: next } : p)));
                  },
                },
                opacity: {
                  valuePercent: Math.round(pane.opacity * 100),
                  onChange: (percent) => {
                    const next = percent / 100;
                    updatePaneOpacity(pane.id, next);
                    setPanes((prev) => prev.map((p) => (p.id === pane.id ? { ...p, opacity: next } : p)));
                  },
                },
                headerStyle: {
                  fontSize: pane.headerFontSize,
                  onFontSizeChange: (px) => {
                    updatePaneHeaderFontSize(pane.id, px);
                    setPanes((prev) => prev.map((p) => (p.id === pane.id ? { ...p, headerFontSize: px } : p)));
                  },
                  textColor: pane.headerColor,
                  onTextColorChange: (color) => {
                    updatePaneHeaderColor(pane.id, color);
                    setPanes((prev) => prev.map((p) => (p.id === pane.id ? { ...p, headerColor: color } : p)));
                  },
                },
              }}
            />
          );
        })()}
    </div>
  );
}

export function DreamWebPage({ onNavigate }: { onNavigate: (view: View) => void }) {
  return (
    <ReactFlowProvider>
      <DreamWebInner onNavigate={onNavigate} />
    </ReactFlowProvider>
  );
}
