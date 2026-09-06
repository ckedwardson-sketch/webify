import React from "react";
import { useTheme } from "./ThemeContext";
import { parsePaneShapeProfile, paneShapeStyleVars } from "./paneShape";

export type PaneShapeSurface = "project" | "skill" | "recipe" | "responsibility";

const OVERRIDE_KEY: Record<PaneShapeSurface, "projectPaneShape" | "skillPaneShape" | "recipePaneShape" | "responsibilityPaneShape"> = {
  project: "projectPaneShape",
  skill: "skillPaneShape",
  recipe: "recipePaneShape",
  responsibility: "responsibilityPaneShape",
};

// Wraps a pane/icon-grid surface (Projects, Skills, Recipes,
// Responsibilities) so its cards can consume --pane-radius/
// --pane-border-shadow and the data-pane-truncation attribute via the
// .pane-shape-surface / .pane-shape-label utility classes in theme.css,
// without each page parsing its own JSON field. Same display:"contents"
// pattern as SectionThemeScope.tsx.
export function PaneShapeScope({ surface, children }: { surface: PaneShapeSurface; children: React.ReactNode }) {
  const { theme } = useTheme();
  const profile = parsePaneShapeProfile(theme[OVERRIDE_KEY[surface]]);
  const style: React.CSSProperties = { display: "contents", ...paneShapeStyleVars(profile) };

  return (
    <div style={style} data-pane-truncation={profile.truncation}>
      {children}
    </div>
  );
}
