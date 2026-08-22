// src/pages/DreamWebPage.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Node,
  Edge,
  Connection,
  NodeChange,
  Background,
  Controls,
  Panel,
  ViewportPortal,
  ConnectionMode,
  applyNodeChanges,
  useViewport,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  fetchDreamGraphData,
  addDream,
  deleteDream,
  updateDreamPosition,
  updateDreamPositionX,
  addDreamLink,
  removeDreamLink,
  putDreamToBed,
} from "../db/dreams";
import { Dream, DreamPriority } from "../types/models";
import { DreamNode, DREAM_BASE_WIDTH, DREAM_BASE_HEIGHT, zoomCompensation } from "../components/DreamGraphNodes";
import { View } from "../types/nav";
import { StyledButton } from "../icons/StyledButton";
import { useTheme } from "../theme/ThemeContext";
import "./Page.css";
import "./DreamWebPage.css";

const nodeTypes = { dreamNode: DreamNode };

const dreamNodeId = (id: number) => `d-${id}`;
const parseDreamNodeId = (nodeId: string) => Number(nodeId.slice(2));
const linkEdgeId = (id: number) => `link-${id}`;
const parseLinkEdgeId = (edgeId: string) => Number(edgeId.slice(5));

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
  isCurrentYear: boolean;
}

function buildGridLines(): GridLine[] {
  const lines: GridLine[] = [];
  const currentYear = TODAY.getFullYear();
  for (let y = EPOCH_YEAR; y <= END_YEAR; y++) {
    lines.push({ y: isoToY(`${y}-01-01`), label: String(y), isYear: true, isCurrentYear: y === currentYear });
    for (let m = 2; m <= 12; m++) {
      const mm = String(m).padStart(2, "0");
      lines.push({
        y: isoToY(`${y}-${mm}-01`),
        label: new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: "short" }),
        isYear: false,
        isCurrentYear: false,
      });
    }
  }
  return lines;
}

function nodeSizeFor(priority: DreamPriority, zoom: number): { width: number; height: number } {
  const scale = (priority === "high" ? 1.3 : priority === "low" ? 0.8 : 1) * zoomCompensation(zoom);
  return { width: DREAM_BASE_WIDTH * scale, height: DREAM_BASE_HEIGHT * scale };
}

// Loosely parses things like "6 months", "2 years", "3 weeks" into a
// target ISO date from today. Returns null if it can't make sense of it.
function parseSleepDuration(input: string): string | null {
  const match = input.trim().match(/^(\d+)\s*(day|week|month|year)s?$/i);
  if (!match) return null;
  const n = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();
  const d = new Date();
  if (unit === "day") d.setDate(d.getDate() + n);
  else if (unit === "week") d.setDate(d.getDate() + n * 7);
  else if (unit === "month") d.setMonth(d.getMonth() + n);
  else if (unit === "year") d.setFullYear(d.getFullYear() + n);
  return d.toISOString().slice(0, 10);
}

function timelineSort(a: Dream, b: Dream) {
  if (!a.expectedDateStart && !b.expectedDateStart) return a.name.localeCompare(b.name);
  if (!a.expectedDateStart) return 1;
  if (!b.expectedDateStart) return -1;
  return a.expectedDateStart.localeCompare(b.expectedDateStart);
}

