// src/pages/GoalWebPage.tsx
import { useEffect, useMemo, useState } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Node,
  Edge,
  Connection,
  NodeChange,
  Background,
  Panel,
  Viewport,
  ConnectionMode,
  ConnectionLineType,
  ViewportPortal,
  applyNodeChanges,
  useReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  fetchProjectsForGoal,
  fetchAllProjects,
  addProject,
  updateProjectGoalId,
  updateProjectWebPosition,
  fetchWidgetsForProject,
  fetchWidgetsForWeb,
  addWebWidget,
  updateWebWidgetPosition,
  updateWebWidgetSize,
  deleteWidget,
} from "../db/projects";
import { fetchWidgetsForGoal, updateGoalWebScale } from "../db/goals";
import { fetchFieldLayout, fetchFreetextFields, updateFieldStyle, FieldLayoutRow, FieldStylePatch, FreetextField } from "../db/fieldLayout";
import { buildNodeCardTextItems, widgetsVisibleOnWeb } from "../theme/nodeCardFields";
import { mergeFieldStylePatch } from "../rearrange/fieldStyle";
import { NodeWidgetOverlay } from "../components/NodeWidgetOverlay";
import { NodeFieldVisibilityPopover } from "../components/NodeFieldVisibilityPopover";
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
  updateResponsibilityWebPosition,
} from "../db/responsibilities";
import { consistencyPercent, daysPerWeek as daysPerWeekFor } from "../responsibilities/scheduling";
import { fetchViewport, saveViewport } from "../db/viewports";
import { fetchBookmarksForGoal, addBookmark, deleteBookmark, GoalWebBookmark } from "../db/goalWebBookmarks";
import { fetchGoalWebLinks, addGoalWebLink, removeGoalWebLink, GoalWebLink } from "../db/goalWebLinks";
import {
  fetchNoteWebLinks,
  addNoteWebLink,
  removeNoteWebLink,
  updateNoteWebLinkPosition,
  fetchNotePagesForPicker,
  NoteWebLink,
  NotePickerOption,
} from "../db/noteWebLinks";
import { addPage } from "../db/notes";
import { WIDGET_TYPE_LABELS } from "../rearrange/AddFieldMenu";
import { computeGoalCluster, nextTaskGridPosition, nodeBoxFor } from "../webGraph/goalCluster";
import { Goal, Project, ProjectWidget, ProjectWidgetType } from "../types/project";
import { ProgressNode as ProgressNodeModel } from "../types/models";
import { Responsibility, ResponsibilityCompletion, DailySchedule } from "../types/responsibility";
import { ProgressNode as ProgressNodeView } from "../components/ProgressGraphNodes";
import { GoalSummaryNode, ProjectCardNode, ResponsibilityCardNode, ResponsibilityCardData } from "../components/GoalGraphNodes";
import { NoteWebNode } from "../components/NoteWebNode";
import { WebWidgetNode, WEB_WIDGET_DEFAULT_WIDTH, WEB_WIDGET_DEFAULT_HEIGHT } from "../components/WebWidgetNode";
import { AngleEdge, anchorPoint, parseAngleHandleId, snapToAnchor } from "../components/DreamGraphNodes";
import { angleFromDirection } from "../theme/nodeBoundary";
import { View } from "../types/nav";
import { Breadcrumb } from "../components/Breadcrumb";
import { WebControls } from "../components/WebControls";
import { LaborLegend } from "../components/LaborLegend";
import { OutputWebNode } from "../components/OutputWebNode";
import { OutputEditorModal } from "../components/OutputEditorModal";
import { fetchOutputsForTasks, deleteOutput, updateOutputPosition, Output } from "../db/outputs";
import { HintTooltip } from "../components/HintTooltip";
import { useTheme } from "../theme/ThemeContext";
import { parseDecals } from "../theme/decals";
import { DecalLayer } from "../theme/DecalLayer";
import { usePageBackground, pageSurfaceStyle } from "../theme/PageBackgroundContext";
import { useMobileLayout } from "../theme/useMobileLayout";
import "./Page.css";
import "./GoalWebPage.css";

