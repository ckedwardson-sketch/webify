// src/pages/GoalWebPage.tsx
import { useEffect, useMemo, useState } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Node,
  NodeChange,
  Background,
  Panel,
  Viewport,
  applyNodeChanges,
  useReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  fetchProjectsForGoal,
  fetchAllProjects,
  addProject,
  updateProjectGoalId,
} from "../db/projects";
import { fetchGoal } from "../db/goals";
import {
  fetchProgressNodesForGoal,
  fetchProgressNodesForProjectsOfGoal,
  addProgressNode,
  updateProgressPosition,
} from "../db/progress";
import {
  fetchResponsibilitiesForGoal,
  fetchResponsibilities,
  fetchAllCompletions,
  addResponsibility,
  linkResponsibilityToGoal,
  unlinkResponsibilityFromGoal,
} from "../db/responsibilities";
import { consistencyPercent, daysPerWeek as daysPerWeekFor } from "../responsibilities/scheduling";
import { fetchViewport, saveViewport } from "../db/viewports";
import { fetchBookmarksForGoal, addBookmark, deleteBookmark, GoalWebBookmark } from "../db/goalWebBookmarks";
import { Goal, Project } from "../types/project";
import { ProgressNode as ProgressNodeModel } from "../types/models";
import { Responsibility, ResponsibilityCompletion, DailySchedule } from "../types/responsibility";
import { ProgressNode as ProgressNodeView } from "../components/ProgressGraphNodes";
import { View } from "../types/nav";
import { Breadcrumb } from "../components/Breadcrumb";
import { WebControls } from "../components/WebControls";
import { useTheme } from "../theme/ThemeContext";
import "./Page.css";
import "./GoalWebPage.css";

const projectNodeId = (id: number) => `pr-${id}`;
const parseProjectNodeId = (nodeId: string) => Number(nodeId.slice(3));
const taskNodeId = (id: number) => `tk-${id}`;
const parseTaskNodeId = (nodeId: string) => Number(nodeId.slice(3));
const respNodeId = (id: number) => `rs-${id}`;
const parseRespNodeId = (nodeId: string) => Number(nodeId.slice(3));
const GOAL_NODE_ID = "goal-end";
const NEW_RESP_SENTINEL = "__new__";

const GOAL_NODE_POS = { x: -260, y: -40 };
const GOAL_TASKS_BASE = { x: -260, y: 110 };
const RESPONSIBILITIES_BASE = { x: -260, y: 420 };
const PROJECT_TASKS_Y_OFFSET = 120;

// Cascading grid, same idea as the old Progress Web's positionForIndex —
// just enough spread that new items never land exactly on top of each
// other. Used for project cards (world coords) and, offset from an
// owner's base, for that owner's own tasks (local/relative coords).
function gridPosition(index: number, colWidth: number, rowHeight: number, perRow: number): { x: number; y: number } {
  const col = index % perRow;
  const row = Math.floor(index / perRow);
  return { x: col * colWidth, y: row * rowHeight };
}

// The one fixed, non-draggable, non-deletable node every goal's web
// starts with: its own goals text — a live read of the goal's own goals
// field, not a DB row.
function GoalSummaryNode({ data }: { data: { goals: string } }) {
  const { theme } = useTheme();
  return (
    <div
      style={{
        width: "180px",
        minHeight: "90px",
        borderRadius: "14px",
        border: `2px dashed ${theme.accent}`,
        background: "rgba(0,0,0,0.35)",
        color: "#ffffff",
        padding: "10px 12px",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        gap: "4px",
        cursor: "pointer",
      }}
      title="Goal's own goals — click to edit on the goal page"
    >
      <span style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.04em", color: theme.accent }}>
        🎯 GOAL
      </span>
      <span
        style={{
          fontSize: "12px",
          overflow: "hidden",
          display: "-webkit-box",
          WebkitLineClamp: 4,
          WebkitBoxOrient: "vertical",
        }}
      >
        {data.goals || "No goals written yet — click to add some."}
      </span>
    </div>
  );
}