function DreamWebInner({ onNavigate }: { onNavigate: (view: View) => void }) {
  const { theme } = useTheme();
  const { zoom } = useViewport();
  const [dreams, setDreams] = useState<Dream[]>([]);
  const [links, setLinks] = useState<{ id: number; sourceDreamId: number; targetDreamId: number }[]>([]);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const gridLines = useMemo(buildGridLines, []);

  const load = () => {
    fetchDreamGraphData().then(({ dreams, links }) => {
      setDreams(dreams);
      setLinks(links);
      setLoading(false);
    });
  };

  useEffect(load, []);

  const dreamById = useMemo(() => new Map(dreams.map((d) => [d.id, d])), [dreams]);

  const handleDelete = async (dream: Dream) => {
    if (!confirm(`Delete "${dream.name}"? This also removes its links and history.`)) return;
    await deleteDream(dream.id);
    setDreams((prev) => prev.filter((d) => d.id !== dream.id));
    setLinks((prev) => prev.filter((l) => l.sourceDreamId !== dream.id && l.targetDreamId !== dream.id));
  };

  const handlePutToBed = async (dream: Dream) => {
    const input = window.prompt(
      `How far out do you want to put "${dream.name}" to bed? (e.g. "6 months", "2 years", "3 weeks")`,
      "1 year"
    );
    if (!input) return;
    const sleepUntil = parseSleepDuration(input);
    if (!sleepUntil) {
      alert('Couldn\'t understand that — try something like "6 months" or "2 years".');
      return;
    }
    await putDreamToBed(dream.id, sleepUntil);
    load();
  };

  const activeDreams = useMemo(() => dreams.filter((d) => !d.isAsleep), [dreams]);
  const sleepingDreams = useMemo(() => dreams.filter((d) => d.isAsleep), [dreams]);

  const positionFor = (dream: Dream): { x: number; y: number } => {
    if (dream.expectedDateStart) {
      return { x: dream.posX, y: rangeMidY(dream.expectedDateStart, dream.expectedDateEnd) };
    }
    return { x: dream.posX, y: dream.posY };
  };

  // Nodes are rebuilt from `activeDreams` whenever the underlying data
  // changes. A dated dream's y always comes from its date — dragging
  // can only ever move x (see onNodesChange) — so there's no "live drag
  // position" for y to preserve here.
  useEffect(() => {
    setNodes(
      activeDreams.map((dream) => ({
        id: dreamNodeId(dream.id),
        type: "dreamNode",
        position: positionFor(dream),
        data: {
          name: dream.name,
          priority: dream.priority,
          expectedDateStart: dream.expectedDateStart,
          expectedDateEnd: dream.expectedDateEnd,
          onDelete: () => handleDelete(dream),
          onPutToBed: () => handlePutToBed(dream),
        },
      }))
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDreams]);

  const edges: Edge[] = useMemo(() => {
    const activeIds = new Set(activeDreams.map((d) => d.id));
    return links
      .filter((l) => activeIds.has(l.sourceDreamId) && activeIds.has(l.targetDreamId))
      .map((link) => ({
        id: linkEdgeId(link.id),
        source: dreamNodeId(link.sourceDreamId),
        target: dreamNodeId(link.targetDreamId),
        style: { stroke: theme.dreamLinkColor, strokeWidth: 2 },
      }));
  }, [links, activeDreams, theme.dreamLinkColor]);

  const onNodesChange = (changes: NodeChange[]) => {
    const adjusted = changes
      .filter((c) => c.type !== "remove")
      .map((c) => {
        if (c.type !== "position" || !c.position) return c;
        const dream = dreamById.get(parseDreamNodeId(c.id));
        if (!dream?.expectedDateStart) return c;
        // Dated dreams can only move horizontally — y snaps back to the
        // date-derived position every change, not just on drop, so the
        // node visually tracks a straight horizontal line while dragging.
        return { ...c, position: { x: c.position.x, y: rangeMidY(dream.expectedDateStart, dream.expectedDateEnd) } };
      });
    setNodes((nds) => applyNodeChanges(adjusted, nds));
  };

  const onNodeDragStop = (_: MouseEvent | TouchEvent, node: Node) => {
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

  const onConnect = (connection: Connection) => {
    if (!connection.source || !connection.target) return;
    const sourceId = parseDreamNodeId(connection.source);
    const targetId = parseDreamNodeId(connection.target);
    if (sourceId === targetId) return;
    addDreamLink(sourceId, targetId).then(load);
  };

  const onEdgesDelete = (deleted: Edge[]) => {
    for (const edge of deleted) {
      removeDreamLink(parseLinkEdgeId(edge.id)).then(load);
    }
  };

  const onNodeClick = (_: React.MouseEvent, node: Node) => {
    onNavigate({ type: "dream-detail", dreamId: parseDreamNodeId(node.id) });
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

  const timeline = [...activeDreams].sort(timelineSort);
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
    <div className="dream-web-shell">
      <aside className="dream-timeline">
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
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "12px" }}>
          <h1 style={{ margin: 0, fontSize: "22px" }}>Dream Web</h1>
          <StyledButton buttonKey="web-zoom-back" iconKey="back" onClick={() => onNavigate({ type: "home" })} />
        </div>

        <div
          className="dream-canvas"
          style={{
            backgroundImage: theme.dreamWebBackgroundImage ? `url("${theme.dreamWebBackgroundImage}")` : "none",
          }}
        >
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onNodeDragStop={onNodeDragStop}
            onConnect={onConnect}
            onEdgesDelete={onEdgesDelete}
            onNodeClick={onNodeClick}
            connectionMode={ConnectionMode.Loose}
            deleteKeyCode={["Backspace", "Delete"]}
            fitView
          >
            <ViewportPortal>
              <div style={{ position: "absolute", top: 0, left: 0 }}>
                {gridLines
                  .filter((l) => l.isYear || showMonthLines)
                  .map((l, i) => (
                    <div
                      key={i}
                      style={{
                        position: "absolute",
                        top: l.y,
                        left: -6000,
                        height: l.isCurrentYear ? 3 : l.isYear ? 2 : 1,
                        width: 13000,
                        background: l.isCurrentYear
                          ? "#f4c430"
                          : l.isYear
                          ? "rgba(255,255,255,0.22)"
                          : "rgba(255,255,255,0.08)",
                        boxShadow: l.isCurrentYear ? "0 0 8px rgba(244,196,48,0.6)" : "none",
                        pointerEvents: "none",
                      }}
                    >
                      <span
                        style={{
                          position: "absolute",
                          top: l.isCurrentYear ? -19 : -16,
                          left: 5980,
                          fontSize: l.isCurrentYear ? 13 : l.isYear ? 12 : 10,
                          fontWeight: l.isCurrentYear || l.isYear ? 700 : 400,
                          color: l.isCurrentYear ? "#f4c430" : "rgba(255,255,255,0.55)",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {l.label}
                      </span>
                    </div>
                  ))}

                {activeDreams
                  .filter((d) => d.expectedDateStart && d.expectedDateEnd && d.expectedDateStart !== d.expectedDateEnd)
                  .map((dream) => {
                    const startY = isoToY(dream.expectedDateStart!);
                    const endY = isoToY(dream.expectedDateEnd!);
                    const { width } = nodeSizeFor(dream.priority, zoom);
                    const centerX = dream.posX + width / 2;
                    const color = priorityColorFor(dream.priority);
                    const top = Math.min(startY, endY);
                    const barHeight = Math.abs(endY - startY);
                    return (
                      <React.Fragment key={dream.id}>
                        <div
                          style={{
                            position: "absolute",
                            left: centerX - 1,
                            top,
                            width: 2,
                            height: barHeight,
                            background: color,
                            opacity: 0.6,
                            pointerEvents: "none",
                          }}
                        />
                        <div
                          style={{
                            position: "absolute",
                            left: centerX - 8,
                            top: startY - 1,
                            width: 16,
                            height: 2,
                            background: color,
                            opacity: 0.6,
                            pointerEvents: "none",
                          }}
                        />
                        <div
                          style={{
                            position: "absolute",
                            left: centerX - 8,
                            top: endY - 1,
                            width: 16,
                            height: 2,
                            background: color,
                            opacity: 0.6,
                            pointerEvents: "none",
                          }}
                        />
                      </React.Fragment>
                    );
                  })}
              </div>
            </ViewportPortal>

            <Panel position="top-right" className="dream-canvas-hint">
              Future is up, past is down. Drag between the corner dots to link dreams. Dated dreams
              only move left/right — change the date to move them in time.
            </Panel>
            <Background
              color="#64748b"
              bgColor={theme.dreamWebBackgroundImage ? "transparent" : theme.dreamWebBackground}
              gap={16}
            />
            <Controls />
          </ReactFlow>
        </div>
      </div>
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
