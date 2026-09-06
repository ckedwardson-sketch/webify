import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Node,
  Edge,
  Background,
  Panel,
  useReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { View } from "../types/nav";
import {
  RingPalette,
  RING_PALETTES,
  SkillDreamNodeField,
  SkillGoal,
  SkillTask,
  WORK_TYPES,
  WORK_TYPE_LABELS,
  WorkType,
} from "../types/skill";
import {
  addSkillGoal,
  addSkillTask,
  bringGoalForward,
  completeSkillGoal,
  deleteSkillGoal,
  fetchSiblingGoalsToResolve,
  fetchSkillTreeData,
  lastWorkedDate,
  logWork,
  placeTaskOnPath,
  putGoalToBed,
  removeTaskFromPath,
  reorderHistoricalGoals,
  saveSkillSettings,
  setSkillGoalActive,
  setSkillTaskArchived,
  updateSkillCurrentLevelName,
  updateSkillGoalDetails,
  updateSkillName,
  updateSkillTaskDetails,
  updateTaskPathOffset,
  SkillTreeData,
} from "../db/skills";
import {
  layoutSkillTree,
  pathAnchor,
  projectOntoPath,
  positionFromOffsets,
  anchorPointForOffsets,
} from "../skills/skillLayout";
import {
  SkillGoalNodeView,
  AddControlNodeView,
  SkillTaskNodeView,
  SkillTreeBentEdge,
} from "../components/SkillTreeNodes";
import { useReorderableList } from "../hooks/useReorderableList";
import { useSaveFeedback } from "../hooks/useSaveFeedback";
import { useMobileLayout } from "../theme/useMobileLayout";
import { WebControls } from "../components/WebControls";
import "./Page.css";
import "./SkillTreePage.css";

const nodeTypes = {
  skillGoalNode: SkillGoalNodeView,
  skillAddControl: AddControlNodeView,
  skillTaskNode: SkillTaskNodeView,
};
const edgeTypes = { skillTreeBentEdge: SkillTreeBentEdge };

const goalNodeId = (id: number) => `goal-${id}`;
const taskNodeId = (id: number) => `task-${id}`;
const anchorNodeId = (pathId: number) => `anchor-${pathId}`;