// One card per project linked to this goal — click opens the project,
// the small ✕ detaches it from the goal (the project itself isn't
// deleted, just unlinked, same as every other detach-not-destroy flow
// in this app), and the small + adds a task owned by this project
// (rather than the goal directly) — the replacement for the old global
// "which owner?" dropdown in the add panel (see item 1's design note on
// handleAddTask below): adding a project-scoped task is now something
// you do right at the project it belongs to.
function ProjectCardNode({
  data,
}: {
  data: { name: string; needsDoing: string; onUnlink: () => void; onAddTask: () => void };
}) {
  const { theme } = useTheme();
  return (
    <div
      style={{
        width: "180px",
        minHeight: "84px",
        borderRadius: "12px",
        border: `2px solid ${theme.goalProjectNodeOutlineColor}`,
        background: theme.goalProjectNodeBackground,
        color: "#ffffff",
        padding: "9px 11px",
        boxSizing: "border-box",
        cursor: "pointer",
        boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
        position: "relative",
      }}
    >
      <button
        onClick={(e) => {
          e.stopPropagation();
          data.onAddTask();
        }}
        title="Add a task to this project"
        style={{
          position: "absolute",
          top: 4,
          left: 4,
          border: "none",
          background: "rgba(0,0,0,0.3)",
          color: "#fff",
          borderRadius: "4px",
          width: 16,
          height: 16,
          lineHeight: "16px",
          fontSize: "11px",
          cursor: "pointer",
          padding: 0,
        }}
      >
        +
      </button>
      <button
        onClick={(e) => {
          e.stopPropagation();
          data.onUnlink();
        }}
        title="Detach from this goal"
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
      <div
        style={{
          fontWeight: 700,
          fontSize: "13px",
          marginBottom: "4px",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          paddingRight: "18px",
        }}
      >
        📁 {data.name}
      </div>
      <div
        style={{
          fontSize: "11px",
          opacity: 0.85,
          overflow: "hidden",
          display: "-webkit-box",
          WebkitLineClamp: 3,
          WebkitBoxOrient: "vertical",
        }}
      >
        {data.needsDoing || "No details yet."}
      </div>
    </div>
  );
}

export interface ResponsibilityCardData {
  name: string;
  description: string;
  consistencyPct: number | null; // null = not meaningful (yearly) — see responsibilities/scheduling.ts
  daysPerWeek: number | null;
  taskTimeHours?: number;
  onUnlink: () => void;
}

// One card per responsibility linked to this goal — click opens the
// responsibility on its own page, ✕ unlinks it (never deletes it).
// Packs in the 4 extra bits items 3-6 asked for (consistency, days/wk,
// task time, description) as one compact stat row + a short clamp,
// rather than growing into a second detail page.
function ResponsibilityCardNode({ data }: { data: ResponsibilityCardData }) {
  const stats: string[] = [];
  if (data.consistencyPct !== null) stats.push(`${data.consistencyPct}%`);
  if (data.daysPerWeek !== null) stats.push(`${data.daysPerWeek}d/wk`);
  if (data.taskTimeHours) stats.push(`${data.taskTimeHours}h`);

  return (
    <div
      style={{
        width: "170px",
        minHeight: "104px",
        borderRadius: "10px",
        border: "2px solid #f59e0b",
        background: "#78350f",
        color: "#ffffff",
        padding: "8px 10px",
        boxSizing: "border-box",
        cursor: "pointer",
        boxShadow: "0 3px 8px rgba(0,0,0,0.3)",
        position: "relative",
        display: "flex",
        flexDirection: "column",
        gap: "5px",
      }}
    >
      <button
        onClick={(e) => {
          e.stopPropagation();
          data.onUnlink();
        }}
        title="Unlink from this goal"
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

      <span
        style={{
          fontSize: "12px",
          fontWeight: 700,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          paddingRight: "18px",
        }}
      >
        📋 {data.name}
      </span>

      {data.consistencyPct !== null && (
        <div style={{ height: "4px", borderRadius: "2px", background: "rgba(0,0,0,0.3)", overflow: "hidden" }}>
          <div
            style={{
              height: "100%",
              width: `${data.consistencyPct}%`,
              background: data.consistencyPct >= 70 ? "#4ade80" : data.consistencyPct >= 40 ? "#facc15" : "#f87171",
            }}
            title={`${data.consistencyPct}% checked off in the last 30 days`}
          />
        </div>
      )}

      {stats.length > 0 && (
        <span style={{ fontSize: "10px", opacity: 0.85 }} title="Consistency · days/week · task duration">
          {stats.join(" · ")}
        </span>
      )}

      <span
        style={{
          fontSize: "10px",
          opacity: 0.75,
          overflow: "hidden",
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
        }}
      >
        {data.description || "No description yet."}
      </span>
    </div>
  );
}