const projectNodeId = (id: number) => `pr-${id}`;
const parseProjectNodeId = (nodeId: string) => Number(nodeId.slice(3));
const taskNodeId = (id: number) => `tk-${id}`;
const parseTaskNodeId = (nodeId: string) => Number(nodeId.slice(3));
const respNodeId = (id: number) => `rs-${id}`;
const parseRespNodeId = (nodeId: string) => Number(nodeId.slice(3));
const noteNodeId = (id: number) => `nt-${id}`;
const parseNoteNodeId = (nodeId: string) => Number(nodeId.slice(3));
const outputNodeId = (id: number) => `op-${id}`;
const widgetNodeId = (id: number) => `wg-${id}`;
const parseWidgetNodeId = (nodeId: string) => Number(nodeId.slice(3));
const GOAL_NODE_ID = "goal-end";
const NEW_RESP_SENTINEL = "__new__";
const NEW_NOTE_SENTINEL = "__new__";

const nodeTypes = {
  goalNode: GoalSummaryNode,
  projectNode: ProjectCardNode,
  taskNode: ProgressNodeView,
  responsibilityNode: ResponsibilityCardNode,
  noteNode: NoteWebNode,
  outputNode: OutputWebNode,
  widgetNode: WebWidgetNode,
};
const edgeTypes = { angleEdge: AngleEdge };

