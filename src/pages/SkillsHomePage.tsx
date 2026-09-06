import { useEffect, useMemo, useState } from "react";
import { View } from "../types/nav";
import { Skill, SkillTreeDirection, DEFAULT_SKILL_SETTINGS } from "../types/skill";
import { addSkill, deleteSkill, fetchSkills, saveSkillSettings, reorderSkills } from "../db/skills";
import { useReorderableList } from "../hooks/useReorderableList";
import { itemIdAtPoint } from "../hooks/dragReorder";
import { PaneShapeScope } from "../theme/PaneShapeScope";
import { useTheme } from "../theme/ThemeContext";
import { usePageBackground, pageSurfaceStyle } from "../theme/PageBackgroundContext";
import { parseDecals } from "../theme/decals";
import { DecalLayer } from "../theme/DecalLayer";
import "./Page.css";
import "./SkillsHomePage.css";

export function SkillsHomePage({ onNavigate }: { onNavigate: (view: View) => void }) {
  const { theme } = useTheme();
  const { overrides: pageBgOverrides, scopeKey: pageBgScopeKey } = usePageBackground();
  const decals = useMemo(() => parseDecals(theme.decals), [theme.decals]);
  const { items: skills, setItems: setSkills, draggedId, handleDragStart, handleDragOver, handleDragEnd } =
    useReorderableList<Skill>(reorderSkills);
  const [loading, setLoading] = useState(true);
  const [nameDraft, setNameDraft] = useState("");
  const [adding, setAdding] = useState(false);

  const reload = () => {
    fetchSkills().then((rows) => {
      setSkills(rows);
      setLoading(false);
    });
  };

  // Grid-mode drag reorder uses the same pointer-capture gesture as
  // PaneGrid/ManagedListRow (see hooks/dragReorder.ts) rather than
  // native HTML5 drag-and-drop, so it works the same on touch.
  const handleCardPointerDown = (e: React.PointerEvent, id: number) => {
    if (e.button !== undefined && e.button !== 0 && e.pointerType === "mouse") return;
    e.currentTarget.setPointerCapture(e.pointerId);
    handleDragStart(id);
  };

  const handleCardPointerMove = (e: React.PointerEvent) => {
    if (draggedId === null) return;
    e.preventDefault();
    const overId = itemIdAtPoint(e.clientX, e.clientY);
    if (overId !== null) handleDragOver(overId);
  };

  const endCardDrag = (e: React.PointerEvent) => {
    if (draggedId === null) return;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    handleDragEnd();
  };

  useEffect(() => {
    reload();
  }, []);

  // "manual" leaves fetch order (drag-reorder) untouched. "created"/
  // "updated" go newest-first, matching Goals/Projects.
  const sortedSkills = useMemo(() => {
    const order = theme.skillHomeSortOrder;
    if (order === "name") {
      return [...skills].sort((a, b) => a.name.localeCompare(b.name));
    }
    if (order === "created") {
      return [...skills].sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
    }
    if (order === "updated") {
      return [...skills].sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""));
    }
    return skills;
  }, [skills, theme.skillHomeSortOrder]);

  // Applies the theme's skillTreeDefaultDirection to a freshly-created
  // skill's settings row, so a "vertical" theme doesn't leave every new
  // skill starting horizontal — existing skills are untouched (each
  // keeps whatever direction it already saved, editable in its own
  // settings panel).
  const applyDefaultDirection = (skillId: number) => {
    const direction = (theme.skillTreeDefaultDirection as SkillTreeDirection) || "horizontal";
    return saveSkillSettings({ skillId, ...DEFAULT_SKILL_SETTINGS, direction });
  };

  const handleAdd = async () => {
    const name = nameDraft.trim();
    if (!name) return;
    setAdding(true);
    try {
      const id = await addSkill(name);
      await applyDefaultDirection(id);
      setNameDraft("");
      onNavigate({ type: "skill-tree", skillId: id });
    } finally {
      setAdding(false);
    }
  };

  // Quick-add mode skips the name text box entirely — the skill is
  // created with a placeholder name and the tree page's existing
  // click-to-rename title (see SkillTreePage.tsx's editingName) is where
  // it actually gets named.
  const handleQuickAdd = async () => {
    setAdding(true);
    try {
      const id = await addSkill("New Skill");
      await applyDefaultDirection(id);
      onNavigate({ type: "skill-tree", skillId: id });
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Delete this skill? Its whole tree, tasks, and work history will be permanently removed.")) return;
    await deleteSkill(id);
    reload();
  };

  if (loading) return <div className="page"><p className="page-text">Loading…</p></div>;

  const addControl = (
    <div className={`skills-add-row skills-add-row--${theme.skillAddControlPosition}`}>
      {theme.skillCreateMode === "quick-add" ? (
        <button className="add-button" disabled={adding} onClick={handleQuickAdd}>
          + Add Skill
        </button>
      ) : (
        <>
          <input
            className="inline-add-input"
            placeholder="New skill (e.g. Welding)"
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          />
          <button className="add-button" disabled={!nameDraft.trim() || adding} onClick={handleAdd}>
            Add Skill
          </button>
        </>
      )}
    </div>
  );
  const addControlAtBottom = theme.skillAddControlPosition === "bottom-left" || theme.skillAddControlPosition === "bottom-right";

  return (
    <div className="page" data-color-surface="page-bg" style={pageSurfaceStyle(pageBgOverrides["page-bg"])}>
      <DecalLayer decals={decals} target="page-bg" surface={pageBgScopeKey ?? undefined} />
      <div className="page-header">
        <h1 className="page-title">Skills</h1>
      </div>
      <p className="page-text skills-intro">
        A skill develops on its own tree of goals and work — separate from any one Dream, connectable to any number of them.
      </p>

      {!addControlAtBottom && addControl}

      {skills.length === 0 ? (
        <p className="page-text">No skills yet — add one above to start its tree.</p>
      ) : theme.skillHomeViewMode === "list" ? (
        <ul className="list">
          {sortedSkills.map((skill) => (
            <li key={skill.id}>
              <div className="projects-list-row">
                <button className="projects-list-item" onClick={() => onNavigate({ type: "skill-tree", skillId: skill.id })}>
                  <span className="projects-list-item-name">{skill.name}</span>
                  {skill.currentLevelName && <span className="projects-list-item-dream">"{skill.currentLevelName}"</span>}
                </button>
                <button className="icon-button danger" onClick={(e) => handleDelete(skill.id, e)} title="Delete skill">
                  🗑
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <PaneShapeScope surface="skill">
          <div className="skills-grid">
            {sortedSkills.map((skill) => (
              <div
                key={skill.id}
                className={`skill-card-item${draggedId === skill.id ? " skill-card-item-dragging" : ""}`}
                data-item-id={skill.id}
                onPointerDown={(e) => handleCardPointerDown(e, skill.id)}
                onPointerMove={handleCardPointerMove}
                onPointerUp={endCardDrag}
                onPointerCancel={endCardDrag}
              >
                <button
                  className="skill-card pane-shape-surface"
                  onClick={() => onNavigate({ type: "skill-tree", skillId: skill.id })}
                >
                  <div className="skill-card-name pane-shape-label">{skill.name}</div>
                  {skill.currentLevelName && <div className="skill-card-level">"{skill.currentLevelName}"</div>}
                  <button className="icon-button danger skill-card-delete" onClick={(e) => handleDelete(skill.id, e)} title="Delete skill">
                    🗑
                  </button>
                  <DecalLayer decals={decals} target="pane" surface="skill" />
                </button>
              </div>
            ))}
          </div>
        </PaneShapeScope>
      )}

      {addControlAtBottom && addControl}
    </div>
  );
}
