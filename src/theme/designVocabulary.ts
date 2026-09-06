import { ICON_REGISTRY } from "../icons/registry";
import { NODE_SHAPE_OPTIONS } from "./nodeShapes";
import { DECAL_ANCHOR_OPTIONS } from "./decals";

// The combined "design vocabulary" for an AI designer — every fixed
// key/enum the theme system accepts, in one place, instead of the
// icon registry, node-shape registry, pane-shape enums, and decal
// enums being three-and-a-half separate source files a designer would
// have to already know exist. Bundled as design-vocabulary.json by
// ExportToAiModal.tsx. This intentionally duplicates a few values
// already in icon-registry.json/theme-variable-reference.json — the
// point is one file a designer can read start-to-finish, not a new
// source of truth.
export function buildDesignVocabularyDoc() {
  return {
    icons: ICON_REGISTRY.map((i) => ({ key: i.key, label: i.label, defaultGlyph: i.defaultGlyph })),
    nodeShapes: NODE_SHAPE_OPTIONS,
    paneShape: {
      curve: ["sharp", "soft", "round", "pill"],
      truncation: ["clip", "ellipsis", "wrap", "wrap-2", "wrap-3"],
      borderLayers: "up to 4, each {enabled, color, width (px), offset (px gap from previous layer)}",
      surfaces: ["project", "skill", "recipe", "responsibility"],
      fields: ["projectPaneShape", "skillPaneShape", "recipePaneShape", "responsibilityPaneShape"],
    },
    decals: {
      target: ["pane", "canvas", "page-bg"],
      anchor: DECAL_ANCHOR_OPTIONS,
      paneSurfaces: ["project", "skill", "recipe", "responsibility"],
      canvasAndPageBgSurfaces: [
        "section:dreams-web",
        "section:goal-web",
        "section:recipes-graph",
        "section:projects-home",
        "section:goals-home",
        "section:recipes-home",
        "section:responsibilities-home",
        "section:skills-home",
        "section:notes",
      ],
      field: "decals",
    },
  };
}