function GoalWebInner({ goalId, onNavigate }: { goalId: number; onNavigate: (view: View) => void }) {
  const { theme } = useTheme();
  const decals = useMemo(() => parseDecals(theme.decals), [theme.decals]);
  const { overrides: pageBgOverrides } = usePageBackground();
  const mobile = useMobileLayout();
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
  const [webLinks, setWebLinks] = useState<GoalWebLink[]>([]);
  const [showSizeControl, setShowSizeControl] = useState(false);
  // "Show on web" field config + widget rows for the goal card and every
  // linked project card (see FieldStylePopover.tsx's "On the web"
  // section / theme/nodeCardFields.ts) — fetched alongside everything
  // else in load() rather than lazily per-node.
  const [goalFields, setGoalFields] = useState<FieldLayoutRow[]>([]);
  const [projectFieldsById, setProjectFieldsById] = useState<Map<number, FieldLayoutRow[]>>(new Map());
  const [freetextById, setFreetextById] = useState<Map<number, FreetextField>>(new Map());
  const [goalWidgets, setGoalWidgets] = useState<ProjectWidget[]>([]);
  const [projectWidgetsById, setProjectWidgetsById] = useState<Map<number, ProjectWidget[]>>(new Map());
  const [openWidget, setOpenWidget] = useState<ProjectWidget | null>(null);
  const [fieldVisibilityTarget, setFieldVisibilityTarget] = useState<
    { category: "goal"; ownerId: number } | { category: "project"; ownerId: number } | null
  >(null);
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
  const [noteLinks, setNoteLinks] = useState<NoteWebLink[]>([]);
  const [notePickerOptions, setNotePickerOptions] = useState<NotePickerOption[]>([]);
  const [noteChoice, setNoteChoice] = useState("");
  const [creatingNote, setCreatingNote] = useState(false);
  const [outputs, setOutputs] = useState<Output[]>([]);
  const [editingOutput, setEditingOutput] = useState<Output | null>(null);
  // Free-floating widgets placed directly on this canvas (see
  // components/WebWidgetNode.tsx) — same project_widgets rows as the
  // grid, just with web_type/web_owner_id set instead of project_id/
  // goal_id.
  const [webWidgets, setWebWidgets] = useState<ProjectWidget[]>([]);
  const [widgetChoice, setWidgetChoice] = useState<ProjectWidgetType | "">("");

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
      fetchGoalWebLinks(goalId),
      fetchNoteWebLinks("goal", goalId),
      fetchNotePagesForPicker(),
      fetchWidgetsForWeb("goal", goalId),
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
        links,
        noteWebLinks,
        notePages,
        webWidgetRows,
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
        setWebLinks(links);
        setNoteLinks(noteWebLinks);
        setNotePickerOptions(notePages);
        setWebWidgets(webWidgetRows);
        setLoading(false);

        loadWebFieldConfig(goalProjects);
      }
    );
  };

  const loadWebFieldConfig = async (currentProjects: Project[]) => {
    const [gFields, pFieldLists, gWidgets, pWidgetLists] = await Promise.all([
      fetchFieldLayout("goal", goalId),
      Promise.all(currentProjects.map((p) => fetchFieldLayout("project", p.id))),
      fetchWidgetsForGoal(goalId),
      Promise.all(currentProjects.map((p) => fetchWidgetsForProject(p.id))),
    ]);
    setGoalFields(gFields);
    setProjectFieldsById(new Map(currentProjects.map((p, i) => [p.id, pFieldLists[i]])));
    setGoalWidgets(gWidgets);
    setProjectWidgetsById(new Map(currentProjects.map((p, i) => [p.id, pWidgetLists[i]])));

    const freetextIds = [...gFields, ...pFieldLists.flat()]
      .filter((f) => f.fieldType === "freetext" && f.refId !== null)
      .map((f) => f.refId!);
    setFreetextById(await fetchFreetextFields(freetextIds));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goalId]);

  const loadOutputs = () => {
    fetchOutputsForTasks(tasks.map((t) => t.id)).then(setOutputs);
  };

  useEffect(() => {
    loadOutputs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks]);

  const projectById = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);

  const scale = goal?.webScale ?? 1;

  // Shared with DreamWebPage's "full" view (see webGraph/goalCluster.ts)
  // — both pages compute positions from the exact same function so a
  // goal's web looks pixel-identical wherever it's rendered.
  const cluster = useMemo(
    () =>
      goal
        ? computeGoalCluster(goal, projects, tasks, responsibilities, scale, theme.goalClusterDirection as "horizontal" | "vertical")
        : null,
    [goal, projects, tasks, responsibilities, scale, theme.goalClusterDirection]
  );

  const handleUpdateFieldWeb = (
    category: "goal" | "project",
    ownerId: number,
    fieldId: number,
    patch: FieldStylePatch
  ) => {
    if (category === "goal") {
      setGoalFields((prev) => prev.map((f) => (f.id === fieldId ? mergeFieldStylePatch(f, patch) : f)));
    } else {
      setProjectFieldsById((prev) => {
        const next = new Map(prev);
        const list = next.get(ownerId);
        if (list) next.set(ownerId, list.map((f) => (f.id === fieldId ? mergeFieldStylePatch(f, patch) : f)));
        return next;
      });
    }
    updateFieldStyle(fieldId, patch);
  };

  const handleOpenWidget = (widget: ProjectWidget) => {
    const owner = widget.projectId != null ? { projectId: widget.projectId } : { goalId: widget.goalId! };
    if (widget.widgetType === "table") {
      onNavigate({ type: "project-table", widgetId: widget.id, ...owner });
    } else if (widget.widgetType === "journal") {
      onNavigate({ type: "project-journal", widgetId: widget.id, ...owner });
    } else if (widget.widgetType === "linkboard") {
      onNavigate({ type: "project-board", widgetId: widget.id, ...owner });
    } else {
      // photo / dock — no dedicated page, open inline instead of navigating away.
      setOpenWidget(widget);
    }
  };

  // Journal/linkboard floating widgets have no inline render on the
  // canvas (see WebWidgetNode.tsx) — clicking their "Open" button
  // navigates to the widget's existing page instead, same destination
  // handleOpenWidget above sends a grid widget to. Table opens its own
  // preview→page flow the same way. Photo/dock/costlog/calculator render
  // fully inline on the node itself, so they never call this.
  const handleOpenWebWidget = (widget: ProjectWidget) => {
    if (widget.widgetType === "table") {
      onNavigate({ type: "project-table", widgetId: widget.id, goalId });
    } else if (widget.widgetType === "journal") {
      onNavigate({ type: "project-journal", widgetId: widget.id, goalId });
    } else if (widget.widgetType === "linkboard") {
      onNavigate({ type: "project-board", widgetId: widget.id, goalId });
    }
  };

  useEffect(() => {
    if (!cluster) return;
    const goalNode: Node = {
      id: GOAL_NODE_ID,
      type: "goalNode",
      position: cluster.goalPos,
      draggable: false,
      deletable: false,
      data: {
        webFields: goal
          ? buildNodeCardTextItems(
              goalFields,
              freetextById,
              (type) =>
                type === "goals_text" ? goal.goals : type === "reasoning_text" ? goal.reasoning : type === "needs_doing_text" ? goal.needsDoing : undefined,
              (type) =>
                type === "estimated_start"
                  ? { start: goal.estimatedStartDate }
                  : type === "expected_range"
                  ? { start: goal.expectedDateStart, end: goal.expectedDateEnd }
                  : undefined
            )
          : [],
        widgets: widgetsVisibleOnWeb(goalFields) ? goalWidgets : [],
        onOpenWidget: handleOpenWidget,
      },
    };

    const projectNodes: Node[] = projects.map((project) => ({
      id: projectNodeId(project.id),
      type: "projectNode",
      position: cluster.projectPos.get(project.id) ?? { x: 0, y: 0 },
      deletable: false,
      data: {
        name: project.name,
        onUnlink: () => updateProjectGoalId(project.id, null).then(load),
        onAddTask: () => handleAddTask(project.id),
        webFields: buildNodeCardTextItems(
          projectFieldsById.get(project.id) ?? [],
          freetextById,
          (type) =>
            type === "goals_text" ? project.goals : type === "reasoning_text" ? project.reasoning : type === "needs_doing_text" ? project.needsDoing : undefined,
          (type) =>
            type === "estimated_start"
              ? { start: project.estimatedStartDate }
              : type === "expected_range"
              ? { start: project.expectedDateStart, end: project.expectedDateEnd }
              : undefined
        ),
        widgets: widgetsVisibleOnWeb(projectFieldsById.get(project.id) ?? [])
          ? projectWidgetsById.get(project.id) ?? []
          : [],
        onOpenWidget: handleOpenWidget,
      },
    }));

    const responsibilityNodes: Node[] = responsibilities.map((resp) => ({
      id: respNodeId(resp.id),
      type: "responsibilityNode",
      position: cluster.respPos.get(resp.id) ?? { x: 0, y: 0 },
      deletable: false,
      data: {
        name: resp.name,
        description: resp.description,
        consistencyPct: consistencyPercent(resp, completions),
        daysPerWeek: daysPerWeekFor(resp),
        taskTimeHours: resp.category === "daily" ? (resp.schedule as DailySchedule).taskTimeHours : undefined,
        onUnlink: () => unlinkResponsibilityFromGoal(resp.id, goalId).then(load),
      } satisfies ResponsibilityCardData,
    }));

    const taskNodes: Node[] = tasks.map((task) => ({
      id: taskNodeId(task.id),
      type: "taskNode",
      position: cluster.taskPos.get(task.id) ?? { x: 0, y: 0 },
      deletable: false,
      data: {
        category: task.category,
        shortDescription: task.shortDescription,
        difficulty: task.difficulty,
        isComplete: task.isComplete,
        isRead: task.isRead,
        imageData: task.imageData,
        cost: task.cost,
      },
    }));

    const noteNodes: Node[] = noteLinks.map((link) => ({
      id: noteNodeId(link.id),
      type: "noteNode",
      position: { x: link.posX, y: link.posY },
      deletable: false,
      data: {
        title: link.title,
        onRemove: () => removeNoteWebLink(link.id).then(load),
      },
    }));

    // Outputs have no pos of their own until a user drags one — until
    // then, cluster them in a small stagger just below/right of their
    // parent task's own current position (cluster.taskPos), same
    // "computed until moved" convention task/project/resp nodes use for
    // their own cluster placement.
    const outputsByTask = new Map<number, typeof outputs>();
    for (const o of outputs) {
      const list = outputsByTask.get(o.taskId) ?? [];
      list.push(o);
      outputsByTask.set(o.taskId, list);
    }
    const outputNodes: Node[] = outputs.map((o) => {
      let pos = { x: o.posX ?? 0, y: o.posY ?? 0 };
      if (o.posX === null || o.posY === null) {
        const taskPos = cluster?.taskPos.get(o.taskId) ?? { x: 0, y: 0 };
        const siblings = outputsByTask.get(o.taskId) ?? [];
        const index = siblings.findIndex((s) => s.id === o.id);
        pos = { x: taskPos.x + 90, y: taskPos.y + index * 60 };
      }
      return {
        id: outputNodeId(o.id),
        type: "outputNode",
        position: pos,
        deletable: false,
        data: {
          title: o.title,
          onOpen: () => setEditingOutput(o),
          onDelete: () => deleteOutput(o.id).then(loadOutputs),
        },
      };
    });

    const widgetNodes: Node[] = webWidgets.map((w) => ({
      id: widgetNodeId(w.id),
      type: "widgetNode",
      position: { x: w.posX ?? 0, y: w.posY ?? 0 },
      deletable: false,
      data: {
        widget: w,
        onDelete: () => deleteWidget(w.id).then(load),
        onResize: (width: number, height: number) => {
          updateWebWidgetSize(w.id, width, height);
          setWebWidgets((prev) => prev.map((x) => (x.id === w.id ? { ...x, width, height } : x)));
        },
        onOpen: () => handleOpenWebWidget(w),
      },
    }));

    setNodes([goalNode, ...projectNodes, ...responsibilityNodes, ...taskNodes, ...noteNodes, ...outputNodes, ...widgetNodes]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    cluster,
    goal,
    projects,
    responsibilities,
    completions,
    tasks,
    goalFields,
    projectFieldsById,
    freetextById,
    goalWidgets,
    projectWidgetsById,
    noteLinks,
    outputs,
    webWidgets,
  ]);

  const taskById = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);

  // A node's world position by its plain id string (same scheme
  // webLinks store their endpoints under) — used only for anchor-ring
  // math below, so a link can be resolved regardless of which of the
  // four node kinds it points at.
  const nodePosById = (id: string): { x: number; y: number } | null => {
    if (!cluster) return null;
    if (id === GOAL_NODE_ID) return cluster.goalPos;
    if (id.startsWith("pr-")) return cluster.projectPos.get(parseProjectNodeId(id)) ?? null;
    if (id.startsWith("rs-")) return cluster.respPos.get(parseRespNodeId(id)) ?? null;
    if (id.startsWith("tk-")) return cluster.taskPos.get(parseTaskNodeId(id)) ?? null;
    if (id.startsWith("nt-")) {
      const link = noteLinks.find((l) => noteNodeId(l.id) === id);
      return link ? { x: link.posX, y: link.posY } : null;
    }
    if (id.startsWith("op-")) {
      const o = outputs.find((out) => outputNodeId(out.id) === id);
      return o ? { x: o.posX ?? 0, y: o.posY ?? 0 } : null;
    }
    if (id.startsWith("wg-")) {
      const w = webWidgets.find((wid) => widgetNodeId(wid.id) === id);
      return w ? { x: w.posX ?? 0, y: w.posY ?? 0 } : null;
    }
    return null;
  };

  const edges: Edge[] = useMemo(() => {
    const result: Edge[] = [];
    for (const link of webLinks) {
      const sp = nodePosById(link.sourceNodeId);
      const tp = nodePosById(link.targetNodeId);
      if (!sp || !tp) continue;
      const ss = nodeBoxFor(link.sourceNodeId, taskById);
      const ts = nodeBoxFor(link.targetNodeId, taskById);
      const sCenter = { x: sp.x + ss.width / 2, y: sp.y + ss.height / 2 };
      const tCenter = { x: tp.x + ts.width / 2, y: tp.y + ts.height / 2 };
      const sourceAngle = link.sourceAngle ?? angleFromDirection(tCenter.x - sCenter.x, tCenter.y - sCenter.y);
      const targetAngle = link.targetAngle ?? angleFromDirection(sCenter.x - tCenter.x, sCenter.y - tCenter.y);
      const p1 = anchorPoint(sp, ss, "rectangle", sourceAngle);
      const p2 = anchorPoint(tp, ts, "rectangle", targetAngle);
      result.push({
        id: `wl-${link.id}`,
        source: link.sourceNodeId,
        target: link.targetNodeId,
        sourceHandle: `out-${snapToAnchor(sourceAngle)}`,
        targetHandle: `in-${snapToAnchor(targetAngle)}`,
        reconnectable: false,
        type: "angleEdge",
        data: { x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y },
        style: { stroke: theme.accent, strokeWidth: 2 },
      });
    }
    return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [webLinks, theme.accent, cluster, taskById]);

  const onNodesChange = (changes: NodeChange[]) => {
    setNodes((nds) => applyNodeChanges(changes.filter((c) => c.type !== "remove"), nds));
  };

  const taskOwnerBase = (task: ProgressNodeModel): { x: number; y: number } => {
    if (!cluster) return { x: 0, y: 0 };
    const pos = cluster.taskPos.get(task.id);
    if (!pos) return { x: 0, y: 0 };
    return { x: pos.x - task.posX * scale, y: pos.y - task.posY * scale };
  };

  const onNodeDragStop = (_: MouseEvent | TouchEvent, node: Node) => {
    if (node.id.startsWith("tk-")) {
      const id = parseTaskNodeId(node.id);
      const task = taskById.get(id);
      if (!task) return;
      const base = taskOwnerBase(task);
      const localX = (node.position.x - base.x) / scale;
      const localY = (node.position.y - base.y) / scale;
      updateProgressPosition(id, localX, localY);
      setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, posX: localX, posY: localY } : t)));
      return;
    }
    if (node.id.startsWith("pr-")) {
      const id = parseProjectNodeId(node.id);
      const project = projectById.get(id);
      const pos = cluster?.projectPos.get(id);
      if (!project || !pos) return;
      const base = { x: pos.x - (project.webPosX ?? 0) * scale, y: pos.y - (project.webPosY ?? 0) * scale };
      const localX = (node.position.x - base.x) / scale;
      const localY = (node.position.y - base.y) / scale;
      updateProjectWebPosition(id, localX, localY);
      setProjects((prev) => prev.map((p) => (p.id === id ? { ...p, webPosX: localX, webPosY: localY } : p)));
      return;
    }
    if (node.id.startsWith("rs-")) {
      const id = parseRespNodeId(node.id);
      const resp = responsibilities.find((r) => r.id === id);
      const pos = cluster?.respPos.get(id);
      if (!resp || !pos) return;
      const base = { x: pos.x - (resp.webPosX ?? 0) * scale, y: pos.y - (resp.webPosY ?? 0) * scale };
      const localX = (node.position.x - base.x) / scale;
      const localY = (node.position.y - base.y) / scale;
      updateResponsibilityWebPosition(id, localX, localY);
      setResponsibilities((prev) =>
        prev.map((r) => (r.id === id ? { ...r, webPosX: localX, webPosY: localY } : r))
      );
      return;
    }
    if (node.id.startsWith("nt-")) {
      const id = parseNoteNodeId(node.id);
      const { x, y } = node.position;
      updateNoteWebLinkPosition(id, x, y);
      setNoteLinks((prev) => prev.map((l) => (l.id === id ? { ...l, posX: x, posY: y } : l)));
      return;
    }
    if (node.id.startsWith("op-")) {
      const id = Number(node.id.slice(3));
      const { x, y } = node.position;
      updateOutputPosition(id, x, y);
      setOutputs((prev) => prev.map((o) => (o.id === id ? { ...o, posX: x, posY: y } : o)));
      return;
    }
    if (node.id.startsWith("wg-")) {
      const id = parseWidgetNodeId(node.id);
      const { x, y } = node.position;
      updateWebWidgetPosition(id, x, y);
      setWebWidgets((prev) => prev.map((w) => (w.id === id ? { ...w, posX: x, posY: y } : w)));
    }
  };

  const onConnect = (connection: Connection) => {
    if (!connection.source || !connection.target || connection.source === connection.target) return;
    const sourceAngle = parseAngleHandleId(connection.sourceHandle);
    const targetAngle = parseAngleHandleId(connection.targetHandle);
    addGoalWebLink(goalId, connection.source, connection.target, sourceAngle, targetAngle).then(load);
  };

  const onEdgesDelete = (deleted: Edge[]) => {
    for (const edge of deleted) {
      const id = Number(edge.id.slice(3));
      if (!Number.isNaN(id)) removeGoalWebLink(id).then(load);
    }
  };

  const onNodeClick = (event: React.MouseEvent, node: Node) => {
    if (node.id === GOAL_NODE_ID) {
      if (event.ctrlKey) {
        setFieldVisibilityTarget({ category: "goal", ownerId: goalId });
        return;
      }
      onNavigate({ type: "goal-detail", goalId });
      return;
    }
    if (node.id.startsWith("pr-")) {
      const id = parseProjectNodeId(node.id);
      if (event.ctrlKey) {
        if (projectById.has(id)) setFieldVisibilityTarget({ category: "project", ownerId: id });
        return;
      }
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
      return;
    }
    if (node.id.startsWith("nt-")) {
      const id = parseNoteNodeId(node.id);
      const link = noteLinks.find((l) => l.id === id);
      if (!link) return;
      onNavigate({ type: "notes", pageId: link.noteId });
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
    const { x, y } = nextTaskGridPosition(countForOwner);
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

  // Same one-dropdown-one-button convention as handleRespAction — pick
  // an existing note to attach it as a reference, or "+ Create new" to
  // make a fresh note page and attach that. Either way this only ever
  // inserts a note_web_links row; the note itself is never duplicated.
  const handleNoteAction = async () => {
    const { x, y } = nextTaskGridPosition(noteLinks.length);
    if (noteChoice === NEW_NOTE_SENTINEL) {
      setCreatingNote(true);
      try {
        const noteId = await addPage(null, "Notes", "New Note");
        await addNoteWebLink("goal", goalId, noteId, x, y);
        setNoteChoice("");
        load();
      } finally {
        setCreatingNote(false);
      }
      return;
    }
    if (!noteChoice) return;
    await addNoteWebLink("goal", goalId, Number(noteChoice), x, y);
    setNoteChoice("");
    load();
  };

  const handleAddWebWidget = async () => {
    if (!widgetChoice) return;
    const { x, y } = nextTaskGridPosition(webWidgets.length);
    await addWebWidget("goal", goalId, widgetChoice, WIDGET_TYPE_LABELS[widgetChoice], x, y, WEB_WIDGET_DEFAULT_WIDTH, WEB_WIDGET_DEFAULT_HEIGHT);
    setWidgetChoice("");
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
    <div className="goal-web-shell" data-color-surface="page-bg" style={pageSurfaceStyle(pageBgOverrides["page-bg"])}>
      <div className="goal-web-canvas-area">
        <Breadcrumb
          crumbs={[
            goal.isPassionProject
              ? { label: "Projects", onClick: () => onNavigate({ type: "projects-home" }) }
              : { label: "Goals", onClick: () => onNavigate({ type: "goals-home" }) },
            { label: goal.name, onClick: () => onNavigate({ type: "goal-detail", goalId }) },
            { label: "Goal Web" },
          ]}
        />

        <div className="web-page-header">
          <h1 className="page-title" style={{ margin: 0, fontSize: "22px" }}>
            {goal.name} — Goal Web
          </h1>
          <div className="web-page-header-actions" style={{ position: "relative" }}>
            <button className="add-button secondary" onClick={() => setShowSizeControl((v) => !v)}>
              ⚄ Size
            </button>
            {showSizeControl && (
              <div className="goal-web-size-popover">
                <label style={{ fontSize: "11px", opacity: 0.8 }}>Web size: {scale.toFixed(2)}x</label>
                <input
                  type="range"
                  min={0.5}
                  max={2}
                  step={0.05}
                  value={scale}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setGoal((g) => (g ? { ...g, webScale: v } : g));
                    updateGoalWebScale(goalId, v);
                  }}
                />
              </div>
            )}
            <button className="add-button secondary" onClick={() => setShowBookmarks((v) => !v)}>
              {mobile ? `📍 ${bookmarks.length}` : `📍 Zooms (${bookmarks.length})`}
            </button>
            <button className="add-button" onClick={() => setShowAddPanel((v) => !v)}>
              + Add
            </button>
          </div>
        </div>

        <div
          className="goal-web-canvas"
          style={{
            backgroundImage: theme.goalWebBackgroundImage ? `url("${theme.goalWebBackgroundImage}")` : "none",
            backgroundSize:
              theme.goalWebBackgroundTile === "1" ? `${theme.goalWebBackgroundScale || "128"}px` : "cover",
            backgroundRepeat: theme.goalWebBackgroundTile === "1" ? "repeat" : "no-repeat",
            backgroundPosition: "center",
          }}
        >
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

              <div className="goal-web-add-panel-row">
                <span className="goal-web-add-panel-label">NOTES</span>
                <div style={{ display: "flex", gap: "4px" }}>
                  <select
                    className="inline-add-input"
                    style={{ marginBottom: 0, flex: 1 }}
                    value={noteChoice}
                    onChange={(e) => setNoteChoice(e.target.value)}
                  >
                    <option value="">Choose…</option>
                    <option value={NEW_NOTE_SENTINEL}>+ Create new</option>
                    {notePickerOptions
                      .filter((n) => !noteLinks.some((l) => l.noteId === n.id))
                      .map((n) => (
                        <option key={n.id} value={n.id}>
                          {n.title}
                        </option>
                      ))}
                  </select>
                  <button
                    className="add-button secondary"
                    onClick={handleNoteAction}
                    disabled={!noteChoice || creatingNote}
                  >
                    {creatingNote ? "Adding…" : noteChoice === NEW_NOTE_SENTINEL ? "New" : "Link"}
                  </button>
                </div>
              </div>

              <div className="goal-web-add-panel-row">
                <span className="goal-web-add-panel-label">WIDGETS</span>
                <div style={{ display: "flex", gap: "4px" }}>
                  <select
                    className="inline-add-input"
                    style={{ marginBottom: 0, flex: 1 }}
                    value={widgetChoice}
                    onChange={(e) => setWidgetChoice(e.target.value as ProjectWidgetType | "")}
                  >
                    <option value="">Choose…</option>
                    {(Object.keys(WIDGET_TYPE_LABELS) as ProjectWidgetType[]).map((type) => (
                      <option key={type} value={type}>
                        {WIDGET_TYPE_LABELS[type]}
                      </option>
                    ))}
                  </select>
                  <button className="add-button secondary" onClick={handleAddWebWidget} disabled={!widgetChoice}>
                    Add
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
            edges={edges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            onNodesChange={onNodesChange}
            onNodeDragStop={onNodeDragStop}
            onNodeClick={onNodeClick}
            onConnect={onConnect}
            onEdgesDelete={onEdgesDelete}
            onMoveEnd={handleMoveEnd}
            defaultViewport={initialViewport ?? undefined}
            fitView={!initialViewport}
            connectionMode={ConnectionMode.Loose}
            connectionLineType={ConnectionLineType.Straight}
            minZoom={0.05}
            maxZoom={4}
            panOnDrag
            zoomOnPinch
            proOptions={{ hideAttribution: true }}
            deleteKeyCode={["Backspace", "Delete"]}
          >
            <Panel position="top-right" className="web-hint-panel">
              <HintTooltip text="Everything linked to this goal — projects, their tasks, direct tasks, and responsibilities — lives on this one canvas. Drag from a node's edge to link two nodes together; Backspace/Delete removes a selected link. Zoom out to see it all; save a zoom to jump straight back to a cluster you're focused on." />
            </Panel>
            <Background
              color={theme.webGridColor}
              bgColor={theme.goalWebBackgroundImage ? "transparent" : theme.goalWebBackground}
              gap={16}
            />
            <WebControls />
            {theme.showLaborLegend !== "0" && <LaborLegend />}
            <ViewportPortal>
              <DecalLayer decals={decals} target="canvas" surface="section:goal-web" />
            </ViewportPortal>
          </ReactFlow>
        </div>
      </div>
      {openWidget && <NodeWidgetOverlay widget={openWidget} onClose={() => setOpenWidget(null)} />}
      {fieldVisibilityTarget && (
        <NodeFieldVisibilityPopover
          title={
            fieldVisibilityTarget.category === "goal"
              ? goal?.name ?? "Goal"
              : projectById.get(fieldVisibilityTarget.ownerId)?.name ?? "Project"
          }
          fields={
            fieldVisibilityTarget.category === "goal"
              ? goalFields
              : projectFieldsById.get(fieldVisibilityTarget.ownerId) ?? []
          }
          onUpdate={(fieldId, patch) =>
            handleUpdateFieldWeb(fieldVisibilityTarget.category, fieldVisibilityTarget.ownerId, fieldId, patch)
          }
          onClose={() => setFieldVisibilityTarget(null)}
        />
      )}
      {editingOutput && (
        <OutputEditorModal
          output={editingOutput}
          onNavigate={onNavigate}
          onClose={() => {
            setEditingOutput(null);
            loadOutputs();
          }}
          onDeleted={() => {
            setEditingOutput(null);
            loadOutputs();
          }}
        />
      )}
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
