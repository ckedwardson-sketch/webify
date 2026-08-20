// src/pages/RecipesGraphPage.tsx
import React, { useEffect, useState } from "react";
import { ReactFlow, Node, Edge, Background, Controls, Panel } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { fetchAllGraphData, GraphRecipeNode } from "../db/recipes";
import { CategoryNode, RecipeCardNode, IterationNode } from "../components/GraphNodes";
import { FilterState } from "../types/models";
import { View } from "../types/nav";
import "./Page.css";

const nodeTypes = {
  categoryNode: CategoryNode,
  recipeCardNode: RecipeCardNode,
  iterationNode: IterationNode,
};

export function RecipesGraphPage({
  categoryId,
  categoryName,
  onNavigate,
}: {
  categoryId?: number;
  categoryName?: string;
  onNavigate: (view: View) => void;
}) {
  const [rawData, setRawData] = useState<{
    categories: Array<{ id: number; name: string }>;
    recipes: GraphRecipeNode[];
  } | null>(null);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [expandedIterations, setExpandedIterations] = useState<Record<number, boolean>>({});

  const [filters, setFilters] = useState<FilterState>({
    frozen: false,
    homegrown: false,
    favorite: false,
    proven: false,
    unproven: false,
    excludeMode: false,
  });

  const toggleIteration = (recipeId: number) => {
    setExpandedIterations((prev) => ({ ...prev, [recipeId]: !prev[recipeId] }));
  };

  // Fetch once when the web is opened — not on every filter/toggle
  // change. This is the expensive part: recipe rows carry full base64
  // cover images, so re-running this on every click was the source of
  // the multi-second lag.
  useEffect(() => {
    fetchAllGraphData().then(setRawData);
  }, []);

  // Layout is pure, synchronous, in-memory work — recomputing it on
  // every filter/expand change is effectively free. No DB, no IPC.
  useEffect(() => {
    if (!rawData) return;
    const { categories, recipes } = rawData;

      // Filter categories if single category view is selected
      const filteredCategories = categoryId
        ? categories.filter((c) => c.id === categoryId)
        : categories;

      // Apply Top-Right Filter rules to recipes
      const matchesFilter = (r: GraphRecipeNode) => {
        const passesConditions =
          (!filters.frozen || r.isFrozen) &&
          (!filters.homegrown || r.isHomegrown) &&
          (!filters.favorite || r.isFavorite) &&
          (!filters.proven || r.isProven) &&
          (!filters.unproven || !r.isProven);

        return filters.excludeMode ? !passesConditions : passesConditions;
      };

      const computedNodes: Node[] = [];
      const computedEdges: Edge[] = [];

      // Layout constants. Category width now scales with how many
      // recipes it actually has, so categories don't bleed into each
      // other. Each column tracks its own vertical cursor, so an
      // expanded iteration reserves real space instead of just
      // floating at a fixed offset on top of whatever's already there.
      const CARD_WIDTH = 210;
      const CARD_HEIGHT = 144;
      const COLUMN_GAP = 90; // wide enough that a 2-wide iteration cluster (which overhangs its own card by ~53px per side) can't reach the next column
      const ROW_GAP = 50;
      const CATEGORY_GAP = 100;
      const TOP_MARGIN = 220;
      const ITER_WIDTH = 150;
      const ITER_COL_GAP = 16;
      const ITER_HEIGHT = 80;
      const ITER_GAP = 50; // was tighter than ROW_GAP, leaving too little clearance to the next card above
      const CAT_Y = 700;

      let cursorX = 0;

      filteredCategories.forEach((cat) => {
        const catRecipes = recipes.filter(
          (r) => r.categoryId === cat.id && !r.parentRecipeId && matchesFilter(r)
        );

        // Roughly-square grid: more recipes -> more columns, so a big
        // category grows both wider and taller instead of just taller.
        const columns = Math.max(1, Math.ceil(Math.sqrt(catRecipes.length || 1)));
        const clusterWidth = columns * CARD_WIDTH + (columns - 1) * COLUMN_GAP;
        const clusterLeft = cursorX;
        const catX = clusterLeft + clusterWidth / 2;

        const catNodeId = `cat-${cat.id}`;
        computedNodes.push({
          id: catNodeId,
          type: "categoryNode",
          position: { x: catX, y: CAT_Y },
          data: { label: cat.name, id: cat.id },
        });

        // One running "how far up have we placed things" cursor per
        // column, instead of a fixed formula per row.
        const columnCursors = new Array(columns).fill(CAT_Y - TOP_MARGIN);

        catRecipes.forEach((rec, rIdx) => {
          const col = rIdx % columns;
          const recX = clusterLeft + col * (CARD_WIDTH + COLUMN_GAP);
          const recY = columnCursors[col];
          columnCursors[col] -= CARD_HEIGHT + ROW_GAP;

          const recNodeId = `rec-${rec.id}`;
          computedNodes.push({
            id: recNodeId,
            type: "recipeCardNode",
            position: { x: recX, y: recY },
            data: {
              label: rec.name,
              imageData: rec.imageData,
              isFrozen: rec.isFrozen,
              isHomegrown: rec.isHomegrown,
              isFavorite: rec.isFavorite,
              isProven: rec.isProven,
              recipeId: rec.id,
              categoryId: cat.id,
              categoryName: cat.name,
              onIterationClick: () => toggleIteration(rec.id),
            },
          });

          computedEdges.push({
            id: `e-${catNodeId}-${recNodeId}`,
            source: catNodeId,
            target: recNodeId,
            animated: true,
            style: { stroke: "#64748b", strokeWidth: 2 },
          });

          // Iterations arranged 2-wide directly above their parent
          // card. Space is reserved per ROW of two (not per item) in
          // this column's cursor, and IterationNode has a fixed,
          // clamped size now — so what gets reserved always matches
          // what actually renders, and nothing above gets covered.
          if (expandedIterations[rec.id]) {
            const iterations = recipes.filter((sub) => sub.parentRecipeId === rec.id);
            const iterColumns = 2;
            const iterClusterWidth =
              iterColumns * ITER_WIDTH + (iterColumns - 1) * ITER_COL_GAP;
            const iterClusterLeft = recX + CARD_WIDTH / 2 - iterClusterWidth / 2;
            const iterRows = Math.ceil(iterations.length / iterColumns);

            for (let row = 0; row < iterRows; row++) {
              const rowY = columnCursors[col];
              columnCursors[col] -= ITER_HEIGHT + ITER_GAP;

              for (let c = 0; c < iterColumns; c++) {
                const idx = row * iterColumns + c;
                if (idx >= iterations.length) break;
                const iter = iterations[idx];
                const iterX = iterClusterLeft + c * (ITER_WIDTH + ITER_COL_GAP);

                const iterNodeId = `iter-${iter.id}`;
                computedNodes.push({
                  id: iterNodeId,
                  type: "iterationNode",
                  position: { x: iterX, y: rowY },
                  data: {
                    label: iter.name,
                    difference: iter.iterationDifference || "Modified ingredient ratios",
                    recipeId: iter.id,
                    categoryId: cat.id,
                    categoryName: cat.name,
                  },
                });

                computedEdges.push({
                  id: `e-${recNodeId}-${iterNodeId}`,
                  source: recNodeId,
                  target: iterNodeId,
                  style: { stroke: "#38bdf8", strokeDasharray: "5,5" },
                });
              }
            }
          }
        });

        cursorX += clusterWidth + CATEGORY_GAP;
      });

      setNodes(computedNodes);
      setEdges(computedEdges);
  }, [rawData, categoryId, filters, expandedIterations]);

  const handleNodeClick = (_: React.MouseEvent, node: Node) => {
    if (node.type === "recipeCardNode" || node.type === "iterationNode") {
      onNavigate({
        type: "recipe-detail",
        categoryId: node.data.categoryId as number,
        categoryName: node.data.categoryName as string,
        recipeId: node.data.recipeId as number,
      });
    }
  };

  if (!rawData) {
    return (
      <div className="page">
        <p className="page-text">Loading Graph…</p>
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        width: "100%",
        padding: "16px",
        boxSizing: "border-box",
      }}
    >
      {/* Top Controls Header */}
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "12px" }}>
        <h1 style={{ margin: 0, fontSize: "22px" }}>
          {categoryName ? `${categoryName} Web` : "Recipe Web"}
        </h1>

        {/* Top Right Filter Toggle */}
        <div style={{ position: "relative" }}>
          <button
            onClick={() => setShowFilterMenu(!showFilterMenu)}
            style={{
              padding: "8px 14px",
              borderRadius: "6px",
              background: "#3b82f6",
              color: "#fff",
              border: "none",
              cursor: "pointer",
              fontWeight: "bold",
            }}
          >
            🔽 Filter
          </button>

          {/* Filter Dropdown Menu (Matches Left Sketch Layout) */}
          {showFilterMenu && (
            <div
              style={{
                position: "absolute",
                right: 0,
                top: "40px",
                width: "200px",
                backgroundColor: "#1e293b",
                border: "1px solid #475569",
                borderRadius: "8px",
                padding: "12px",
                zIndex: 100,
                boxShadow: "0 10px 25px rgba(0,0,0,0.5)",
                color: "#fff",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                <label style={{ fontSize: "12px", fontWeight: "bold" }}>
                  <input
                    type="radio"
                    name="mode"
                    checked={!filters.excludeMode}
                    onChange={() => setFilters({ ...filters, excludeMode: false })}
                  />{" "}
                  Include
                </label>
                <label style={{ fontSize: "12px", fontWeight: "bold" }}>
                  <input
                    type="radio"
                    name="mode"
                    checked={filters.excludeMode}
                    onChange={() => setFilters({ ...filters, excludeMode: true })}
                  />{" "}
                  Exclude
                </label>
              </div>

              <hr style={{ borderColor: "#334155" }} />

              {[
                { key: "frozen", label: "Frozen" },
                { key: "homegrown", label: "Homegrown" },
                { key: "favorite", label: "Favorite" },
                { key: "proven", label: "Proven" },
                { key: "unproven", label: "Unproven" },
              ].map(({ key, label }) => (
                <label
                  key={key}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: "13px",
                    margin: "6px 0",
                    cursor: "pointer",
                  }}
                >
                  <span>{label}</span>
                  <input
                    type="checkbox"
                    checked={(filters as any)[key]}
                    onChange={(e) => setFilters({ ...filters, [key]: e.target.checked })}
                  />
                </label>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Full-Window Expanding Canvas */}
      <div style={{ flex: 1, width: "100%", border: "1px solid #334155", borderRadius: "8px" }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodeClick={handleNodeClick}
          fitView
        >
          {/* Zoom Out & Reset Controls embedded inside Canvas Top-Left */}
          <Panel position="top-left">
            <button
              onClick={() => onNavigate({ type: "recipes-home" })}
              style={{
                padding: "6px 12px",
                background: "#0f172a",
                color: "#fff",
                border: "1px solid #475569",
                borderRadius: "6px",
                cursor: "pointer",
              }}
            >
              🔍 Zoom Out / Back
            </button>
          </Panel>

          <Background color="#1e293b" gap={16} />
          <Controls />
        </ReactFlow>
      </div>
    </div>
  );
}
