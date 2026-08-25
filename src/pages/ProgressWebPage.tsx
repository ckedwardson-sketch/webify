// src/pages/ProgressWebPage.tsx
import { useEffect, useMemo, useState } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Node,
  NodeChange,
  Background,
  Controls,
  Panel,
  applyNodeChanges,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  fetchProgressNodes,
  addProgressNode,
  updateProgressPosition,
} from "../db/progress";
import { ProgressNode as ProgressNodeModel, ProgressCategory } from "../types/models";
import { ProgressNode, CATEGORY_LABELS, categoryColorFor } from "../components/ProgressGraphNodes";
import { View } from "../types/nav";
import { StyledButton } from "../icons/StyledButton";
import { useTheme } from "../theme/ThemeContext";
import "./Page.css";
import "./ProgressWebPage.css";

const nodeTypes = { progressNode: ProgressNode };

const progressNodeId = (id: number) => `pg-${id}`;
const parseProgressNodeId = (nodeId: string) => Number(nodeId.slice(3));

const CATEGORIES = Object.keys(CATEGORY_LABELS) as ProgressCategory[];

// New nodes cascade into a loose grid so they never all land exactly on
// top of each other — same idea as the dream web's undated lane.
function positionForIndex(index: number): { x: number; y: number } {
  const col = index % 6;
  const row = Math.floor(index / 6);
  return { x: col * 140, y: row * 140 };
}

function ProgressWebInner({ onNavigate }: { onNavigate: (view: View) => void }) {
  const { theme } = useTheme();
  const [items, setItems] = useState<ProgressNodeModel[]>([]);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const load = () => {
    fetchProgressNodes().then((data) => {
      setItems(data);
      setLoading(false);
    });
  };

  useEffect(load, []);

  const itemById = useMemo(() => new Map(items.map((n) => [n.id, n])), [items]);

  useEffect(() => {
    setNodes(
      items.map((item) => ({
        id: progressNodeId(item.id),
        type: "progressNode",
        position: { x: item.posX, y: item.posY },
        data: {
          category: item.category,
          shortDescription: item.shortDescription,
          difficulty: item.difficulty,
          isComplete: item.isComplete,
          isRead: item.isRead,
          imageData: item.imageData,
        },
      }))
    );
  }, [items]);

  const onNodesChange = (changes: NodeChange[]) => {
    setNodes((nds) => applyNodeChanges(changes.filter((c) => c.type !== "remove"), nds));
  };

  const onNodeDragStop = (_: MouseEvent | TouchEvent, node: Node) => {
    const id = parseProgressNodeId(node.id);
    if (!itemById.has(id)) return;
    const { x, y } = node.position;
    updateProgressPosition(id, x, y);
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, posX: x, posY: y } : n)));
  };

  const onNodeClick = (_: React.MouseEvent, node: Node) => {
    onNavigate({ type: "progress-node-detail", nodeId: parseProgressNodeId(node.id) });
  };

  const handleAdd = async () => {
    setCreating(true);
    try {
      const { x, y } = positionForIndex(items.length);
      const id = await addProgressNode(x, y);
      onNavigate({ type: "progress-node-detail", nodeId: id });
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <div className="page">
        <p className="page-text">Loading Progress Web…</p>
      </div>
    );
  }

  return (
    <div className="progress-web-shell">
      <div className="progress-canvas-area">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
          <h1 style={{ margin: 0, fontSize: "22px" }}>Progress Web</h1>
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <button className="add-button" onClick={handleAdd} disabled={creating}>
              {creating ? "Adding…" : "+ Task"}
            </button>
            <StyledButton buttonKey="web-zoom-back" iconKey="back" onClick={() => onNavigate({ type: "home" })} />
          </div>
        </div>

        <div className="progress-legend">
          {CATEGORIES.map((c) => (
            <span key={c} className="progress-legend-item">
              <span className="progress-legend-dot" style={{ background: categoryColorFor(theme, c) }} />
              {CATEGORY_LABELS[c]}
            </span>
          ))}
        </div>

        <div className="progress-canvas">
          {items.length === 0 && (
            <div className="progress-empty-hint">No tasks yet — add one to start the board.</div>
          )}
          <ReactFlow
            nodes={nodes}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onNodeDragStop={onNodeDragStop}
            onNodeClick={onNodeClick}
            deleteKeyCode={null}
            fitView
          >
            <Panel position="top-right" className="progress-canvas-hint">
              Drag dots to arrange. Click one to open it. Ring color is the labor type, size is
              difficulty, a glowing badge means unread, and a checkmark means done.
            </Panel>
            <Background color="#64748b" bgColor={theme.progressWebBackground} gap={16} />
            <Controls />
          </ReactFlow>
        </div>
      </div>
    </div>
  );
}

export function ProgressWebPage({ onNavigate }: { onNavigate: (view: View) => void }) {
  return (
    <ReactFlowProvider>
      <ProgressWebInner onNavigate={onNavigate} />
    </ReactFlowProvider>
  );
}