const nodeTypes = {
  goalNode: GoalSummaryNode,
  projectNode: ProjectCardNode,
  taskNode: ProgressNodeView,
  responsibilityNode: ResponsibilityCardNode,
};

function GoalWebInner({ goalId, onNavigate }: { goalId: number; onNavigate: (view: View) => void }) {
  const { theme } = useTheme();
  const { setViewport, getViewport } = useReactFlow();
  const [goal, setGoal] = useState<Goal | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<ProgressNodeModel[]>([]);
  const [responsibilities, setResponsibilities] = useState<Responsibility[]>([]);
  const [completions, setCompletions] = useState<ResponsibilityCompletion[]>([]);
  const [unclaimedProjects, setUnclaimedProjects] = useState<Project[]>([]);
  const [unclaimedResponsibilities, setUnclaimedResponsibilities] = useState<Responsibility[]>([]);
  const [bookmarks, setBookmarks] = useState<GoalWebBookmark[]>([]);
  const [initialViewport, setInitialViewport] = useState<Viewport | null>(null);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [loading, setLoading] = useState(true);
  const [creatingProject, setCreatingProject] = useState(false);
  const [showAddPanel, setShowAddPanel] = useState(false);
  const [showBookmarks, setShowBookmarks] = useState(false);
  const [linkProjectChoice, setLinkProjectChoice] = useState("");
  // "" = nothing picked, NEW_RESP_SENTINEL = "add new" picked, else a
  // Responsibility id — the single dropdown drives which the button
  // below does (see handleRespAction).
  const [respChoice, setRespChoice] = useState("");
  const [creatingResp, setCreatingResp] = useState(false);

  const scopeKey = `goal-web:${goalId}`;

  const load = () => {
    Promise.all([
      fetchGoal(goalId),
      fetchProjectsForGoal(goalId),
      fetchProgressNodesForGoal(goalId),
      fetchProgressNodesForProjectsOfGoal(goalId),
      fetchResponsibilitiesForGoal(goalId),
      fetchAllCompletions(),
      fetchAllProjects(),
      fetchResponsibilities(),
      fetchBookmarksForGoal(goalId),
      fetchViewport(scopeKey),
    ]).then(
      ([
        g,
        goalProjects,
        goalTasks,
        projectTasks,
        goalResps,
        allCompletions,
        allProjects,
        allResps,
        goalBookmarks,
        viewport,
      ]) => {
        setGoal(g);
        setProjects(goalProjects);
        setTasks([...goalTasks, ...projectTasks]);
        setResponsibilities(goalResps);
        setCompletions(allCompletions);
        setUnclaimedProjects(allProjects.filter((p) => p.goalId === null));
        setUnclaimedResponsibilities(allResps.filter((r) => !r.goalIds.includes(goalId)));
        setBookmarks(goalBookmarks);
        setInitialViewport(viewport);
        setLoading(false);
      }
    );
  };

  useEffect(load, [goalId]);

  const projectById = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);

  // Every project card's world position, keyed by project id — tasks
  // owned by that project render relative to this, and dragging a task
  // is saved back relative to it too (see onNodeDragStop).
  const projectBases = useMemo(() => {
    const map = new Map<number, { x: number; y: number }>();
    projects.forEach((p, i) => map.set(p.id, gridPosition(i, 260, 360, 4)));
    return map;
  }, [projects]);

  const taskOwnerBase = (task: ProgressNodeModel): { x: number; y: number } => {
    if (task.projectId != null) {
      const base = projectBases.get(task.projectId) ?? { x: 0, y: 0 };
      return { x: base.x, y: base.y + PROJECT_TASKS_Y_OFFSET };
    }
    return GOAL_TASKS_BASE;
  };

  useEffect(() => {
    const goalNode: Node = {
      id: GOAL_NODE_ID,
      type: "goalNode",
      position: GOAL_NODE_POS,
      draggable: false,
      deletable: false,
      data: { goals: goal?.goals ?? "" },
    };

    const projectNodes: Node[] = projects.map((project) => ({
      id: projectNodeId(project.id),
      type: "projectNode",
      position: projectBases.get(project.id) ?? { x: 0, y: 0 },
      draggable: false,
      data: {
        name: project.name,
        needsDoing: project.needsDoing,
        onUnlink: () => updateProjectGoalId(project.id, null).then(load),
        onAddTask: () => handleAddTask(project.id),
      },
    }));

    const responsibilityNodes: Node[] = responsibilities.map((resp, i) => ({
      id: respNodeId(resp.id),
      type: "responsibilityNode",
      position: {
        x: RESPONSIBILITIES_BASE.x + gridPosition(i, 190, 130, 5).x,
        y: RESPONSIBILITIES_BASE.y + gridPosition(i, 190, 130, 5).y,
      },
      draggable: false,
      data: {
        name: resp.name,
        description: resp.description,
        consistencyPct: consistencyPercent(resp, completions),
        daysPerWeek: daysPerWeekFor(resp),
        taskTimeHours: resp.category === "daily" ? (resp.schedule as DailySchedule).taskTimeHours : undefined,
        onUnlink: () => unlinkResponsibilityFromGoal(resp.id, goalId).then(load),
      } satisfies ResponsibilityCardData,
    }));

    const taskNodes: Node[] = tasks.map((task) => {
      const base = taskOwnerBase(task);
      return {
        id: taskNodeId(task.id),
        type: "taskNode",
        position: { x: base.x + task.posX, y: base.y + task.posY },
        data: {
          category: task.category,
          shortDescription: task.shortDescription,
          difficulty: task.difficulty,
          isComplete: task.isComplete,
          isRead: task.isRead,
          imageData: task.imageData,
        },
      };
    });

    setNodes([goalNode, ...projectNodes, ...responsibilityNodes, ...taskNodes]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goal, projects, responsibilities, completions, tasks, projectBases]);

  const onNodesChange = (changes: NodeChange[]) => {
    setNodes((nds) => applyNodeChanges(changes.filter((c) => c.type !== "remove"), nds));
  };

  const taskById = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);

  const onNodeDragStop = (_: MouseEvent | TouchEvent, node: Node) => {
    if (!node.id.startsWith("tk-")) return;
    const id = parseTaskNodeId(node.id);
    const task = taskById.get(id);
    if (!task) return;
    const base = taskOwnerBase(task);
    const localX = node.position.x - base.x;
    const localY = node.position.y - base.y;
    updateProgressPosition(id, localX, localY);
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, posX: localX, posY: localY } : t)));
  };

  const onNodeClick = (_: React.MouseEvent, node: Node) => {
    if (node.id === GOAL_NODE_ID) {
      onNavigate({ type: "goal-detail", goalId });
      return;
    }
    if (node.id.startsWith("pr-")) {
      const id = parseProjectNodeId(node.id);
      if (projectById.has(id)) onNavigate({ type: "project-detail", projectId: id });
      return;
    }
    if (node.id.startsWith("rs-")) {
      const id = parseRespNodeId(node.id);
      onNavigate({ type: "responsibility-detail", responsibilityId: id });
      return;
    }
    if (node.id.startsWith("tk-")) {
      const id = parseTaskNodeId(node.id);
      const task = taskById.get(id);
      if (!task) return;
      onNavigate({
        type: "progress-node-detail",
        nodeId: id,
        projectId: task.projectId ?? undefined,
        goalId: task.goalId ?? undefined,
      });
    }
  };

  const handleAddProject = async () => {
    setCreatingProject(true);
    try {
      const id = await addProject(goal?.dreamId ?? null, "New Project");
      await updateProjectGoalId(id, goalId);
      onNavigate({ type: "project-detail", projectId: id });
    } finally {
      setCreatingProject(false);
    }
  };

  const handleLinkProject = async () => {
    if (!linkProjectChoice) return;
    await updateProjectGoalId(Number(linkProjectChoice), goalId);
    setLinkProjectChoice("");
    load();
  };

  // Called from either the add panel's plain "+ Task" (goal-owned — no
  // owner picker anymore, see item 1) or a project card's own "+" (that
  // project owns it instead).
  const handleAddTask = async (projectId?: number) => {
    const owner = projectId !== undefined ? { projectId } : { goalId };
    const countForOwner = tasks.filter((t) =>
      projectId !== undefined ? t.projectId === projectId : t.goalId === goalId && t.projectId == null
    ).length;
    const { x, y } = gridPosition(countForOwner, 110, 110, 5);
    const id = await addProgressNode(owner, x, y);
    onNavigate({
      type: "progress-node-detail",
      nodeId: id,
      projectId,
      goalId: projectId === undefined ? goalId : undefined,
    });
  };

  // One dropdown, one button that does whichever of the two things the
  // dropdown selection calls for — picking an existing responsibility
  // links it; picking "+ Add new" creates one (named generically, same
  // "create then rename" convention as +New Project/+New Goal) and
  // links that instead.
  const handleRespAction = async () => {
    if (respChoice === NEW_RESP_SENTINEL) {
      setCreatingResp(true);
      try {
        const id = await addResponsibility("New Responsibility", "daily");
        await linkResponsibilityToGoal(id, goalId);
        setRespChoice("");
        onNavigate({ type: "responsibility-detail", responsibilityId: id });
      } finally {
        setCreatingResp(false);
      }
      return;
    }
    if (!respChoice) return;
    await linkResponsibilityToGoal(Number(respChoice), goalId);
    setRespChoice("");
    load();
  };

  // useReactFlow()'s getViewport() throws if called before the canvas
  // has ever rendered a frame — shouldn't happen here since this is
  // only reachable from a click after load, but guarded rather than
  // trusted.
  const getCurrentViewportSafely = (): Viewport => {
    try {
      return getViewport();
    } catch {
      return { x: 0, y: 0, zoom: 1 };
    }
  };

  const handleSaveBookmark = async () => {
    const label = window.prompt("Name this saved zoom (e.g. a project you're focused on):");
    if (!label || !label.trim()) return;
    const vp = getCurrentViewportSafely();
    await addBookmark(goalId, label.trim(), vp.x, vp.y, vp.zoom);
    load();
  };

  const handleJumpToBookmark = (bookmark: GoalWebBookmark) => {
    setViewport({ x: bookmark.x, y: bookmark.y, zoom: bookmark.zoom }, { duration: 400 });
  };

  const handleDeleteBookmark = async (id: number) => {
    await deleteBookmark(id);
    load();
  };

  const handleMoveEnd = (_: unknown, viewport: Viewport) => {
    saveViewport(scopeKey, viewport);
  };

  if (loading) {
    return (
      <div className="page">
        <p className="page-text">Loading Goal Web…</p>
      </div>
    );
  }

  if (!goal) {
    return (
      <div className="page">
        <p className="page-text">Goal not found.</p>
      </div>
    );
  }

  return (
    <div className="goal-web-shell">
      <div className="goal-web-canvas-area">
        <Breadcrumb
          crumbs={[
            { label: "Goals", onClick: () => onNavigate({ type: "goals-home" }) },
            { label: goal.name, onClick: () => onNavigate({ type: "goal-detail", goalId }) },
            { label: "Goal Web" },
          ]}
        />

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
          <h1 style={{ margin: 0, fontSize: "22px" }}>{goal.name} — Goal Web</h1>
          <div style={{ display: "flex", gap: "8px" }}>
            <button className="add-button secondary" onClick={() => setShowBookmarks((v) => !v)}>
              📍 Zooms ({bookmarks.length})
            </button>
            <button className="add-button" onClick={() => setShowAddPanel((v) => !v)}>
              + Add
            </button>
          </div>
        </div>

        <div className="goal-web-canvas">
          {projects.length === 0 && tasks.length === 0 && responsibilities.length === 0 && (
            <div className="goal-web-empty-hint">
              Nothing here yet — use "+ Add" to attach a project, task, or responsibility.
            </div>
          )}

          {showAddPanel && (
            <div className="goal-web-add-panel">
              <div className="goal-web-add-panel-row">
                <span className="goal-web-add-panel-label">PROJECTS</span>
                <button className="add-button secondary" onClick={handleAddProject} disabled={creatingProject}>
                  {creatingProject ? "Adding…" : "+ New project"}
                </button>
                {unclaimedProjects.length > 0 && (
                  <div style={{ display: "flex", gap: "4px" }}>
                    <select
                      className="inline-add-input"
                      style={{ marginBottom: 0, flex: 1 }}
                      value={linkProjectChoice}
                      onChange={(e) => setLinkProjectChoice(e.target.value)}
                    >
                      <option value="">Link existing…</option>
                      {unclaimedProjects.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                    <button className="add-button secondary" onClick={handleLinkProject} disabled={!linkProjectChoice}>
                      Link
                    </button>
                  </div>
                )}
              </div>

              <div className="goal-web-add-panel-row">
                <span className="goal-web-add-panel-label">TASKS</span>
                <button className="add-button secondary" onClick={() => handleAddTask()}>
                  + Task (this goal)
                </button>
                <span style={{ fontSize: "10px", opacity: 0.65 }}>
                  For a task under a specific project, use the + on that project's card instead.
                </span>
              </div>

              <div className="goal-web-add-panel-row">
                <span className="goal-web-add-panel-label">RESPONSIBILITIES</span>
                <div style={{ display: "flex", gap: "4px" }}>
                  <select
                    className="inline-add-input"
                    style={{ marginBottom: 0, flex: 1 }}
                    value={respChoice}
                    onChange={(e) => setRespChoice(e.target.value)}
                  >
                    <option value="">Choose…</option>
                    <option value={NEW_RESP_SENTINEL}>+ Add new</option>
                    {unclaimedResponsibilities.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                  <button
                    className="add-button secondary"
                    onClick={handleRespAction}
                    disabled={!respChoice || creatingResp}
                  >
                    {creatingResp ? "Adding…" : respChoice === NEW_RESP_SENTINEL ? "New" : "Link"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {showBookmarks && (
            <div className="goal-web-bookmarks-panel">
              <button className="add-button secondary" onClick={handleSaveBookmark}>
                + Save current zoom
              </button>
              {bookmarks.length === 0 && (
                <span style={{ fontSize: "11px", opacity: 0.7 }}>No saved zooms yet.</span>
              )}
              {bookmarks.map((b) => (
                <div key={b.id} className="goal-web-bookmark-row">
                  <button className="goal-web-bookmark-button" onClick={() => handleJumpToBookmark(b)}>
                    {b.label}
                  </button>
                  <button className="goal-web-bookmark-delete" onClick={() => handleDeleteBookmark(b.id)} title="Delete">
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}

          <ReactFlow
            nodes={nodes}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onNodeDragStop={onNodeDragStop}
            onNodeClick={onNodeClick}
            onMoveEnd={handleMoveEnd}
            defaultViewport={initialViewport ?? undefined}
            fitView={!initialViewport}
            minZoom={0.05}
            maxZoom={4}
            proOptions={{ hideAttribution: true }}
            deleteKeyCode={null}
          >
            <Panel position="top-right" className="goal-web-canvas-hint" style={{ marginTop: showAddPanel ? 300 : 0 }}>
              Everything linked to this goal — projects, their tasks, direct tasks, and responsibilities —
              lives on this one canvas. Zoom out to see it all; save a zoom to jump straight back to a
              cluster you're focused on.
            </Panel>
            <Background color="#64748b" bgColor={theme.goalWebBackground} gap={16} />
            <WebControls />
          </ReactFlow>
        </div>
      </div>
    </div>
  );
}

export function GoalWebPage({ goalId, onNavigate }: { goalId: number; onNavigate: (view: View) => void }) {
  return (
    <ReactFlowProvider>
      <GoalWebInner goalId={goalId} onNavigate={onNavigate} />
    </ReactFlowProvider>
  );
}
