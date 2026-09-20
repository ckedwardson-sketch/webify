import { useEffect, useState } from "react";
import { fetchSkills, fetchSkillTasks } from "../db/skills";
import { Skill, SkillTask } from "../types/skill";
import "./ManagedListRow.css"; // .menu-backdrop
import "./NodeWidgetOverlay.css";
import "./TaskLinkPickerModal.css"; // .task-link-picker-list / -row

// Board card's "⋮" menu "Link to Skill" — picks from a skill's
// EXISTING skill tasks (no auto-created throwaway ones), same overlay/
// list look as TaskLinkPickerModal. Holding to complete a linked task
// then logs straight onto whichever skill task is picked here.
export function TaskSkillLinkModal({
  onLink,
  onClose,
}: {
  onLink: (skillTaskId: number) => void;
  onClose: () => void;
}) {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [skillId, setSkillId] = useState<string>("");
  const [skillTasks, setSkillTasks] = useState<SkillTask[]>([]);

  useEffect(() => {
    fetchSkills().then(setSkills);
  }, []);

  useEffect(() => {
    if (!skillId) {
      setSkillTasks([]);
      return;
    }
    fetchSkillTasks(Number(skillId)).then((tasks) => setSkillTasks(tasks.filter((t) => !t.archived)));
  }, [skillId]);

  return (
    <>
      <div className="menu-backdrop" onClick={onClose} />
      <div className="node-widget-overlay" onClick={(e) => e.stopPropagation()}>
        <div className="node-widget-overlay-header">
          <span className="node-widget-overlay-title">Link to a skill</span>
          <button type="button" className="dyn-overlay-close" onClick={onClose} title="Close">
            ✕
          </button>
        </div>
        <select className="inline-add-input" value={skillId} onChange={(e) => setSkillId(e.target.value)}>
          <option value="">Choose a skill…</option>
          {skills.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        {skillId && (
          <ul className="task-link-picker-list">
            {skillTasks.length === 0 ? (
              <li className="page-text">This skill has no tasks yet — add one on its Skill Tree first.</li>
            ) : (
              skillTasks.map((t) => (
                <li key={t.id}>
                  <button type="button" className="dropdown-item" onClick={() => onLink(t.id)}>
                    {t.name}
                  </button>
                </li>
              ))
            )}
          </ul>
        )}
      </div>
    </>
  );
}