export function SkillTreePage({ skillId, onNavigate }: { skillId: number; onNavigate: (view: View) => void }) {
  const [data, setData] = useState<SkillTreeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [selectedGoalId, setSelectedGoalId] = useState<number | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [resolveGoal, setResolveGoal] = useState<{ goal: SkillGoal; siblings: SkillGoal[] } | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [editingName, setEditingName] = useState(false);
  const saveFeedback = useSaveFeedback();

  const reload = useCallback(async () => {
    const result = await fetchSkillTreeData(skillId);
    setData(result);
    setLoading(false);
  }, [skillId]);

  useEffect(() => {
    setLoading(true);
    reload();
  }, [reload]);

  const historyReorder = useReorderableList<SkillGoal>(async (orderedIds) => {
    await reorderHistoricalGoals(skillId, orderedIds);
    reload();
  });

  useEffect(() => {
    if (data) historyReorder.setItems(data.goals.filter((g) => g.status === "historical").sort((a, b) => (a.historyOrder ?? 0) - (b.historyOrder ?? 0)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  if (loading || !data) {
    return (
      <div className="page">
        <p className="page-text">Loading skill tree…</p>
      </div>
    );
  }

  return (
    <ReactFlowProvider>
      <SkillTreeCanvas
        skillId={skillId}
        data={data}
        reload={reload}
        editMode={editMode}
        setEditMode={setEditMode}
        selectedGoalId={selectedGoalId}
        setSelectedGoalId={setSelectedGoalId}
        selectedTaskId={selectedTaskId}
        setSelectedTaskId={setSelectedTaskId}
        resolveGoal={resolveGoal}
        setResolveGoal={setResolveGoal}
        settingsOpen={settingsOpen}
        setSettingsOpen={setSettingsOpen}
        nameDraft={nameDraft}
        setNameDraft={setNameDraft}
        editingName={editingName}
        setEditingName={setEditingName}
        saveFeedback={saveFeedback}
        historyReorder={historyReorder}
        onNavigate={onNavigate}
      />
    </ReactFlowProvider>
  );
}

function SkillTreeCanvas({
  skillId,
  data,
  reload,
  editMode,
  setEditMode,
  selectedGoalId,
  setSelectedGoalId,
  selectedTaskId,
  setSelectedTaskId,
  resolveGoal,
  setResolveGoal,
  settingsOpen,
  setSettingsOpen,
  nameDraft,
  setNameDraft,
  editingName,
  setEditingName,
  saveFeedback,
  historyReorder,
  onNavigate,
}: any) {
  const { screenToFlowPosition } = useReactFlow();
  const { skill, goals, tasks, taskPaths, workLogs, settings } = data as SkillTreeData;
  const mobile = useMobileLayout();
  const [taskDrawerOpen, setTaskDrawerOpen] = useState(false);

  const layout = useMemo(() => layoutSkillTree(goals, settings), [goals, settings]);

  // Reusable Skill Tasks stay in the toolbar even once placed — the same
  // task can be dropped onto multiple paths, so placement never removes it.
  const unplacedTasks = useMemo(() => tasks.filter((t) => !t.archived), [tasks]);
  const archivedTasks = useMemo(() => tasks.filter((t) => t.archived), [tasks]);

  const openGoal = useCallback((id: number) => setSelectedGoalId(id), [setSelectedGoalId]);
  const openTask = useCallback((id: number) => setSelectedTaskId(id), [setSelectedTaskId]);

  const handleAddGoal = async (parentGoalId: number | null) => {
    const parent = parentGoalId != null ? goals.find((g: SkillGoal) => g.id === parentGoalId) : null;
    // Skill goals are usually iterative — the next step is often a small
    // variation on the last one, so prefill with the parent's name/reason
    // instead of starting blank; still fully editable before/after.
    const name = prompt("New goal name:", parent?.name ?? "");
    if (!name?.trim()) return;
    const newId = await addSkillGoal(skillId, parentGoalId, name.trim(), false);
    if (parent && (parent.description || parent.reason)) {
      await updateSkillGoalDetails(newId, { description: parent.description, reason: parent.reason });
    }
    reload();
  };

  const handleAddHistorical = async () => {
    const name = prompt("Historical goal name (before you started tracking):");
    if (!name?.trim()) return;
    const historicals = layout.historicalGoals;
    const parentId = historicals.length > 0 ? historicals[historicals.length - 1].id : null;
    await addSkillGoal(skillId, parentId, name.trim(), true);
    reload();
  };

  const [quickLogTaskId, setQuickLogTaskId] = useState<number | null>(null);

  // ---- Nodes ---------------------------------------------------

  const vertical = settings.direction === "vertical";
  const depthSpacing = vertical ? settings.vSpacing : settings.hSpacing;

  const nodes: Node[] = [];
  for (const g of goals.filter((g: SkillGoal) => g.status !== "historical" || true)) {
    const pos = layout.positions.get(g.id);
    if (!pos) continue;
    nodes.push({
      id: goalNodeId(g.id),
      type: "skillGoalNode",
      position: pos,
      data: { goal: g, onOpen: openGoal, direction: settings.direction },
      style: { width: settings.nodeWidth, height: settings.nodeHeight },
      draggable: false,
    });
  }

  if (editMode) {
    // Bootstrap control: no tree goals exist yet at all, so there's nothing
    // to branch off of — offer a control to create the first root goal.
    if (layout.roots.length === 0) {
      nodes.push({
        id: "add-root",
        type: "skillAddControl",
        position: { x: 0, y: 0 },
        data: { label: "First Goal", onClick: () => handleAddGoal(null) },
        style: { width: 110, height: 34 },
        draggable: false,
      });
    }
    // + Goal control on every goal you can still branch from — active goals
    // (to add a sibling direction) and completed goals (completing a goal
    // must never dead-end the tree; a completed goal can grow a new active
    // child). Positioned one full depth-step over (where a new child would
    // actually land), past the farthest existing child on the sibling axis
    // so it never sits on top of a sibling that's already there. The
    // depth/sibling axes swap with settings.direction (see skillLayout.ts).
    for (const g of goals.filter((g: SkillGoal) => g.status === "active" || g.status === "completed")) {
      const pos = layout.positions.get(g.id);
      if (!pos) continue;
      const children = layout.childrenOf.get(g.id) ?? [];
      const childCrosses = children
        .map((c) => (vertical ? layout.positions.get(c.id)?.x : layout.positions.get(c.id)?.y))
        .filter((v): v is number => v != null);
      const cross = childCrosses.length > 0 ? Math.max(...childCrosses) + settings.branchSpacing : (vertical ? pos.x : pos.y);
      const position = vertical ? { x: cross, y: pos.y + depthSpacing } : { x: pos.x + depthSpacing, y: cross };
      nodes.push({
        id: `add-${g.id}`,
        type: "skillAddControl",
        position,
        data: { label: "Goal", onClick: () => handleAddGoal(g.id) },
        style: { width: 90, height: 34 },
        draggable: false,
      });
    }
    // + Historical control one step back (behind the root, along the
    // depth axis) from the earliest historical goal, or from the root
    // if there's no history yet.
    const anchorGoal = layout.historicalGoals[0] ?? layout.roots[0];
    if (anchorGoal) {
      const pos = layout.positions.get(anchorGoal.id);
      if (pos) {
        const position = vertical
          ? { x: pos.x, y: pos.y - settings.historicalSpacing }
          : { x: pos.x - settings.historicalSpacing, y: pos.y };
        nodes.push({
          id: "add-historical",
          type: "skillAddControl",
          position,
          data: { label: "History", onClick: handleAddHistorical },
          style: { width: 90, height: 34 },
          draggable: false,
        });
      }
    }
  }

  // Anchor nodes (invisible) + task nodes for every placed task. Each
  // task's (offsetX, offsetY) is really (along, perp) in the path's local
  // frame, so its own anchor node is the closest point on the path for its
  // particular along value — not a single point shared by every task on
  // that path — and the connector to it is always exactly perpendicular.
  for (const tp of taskPaths) {
    const pa = pathAnchor(layout, tp.sourceGoalId, tp.targetGoalId, settings.nodeWidth, settings.nodeHeight, settings.pathBendDistance, settings.direction);
    if (!pa) continue;
    const anchorPos = anchorPointForOffsets(pa, tp.offsetX);
    nodes.push({
      id: anchorNodeId(tp.id),
      position: anchorPos,
      data: {},
      style: { width: 1, height: 1, opacity: 0 },
      draggable: false,
      selectable: false,
      connectable: false,
    });
    const task = tasks.find((t: SkillTask) => t.id === tp.taskId);
    if (!task) continue;
    const logs = workLogs.filter((l: any) => l.taskId === task.id);
    const taskPos = positionFromOffsets(pa, tp.offsetX, tp.offsetY);
    nodes.push({
      id: taskNodeId(tp.taskId) + `-${tp.id}`,
      type: "skillTaskNode",
      position: taskPos,
      data: {
        task,
        logs,
        palette: settings.ringPalette,
        editMode,
        onOpen: () => openTask(task.id),
        onLogWork: () => setQuickLogTaskId(task.id),
        __pathId: tp.id,
      },
      style: { width: 170, height: 160 },
      draggable: editMode,
    });
  }

  // ---- Edges ---------------------------------------------------

  const edges: Edge[] = layout.edges.map((e) => ({
    id: e.id,
    source: goalNodeId(e.sourceId),
    target: goalNodeId(e.targetId),
    type: "skillTreeBentEdge",
    data: { historical: e.historical, bendDistance: settings.pathBendDistance, direction: settings.direction },
  }));

  for (const tp of taskPaths) {
    edges.push({
      id: `conn-${tp.id}`,
      source: anchorNodeId(tp.id),
      target: taskNodeId(tp.taskId) + `-${tp.id}`,
      type: "straight",
      style: { stroke: "var(--color-border)", strokeWidth: 1.5, strokeDasharray: "3 3" },
    });
  }

  // ---- Handlers ---------------------------------------------------

  const onNodeDragStop = async (_: unknown, node: Node) => {
    const data = node.data as any;
    if (data?.__pathId) {
      const tp = taskPaths.find((t: any) => t.id === data.__pathId);
      if (!tp) return;
      const pa = pathAnchor(layout, tp.sourceGoalId, tp.targetGoalId, settings.nodeWidth, settings.nodeHeight, settings.pathBendDistance, settings.direction);
      if (!pa) return;
      // React Flow already moves the node live with the cursor during the
      // drag; on release, snap/clamp it back onto the path corridor.
      const { along, perp } = projectOntoPath(pa, node.position, settings.taskOffset);
      await updateTaskPathOffset(tp.id, along, perp);
      reload();
    }
  };

  const handleCompleteGoal = async (goal: SkillGoal) => {
    if (!confirm(`Complete "${goal.name}"?`)) return;
    await completeSkillGoal(goal.id);
    const siblings = await fetchSiblingGoalsToResolve(goal.id);
    if (siblings.length > 0) {
      setResolveGoal({ goal, siblings });
    }
    reload();
  };

  const handleDeleteGoal = async (goal: SkillGoal) => {
    if (!confirm(`Delete "${goal.name}" and its whole subtree? This cannot be undone.`)) return;
    await deleteSkillGoal(goal.id);
    setSelectedGoalId(null);
    reload();
  };

  // ---- Toolbar drag-drop ---------------------------------------------------

  const [draggingTaskId, setDraggingTaskId] = useState<number | null>(null);

  const handleCanvasDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    if (draggingTaskId == null) return;
    const flowPos = screenToFlowPosition({ x: e.clientX, y: e.clientY });
    // Find the nearest goal-to-goal path by distance to the closest point
    // actually reachable on it (post-clamp) — this is what makes a
    // dropped task lock onto the path instead of floating wherever it was
    // released.
    let best: { sourceGoalId: number; targetGoalId: number; along: number; perp: number; dist: number } | null = null;
    for (const edge of layout.edges) {
      if (edge.historical) continue;
      const pa = pathAnchor(layout, edge.sourceId, edge.targetId, settings.nodeWidth, settings.nodeHeight, settings.pathBendDistance, settings.direction);
      if (!pa) continue;
      const { along, perp } = projectOntoPath(pa, flowPos, settings.taskOffset);
      const candidate = positionFromOffsets(pa, along, perp);
      const dist = Math.hypot(candidate.x - flowPos.x, candidate.y - flowPos.y);
      if (!best || dist < best.dist) best = { sourceGoalId: edge.sourceId, targetGoalId: edge.targetId, along, perp, dist };
    }
    if (!best) {
      alert("Add a goal connection first — tasks attach to a path between two goals.");
      setDraggingTaskId(null);
      return;
    }
    // Multiple tasks can share one path — nudge along the path so a newly
    // dropped task doesn't land stacked exactly on top of one already
    // there (which read as "the old one snaps back" when it was really
    // just two nodes occupying the same spot).
    const others = taskPaths.filter(
      (tp: any) => tp.sourceGoalId === best!.sourceGoalId && tp.targetGoalId === best!.targetGoalId && tp.taskId !== draggingTaskId
    );
    let along = best.along;
    const minGap = 60;
    while (others.some((tp: any) => Math.abs(tp.offsetX - along) < minGap)) {
      along += minGap;
    }
    await placeTaskOnPath(draggingTaskId, best.sourceGoalId, best.targetGoalId, along, best.perp);
    setDraggingTaskId(null);
    reload();
  };

  const selectedGoal = goals.find((g: SkillGoal) => g.id === selectedGoalId) ?? null;
  const selectedTask = tasks.find((t: SkillTask) => t.id === selectedTaskId) ?? null;
  const quickLogTask = tasks.find((t: SkillTask) => t.id === quickLogTaskId) ?? null;

  return (
    <div className="page skill-tree-page">
      <div className="web-page-header">
        <div className="skill-tree-title-row">
          <button className="parent-link" onClick={() => onNavigate({ type: "skills-home" })}>
            ← Skills
          </button>
          {editingName ? (
            <input
              className="title-rename-input"
              autoFocus
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              onBlur={() => {
                if (nameDraft.trim()) saveFeedback.run(() => updateSkillName(skillId, nameDraft.trim())).then(reload);
                setEditingName(false);
              }}
              onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
            />
          ) : (
            <h1
              className="page-title"
              onClick={() => {
                setNameDraft(skill.name);
                setEditingName(true);
              }}
            >
              {skill.name}
            </h1>
          )}
        </div>
        <div className="web-page-header-actions">
          {mobile && (
            <button className="add-button secondary" onClick={() => setTaskDrawerOpen(true)}>
              📋 Tasks
            </button>
          )}
          <button className="add-button secondary" onClick={() => setSettingsOpen(true)}>
            ⚙ Settings
          </button>
          <button className={`add-button${editMode ? "" : " secondary"}`} onClick={() => setEditMode((m: boolean) => !m)}>
            {editMode ? "✓ Editing" : "✎ Edit Mode"}
          </button>
        </div>
      </div>

      <CurrentLevelEditor skill={skill} reload={reload} />

      <div className="skill-tree-body">
        <div className="skill-tree-canvas-wrap" onDragOver={(e) => e.preventDefault()} onDrop={handleCanvasDrop}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            onNodeDragStop={onNodeDragStop}
            nodesDraggable={editMode}
            nodesConnectable={false}
            fitView
            minZoom={0.2}
            maxZoom={2}
          >
            <Background gap={24} />
            {historyReorder.items.length > 0 && editMode && (
              <Panel position="top-left" className="skill-history-panel">
                <div className="skill-history-panel-title">Reorder History</div>
                {historyReorder.items.map((g: SkillGoal) => (
                  <div
                    key={g.id}
                    className={`skill-history-row${historyReorder.draggedId === g.id ? " dragging" : ""}`}
                    draggable
                    onDragStart={() => historyReorder.handleDragStart(g.id)}
                    onDragOver={(e) => {
                      e.preventDefault();
                      historyReorder.handleDragOver(g.id);
                    }}
                    onDragEnd={historyReorder.handleDragEnd}
                  >
                    ⠿ {g.name}
                  </div>
                ))}
              </Panel>
            )}
            <WebControls />
          </ReactFlow>
        </div>

        {mobile && taskDrawerOpen && (
          <div className="skill-task-drawer-backdrop" onClick={() => setTaskDrawerOpen(false)} />
        )}
        <TaskToolbar
          unplacedTasks={unplacedTasks}
          archivedTasks={archivedTasks}
          editMode={editMode}
          skillId={skillId}
          reload={reload}
          onOpenTask={openTask}
          draggingTaskId={draggingTaskId}
          mobile={mobile}
          drawerOpen={taskDrawerOpen}
          onCloseDrawer={() => setTaskDrawerOpen(false)}
          setDraggingTaskId={setDraggingTaskId}
        />
      </div>

      {selectedGoal && (
        <GoalDetailPanel
          goal={selectedGoal}
          onClose={() => setSelectedGoalId(null)}
          reload={reload}
          onComplete={() => handleCompleteGoal(selectedGoal)}
          onDelete={() => handleDeleteGoal(selectedGoal)}
        />
      )}

      {selectedTask && (
        <TaskDetailPanel
          task={selectedTask}
          logs={workLogs.filter((l: any) => l.taskId === selectedTask.id)}
          onClose={() => setSelectedTaskId(null)}
          reload={reload}
          taskPaths={taskPaths.filter((tp: any) => tp.taskId === selectedTask.id)}
        />
      )}

      {quickLogTask && (
        <LogWorkModal task={quickLogTask} onClose={() => setQuickLogTaskId(null)} reload={reload} />
      )}

      {resolveGoal && (
        <ResolveGoalModal
          resolveGoal={resolveGoal}
          onClose={() => setResolveGoal(null)}
          reload={reload}
        />
      )}

      {settingsOpen && (
        <SkillSettingsPanel skillId={skillId} settings={settings} goals={goals} onClose={() => setSettingsOpen(false)} reload={reload} />
      )}
    </div>
  );
}

function CurrentLevelEditor({ skill, reload }: { skill: any; reload: () => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(skill.currentLevelName);
  const saveFeedback = useSaveFeedback();
  useEffect(() => setDraft(skill.currentLevelName), [skill.currentLevelName]);
  return (
    <div className="skill-current-level">
      <span className="skill-current-level-label">Current level:</span>
      {editing ? (
        <input
          className="inline-add-input skill-current-level-input"
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            saveFeedback.run(() => updateSkillCurrentLevelName(skill.id, draft)).then(reload);
            setEditing(false);
          }}
          onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
        />
      ) : (
        <span className="skill-current-level-value" onClick={() => setEditing(true)}>
          {skill.currentLevelName ? `"${skill.currentLevelName}"` : "click to set a fun current-level name…"}
        </span>
      )}
    </div>
  );
}

function TaskToolbar({
  unplacedTasks,
  archivedTasks,
  editMode,
  skillId,
  reload,
  onOpenTask,
  draggingTaskId,
  setDraggingTaskId,
  mobile,
  drawerOpen,
  onCloseDrawer,
}: any) {
  const [showArchive, setShowArchive] = useState(false);

  const handleAddTask = async () => {
    const name = prompt("New task name:");
    if (!name?.trim()) return;
    await addSkillTask(skillId, name.trim(), "labor");
    reload();
  };

  const handleArchiveDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    if (draggingTaskId == null) return;
    await setSkillTaskArchived(draggingTaskId, true);
    setDraggingTaskId(null);
    reload();
  };

  return (
    <div className={`skill-task-toolbar${mobile ? " mobile" : ""}${mobile && drawerOpen ? " is-open" : ""}`}>
      <div className="skill-task-toolbar-header">
        <span>Tasks</span>
        <div className="skill-task-toolbar-header-actions">
          {editMode && (
            <button className="skill-add-task-btn" onClick={handleAddTask} title="Add a new reusable task">
              +
            </button>
          )}
          {mobile && (
            <button className="icon-button" onClick={onCloseDrawer} title="Close">
              ✕
            </button>
          )}
        </div>
      </div>
      <div className="skill-task-toolbar-list">
        {unplacedTasks.length === 0 && <p className="page-text skill-toolbar-empty">No unplaced tasks.</p>}
        {unplacedTasks.map((t: SkillTask) => (
          <div
            key={t.id}
            className="skill-toolbar-task"
            draggable={editMode}
            onDragStart={() => setDraggingTaskId(t.id)}
            onClick={() => onOpenTask(t.id)}
          >
            <span className="skill-toolbar-task-icon">{WORK_TYPE_LABELS[t.workType][0]}</span>
            {t.name}
          </div>
        ))}
      </div>
      {editMode && (
        <div className="skill-archive-zone" onDragOver={(e) => e.preventDefault()} onDrop={handleArchiveDrop}>
          🗑 Drag here to archive
        </div>
      )}
      <button className="skill-toolbar-archive-toggle" onClick={() => setShowArchive((s) => !s)}>
        {showArchive ? "Hide" : "Show"} archived ({archivedTasks.length})
      </button>
      {showArchive && (
        <div className="skill-task-toolbar-list archived">
          {archivedTasks.map((t: SkillTask) => (
            <div key={t.id} className="skill-toolbar-task archived" onClick={() => onOpenTask(t.id)}>
              {t.name}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function GoalDetailPanel({ goal, onClose, reload, onComplete, onDelete }: any) {
  const [name, setName] = useState(goal.name);
  const [description, setDescription] = useState(goal.description);
  const [reason, setReason] = useState(goal.reason);
  const saveFeedback = useSaveFeedback();

  useEffect(() => {
    setName(goal.name);
    setDescription(goal.description);
    setReason(goal.reason);
  }, [goal.id]);

  const save = () => saveFeedback.run(() => updateSkillGoalDetails(goal.id, { name, description, reason })).then(reload);

  const handleImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      saveFeedback
        .run(() => updateSkillGoalDetails(goal.id, { completionImage: reader.result as string }))
        .then(reload);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="skill-panel-backdrop" onClick={onClose}>
      <div className="skill-panel" onClick={(e) => e.stopPropagation()}>
        <div className="skill-panel-header">
          <input className="title-rename-input" value={name} onChange={(e) => setName(e.target.value)} onBlur={save} />
          <button className="icon-button" onClick={onClose}>✕</button>
        </div>
        <div className={`skill-panel-status status-${goal.status}`}>{goal.status.replace("_", " ")}</div>

        <label className="skill-field-label">Description</label>
        <textarea className="instructions-textarea" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} onBlur={save} />

        <label className="skill-field-label">Reason for goal</label>
        <textarea className="instructions-textarea" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} onBlur={save} />

        <label className="skill-field-label">Completion image</label>
        {goal.completionImage && <img className="skill-panel-completion-img" src={goal.completionImage} alt="" />}
        <input type="file" accept="image/*" onChange={handleImage} />

        <div className="skill-panel-actions">
          {goal.status === "active" && (
            <button
              className={`add-button${goal.isActive ? "" : " secondary"}`}
              onClick={() => setSkillGoalActive(goal.id, !goal.isActive).then(reload)}
            >
              {goal.isActive ? "★ Active" : "☆ Set Active"}
            </button>
          )}
          {goal.status === "active" && (
            <button className="add-button" onClick={onComplete}>
              COMPLETE GOAL
            </button>
          )}
          {goal.status === "put_to_bed" && (
            <button className="add-button secondary" onClick={() => bringGoalForward(goal.id).then(reload)}>
              Bring Forward
            </button>
          )}
          <button className="add-button danger" onClick={onDelete}>
            Delete
          </button>
        </div>
        <div className="save-row">{saveFeedback.status === "saved" && <span className="save-status save-status-success">Saved</span>}</div>
      </div>
    </div>
  );
}

function TaskDetailPanel({ task, logs, onClose, reload, taskPaths }: any) {
  const [name, setName] = useState(task.name);
  const [workType, setWorkType] = useState<WorkType>(task.workType);
  const [description, setDescription] = useState(task.description);
  const saveFeedback = useSaveFeedback();

  useEffect(() => {
    setName(task.name);
    setWorkType(task.workType);
    setDescription(task.description);
  }, [task.id]);

  const save = () => saveFeedback.run(() => updateSkillTaskDetails(task.id, { name, workType, description })).then(reload);
  const last = lastWorkedDate(logs);

  return (
    <div className="skill-panel-backdrop" onClick={onClose}>
      <div className="skill-panel" onClick={(e) => e.stopPropagation()}>
        <div className="skill-panel-header">
          <input className="title-rename-input" value={name} onChange={(e) => setName(e.target.value)} onBlur={save} />
          <button className="icon-button" onClick={onClose}>✕</button>
        </div>

        <label className="skill-field-label">Work type</label>
        <select
          className="inline-add-input"
          value={workType}
          onChange={(e) => {
            setWorkType(e.target.value as WorkType);
            saveFeedback.run(() => updateSkillTaskDetails(task.id, { workType: e.target.value as WorkType })).then(reload);
          }}
        >
          {WORK_TYPES.map((wt) => (
            <option key={wt} value={wt}>
              {WORK_TYPE_LABELS[wt]}
            </option>
          ))}
        </select>

        <label className="skill-field-label">Description</label>
        <textarea className="instructions-textarea" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} onBlur={save} />

        <p className="page-text">Last worked: {last ?? "never"}</p>
        <p className="page-text">Placed on {taskPaths.length} path{taskPaths.length === 1 ? "" : "s"}.</p>

        <LogWorkInline taskId={task.id} reload={reload} />

        <label className="skill-field-label">Work log history</label>
        <div className="skill-worklog-list">
          {logs.length === 0 && <p className="page-text">No sessions logged yet.</p>}
          {logs.map((l: any) => (
            <div key={l.id} className="skill-worklog-row">
              <span>{l.loggedDate}</span>
              <span>{l.durationMinutes}m</span>
              <span className="skill-worklog-note">{l.note}</span>
            </div>
          ))}
        </div>

        <div className="skill-panel-actions">
          {taskPaths.map((tp: any) => (
            <button
              key={tp.id}
              className="add-button secondary"
              onClick={() => removeTaskFromPath(tp.id).then(reload)}
            >
              Remove from path
            </button>
          ))}
          <button
            className={`add-button${task.archived ? " secondary" : " danger"}`}
            onClick={() => setSkillTaskArchived(task.id, !task.archived).then(reload)}
          >
            {task.archived ? "Restore from archive" : "Archive task"}
          </button>
        </div>
      </div>
    </div>
  );
}

function LogWorkInline({ taskId, reload }: { taskId: number; reload: () => void }) {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [duration, setDuration] = useState(30);
  const [note, setNote] = useState("");

  const submit = async () => {
    await logWork(taskId, date, duration, note.trim() || null);
    setNote("");
    reload();
  };

  return (
    <div className="skill-log-work-inline">
      <label className="skill-field-label">Log Work</label>
      <div className="skill-log-work-row">
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <input type="number" min={1} value={duration} onChange={(e) => setDuration(Number(e.target.value))} />
        <span>min</span>
      </div>
      <input className="inline-add-input" placeholder="Optional note" value={note} onChange={(e) => setNote(e.target.value)} />
      <button className="add-button" onClick={submit}>
        Log Session
      </button>
    </div>
  );
}

function LogWorkModal({ task, onClose, reload }: { task: SkillTask; onClose: () => void; reload: () => void }) {
  return (
    <div className="skill-panel-backdrop" onClick={onClose}>
      <div className="skill-panel skill-log-modal" onClick={(e) => e.stopPropagation()}>
        <div className="skill-panel-header">
          <h3 style={{ margin: 0 }}>Log Work — {task.name}</h3>
          <button className="icon-button" onClick={onClose}>✕</button>
        </div>
        <LogWorkInline taskId={task.id} reload={() => { reload(); onClose(); }} />
      </div>
    </div>
  );
}

function ResolveGoalModal({ resolveGoal, onClose, reload }: any) {
  const { goal, siblings } = resolveGoal;
  return (
    <div className="skill-panel-backdrop" onClick={onClose}>
      <div className="skill-panel" onClick={(e) => e.stopPropagation()}>
        <div className="skill-panel-header">
          <h3 style={{ margin: 0 }}>"{goal.name}" completed</h3>
          <button className="icon-button" onClick={onClose}>✕</button>
        </div>
        <p className="page-text">Other unfinished directions at this level — bring forward or put to bed:</p>
        {siblings.map((s: SkillGoal) => (
          <div key={s.id} className="skill-resolve-row">
            <span>{s.name}</span>
            <div>
              <button className="add-button secondary" onClick={() => bringGoalForward(s.id).then(reload)}>
                Bring Forward
              </button>
              <button className="add-button danger" onClick={() => putGoalToBed(s.id).then(reload)}>
                Put to Bed
              </button>
            </div>
          </div>
        ))}
        <button className="add-button" onClick={onClose} style={{ marginTop: 12 }}>
          Done
        </button>
      </div>
    </div>
  );
}

function SkillSettingsPanel({ settings, goals, onClose, reload }: any) {
  const [draft, setDraft] = useState(settings);
  const activeGoals = goals.filter((g: SkillGoal) => g.isActive && g.status === "active");

  const toggleField = (field: SkillDreamNodeField) => {
    setDraft((d: any) => ({
      ...d,
      dreamNodeFields: d.dreamNodeFields.includes(field)
        ? d.dreamNodeFields.filter((f: string) => f !== field)
        : [...d.dreamNodeFields, field],
    }));
  };

  const save = async () => {
    await saveSkillSettings(draft);
    reload();
    onClose();
  };

  const fieldOptions: { key: SkillDreamNodeField; label: string }[] = [
    { key: "currentLevel", label: "Current level name" },
    { key: "nextGoal", label: "Active goal name" },
    { key: "goalDescription", label: "Active goal description" },
    { key: "lastWorked", label: "Last worked" },
  ];

  return (
    <div className="skill-panel-backdrop" onClick={onClose}>
      <div className="skill-panel" onClick={(e) => e.stopPropagation()}>
        <div className="skill-panel-header">
          <h3 style={{ margin: 0 }}>Skill Settings</h3>
          <button className="icon-button" onClick={onClose}>✕</button>
        </div>

        <label className="skill-field-label">Tree growth direction</label>
        <select
          className="inline-add-input"
          value={draft.direction}
          onChange={(e) => setDraft((d: any) => ({ ...d, direction: e.target.value }))}
        >
          <option value="horizontal">Horizontal (left to right)</option>
          <option value="vertical">Vertical (top to bottom)</option>
        </select>

        <label className="skill-field-label">Work-ring palette</label>
        <select className="inline-add-input" value={draft.ringPalette} onChange={(e) => setDraft((d: any) => ({ ...d, ringPalette: e.target.value as RingPalette }))}>
          {RING_PALETTES.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>

        <div className="skill-settings-grid">
          {(["nodeWidth", "nodeHeight", "hSpacing", "vSpacing", "branchSpacing", "historicalSpacing", "taskOffset", "pathBendDistance"] as const).map(
            (key) => (
              <label key={key} className="skill-settings-num-field">
                {key}
                <input
                  type="number"
                  value={draft[key]}
                  onChange={(e) => setDraft((d: any) => ({ ...d, [key]: Number(e.target.value) }))}
                />
              </label>
            )
          )}
        </div>

        <label className="skill-field-label">Dream Web display fields</label>
        {fieldOptions.map((opt) => (
          <label key={opt.key} className="flag-checkbox">
            <input type="checkbox" checked={draft.dreamNodeFields.includes(opt.key)} onChange={() => toggleField(opt.key)} />
            {opt.label}
          </label>
        ))}

        {activeGoals.length > 0 && (
          <>
            <label className="skill-field-label">Which active goal represents "next goal" on the Dream Web</label>
            <select
              className="inline-add-input"
              value={draft.dreamNodeActiveGoalId ?? ""}
              onChange={(e) => setDraft((d: any) => ({ ...d, dreamNodeActiveGoalId: e.target.value ? Number(e.target.value) : null }))}
            >
              <option value="">None</option>
              {activeGoals.map((g: SkillGoal) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </>
        )}

        <button className="add-button" onClick={save} style={{ marginTop: 12 }}>
          Save Settings
        </button>
      </div>
    </div>
  );
}
