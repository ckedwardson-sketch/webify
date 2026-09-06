// src/pages/RecipesGraphPage.tsx
import React, { useEffect, useMemo, useState } from "react";
import { ReactFlow, Node, Edge, Background, Panel, ViewportPortal } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { fetchAllGraphData, GraphRecipeNode } from "../db/recipes";
import { CategoryNode, RecipeCardNode, IterationNode } from "../components/GraphNodes";
import { FilterState } from "../types/models";
import { View } from "../types/nav";
import { StyledButton } from "../icons/StyledButton";
import { WebControls } from "../components/WebControls";
import { useTheme } from "../theme/ThemeContext";
import { parseDecals } from "../theme/decals";
import { DecalLayer } from "../theme/DecalLayer";
import { usePageBackground, pageSurfaceStyle } from "../theme/PageBackgroundContext";
import { useNodeScaleSettings } from "../webGraph/useNodeScaleSettings";
import { computeNodeScales } from "../webGraph/nodeScale";
import "./Page.css";

const RECIPE_WEB_SCOPE_KEY = "section:recipes-graph";
// Never auto-zoom out past this on load/"Fit" — see the fitViewOptions
// comment below for why. 0.65 keeps the ~13px card labels rendering at
// a comfortably readable on-screen size.
const RECIPE_WEB_FIT_MIN_ZOOM = 0.65;

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
  const { overrides: pageBgOverrides } = usePageBackground();
  const [rawData, setRawData] = useState<{
    categories: Array<{ id: number; name: string }>;
    recipes: GraphRecipeNode[];
  } | null>(null);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [expandedIterations, setExpandedIterations] = useState<Record<number, boolean>>({});
  const { theme } = useTheme();
  const decals = useMemo(() => parseDecals(theme.decals), [theme.decals]);
  const { settings: nodeScaleSettings, loaded: nodeScaleLoaded } = useNodeScaleSettings(RECIPE_WEB_SCOPE_KEY);

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
    if (!rawData || !nodeScaleLoaded) return;
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

      // Layout constants. Card width/height/columns now come from the
      // shared node-scaling engine (see webGraph/nodeScale.ts) instead
      // of being fixed — a category's cards grow or shrink based on how
      // many recipes it actually has (and the user's Page Settings for
      // this web). Column/row gaps scale alongside the card size so
      // spacing stays visually consistent whether cards are tiny or huge.
      // Each column tracks its own vertical cursor, so an expanded
      // iteration reserves real space instead of just floating at a
      // fixed offset on top of whatever's already there.
      const COLUMN_GAP_BASE = 90; // wide enough that a 2-wide iteration cluster (which overhangs its own card by ~53px per side) can't reach the next column
      const ROW_GAP_BASE = 50;
      const CATEGORY_GAP = 100;
      const TOP_MARGIN = 220;
      const ITER_WIDTH = 150;
      const ITER_COL_GAP = 16;
      const ITER_HEIGHT = 80;
      const ITER_GAP = 50; // was tighter than ROW_GAP, leaving too little clearance to the next card above
      const CAT_Y = 700;

      const categoryCounts: Record<string, number> = {};
      filteredCategories.forEach((cat) => {
        categoryCounts[String(cat.id)] = recipes.filter(
          (r) => r.categoryId === cat.id && !r.parentRecipeId && matchesFilter(r)
        ).length;
      });
      const categoryScales = computeNodeScales(categoryCounts, nodeScaleSettings);

      let cursorX = 0;

      filteredCategories.forEach((cat) => {
        const catRecipes = recipes.filter(
          (r) => r.categoryId === cat.id && !r.parentRecipeId && matchesFilter(r)
        );

        const scale = categoryScales[String(cat.id)];
        const cardWidth = scale.width;
        const cardHeight = scale.height;
        const fontScale = scale.fontScale;
        const columns = scale.columns;
        const sizeRatio = cardWidth / nodeScaleSettings.baseWidth;
        const columnGap = Math.max(30, COLUMN_GAP_BASE * sizeRatio);
        const rowGap = Math.max(20, ROW_GAP_BASE * sizeRatio);
        const clusterWidth = columns * cardWidth + (columns - 1) * columnGap;
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
          const recX = clusterLeft + col * (cardWidth + columnGap);
          const recY = columnCursors[col];
          columnCursors[col] -= cardHeight + rowGap;

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
              isFutureSlot: rec.isFutureSlot,
              recipeId: rec.id,
              categoryId: cat.id,
              categoryName: cat.name,
              onIterationClick: () => toggleIteration(rec.id),
              width: cardWidth,
              height: cardHeight,
              fontScale,
            },
          });

          computedEdges.push({
            id: `e-${catNodeId}-${recNodeId}`,
            source: catNodeId,
            target: recNodeId,
            animated: true,
            style: { stroke: theme.webNodeOutlineColor, strokeWidth: 2 },
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
            const iterClusterLeft = recX + cardWidth / 2 - iterClusterWidth / 2;
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
                  style: { stroke: theme.accent, strokeDasharray: "5,5" },
                });
              }
            }
          }
        });

        cursorX += clusterWidth + CATEGORY_GAP;
      });

      setNodes(computedNodes);
      setEdges(computedEdges);
  }, [rawData, categoryId, filters, expandedIterations, theme, nodeScaleSettings, nodeScaleLoaded]);

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
      className="recipe-web-shell"
      data-color-surface="page-bg"
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        width: "100%",
        padding: "16px",
        boxSizing: "border-box",
        ...pageSurfaceStyle(pageBgOverrides["page-bg"]),
      }}
    >
      {/* Top Controls Header */}
      <div className="web-page-header">
        <h1 className="page-title" style={{ margin: 0 }}>
          {categoryName ? `${categoryName} Web` : "Recipe Web"}
        </h1>

        {/* Top Right Filter Toggle */}
        <div className="web-page-header-actions" style={{ position: "relative" }}>
          <StyledButton
            buttonKey="web-filter-toggle"
            iconKey="filter"
            onClick={() => setShowFilterMenu(!showFilterMenu)}
          />

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
      <div
        style={{
          flex: 1,
          width: "100%",
          border: "1px solid #334155",
          borderRadius: "8px",
          overflow: "hidden",
          backgroundImage: theme.webBackgroundImage ? `url("${theme.webBackgroundImage}")` : "none",
          backgroundSize: theme.webBackgroundTile === "1" ? `${theme.webBackgroundScale || "128"}px` : "cover",
          backgroundRepeat: theme.webBackgroundTile === "1" ? "repeat" : "no-repeat",
          backgroundPosition: "center",
        }}
      >
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodeClick={handleNodeClick}
          fitView
          // A "fit everything" zoom shrinks text (rendered in
          // canvas-space) proportionally with it — with more than a
          // few categories, that means the default view lands at a
          // zoom where no card is legible no matter how big its box is.
          // Flooring the automatic fit keeps the initial view readable;
          // if the whole graph doesn't fit at that floor, it overflows
          // the viewport and you pan/scroll to the rest instead of
          // everything shrinking to fit on screen at once.
          fitViewOptions={{ minZoom: RECIPE_WEB_FIT_MIN_ZOOM, padding: 0.15 }}
          minZoom={0.05}
          maxZoom={4}
          panOnDrag
          zoomOnPinch
          proOptions={{ hideAttribution: true }}
        >
          {/* Zoom Out & Reset Controls embedded inside Canvas Top-Left */}
          <Panel position="top-left">
            <StyledButton
              buttonKey="web-zoom-back"
              iconKey="back"
              onClick={() => onNavigate({ type: "recipes-home" })}
            />
          </Panel>

          <Background
            color={theme.webGridColor}
            bgColor={theme.webBackgroundImage ? "transparent" : theme.webBackground}
            gap={16}
          />
          <WebControls fitViewMinZoom={RECIPE_WEB_FIT_MIN_ZOOM} />
          <ViewportPortal>
            <DecalLayer decals={decals} target="canvas" surface="section:recipes-graph" />
          </ViewportPortal>
        </ReactFlow>
      </div>
    </div>
  );
}
