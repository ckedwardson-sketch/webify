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
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [loading, setLoading] = useState(true);
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

  useEffect(() => {
    async function loadGraph() {
      const { categories, recipes } = await fetchAllGraphData();

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

      filteredCategories.forEach((cat, cIdx) => {
        const catNodeId = `cat-${cat.id}`;
        const catX = cIdx * 340;
        const catY = 500; // Bottom level ("closer to viewer")

        computedNodes.push({
          id: catNodeId,
          type: "categoryNode",
          position: { x: catX, y: catY },
          data: { label: cat.name, id: cat.id },
        });

        // Top-level recipes under this category
        const catRecipes = recipes.filter(
          (r) => r.categoryId === cat.id && !r.parentRecipeId && matchesFilter(r)
        );

        catRecipes.forEach((rec, rIdx) => {
          const recNodeId = `rec-${rec.id}`;
          const recX = catX + (rIdx % 2) * 180 - 40;
          const recY = catY - 180 - Math.floor(rIdx / 2) * 160; // Moving upwards

          computedNodes.push({
            id: recNodeId,
            type: "recipeCardNode",
            position: { x: recX, y: recY },
            data: {
              label: rec.name,
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

          // Iterations branch floating directly above the parent recipe card
          if (expandedIterations[rec.id]) {
            const iterations = recipes.filter((sub) => sub.parentRecipeId === rec.id);
            iterations.forEach((iter, iIdx) => {
              const iterNodeId = `iter-${iter.id}`;
              const iterX = recX + iIdx * 150 - 20;
              const iterY = recY - 120;

              computedNodes.push({
                id: iterNodeId,
                type: "iterationNode",
                position: { x: iterX, y: iterY },
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
            });
          }
        });
      });

      setNodes(computedNodes);
      setEdges(computedEdges);
      setLoading(false);
    }

    loadGraph();
  }, [categoryId, filters, expandedIterations]);

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

  if (loading) {
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