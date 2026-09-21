import { sidebarItems } from "../data/appData";
import { View } from "../types/nav";
import { useRearrangeMode } from "../rearrange/RearrangeModeContext";
import { isMobileLayoutActive } from "../theme/mobileLayout";
import { sidebarNavHeaderKey } from "../icons/headerRegistry";
import { StyledHeader } from "./StyledHeader";
import { Icon } from "../icons/Icon";
import { useTheme } from "../theme/ThemeContext";
import "./Sidebar.css";

interface SidebarProps {
  view: View;
  onNavigate: (view: View) => void;
  onToggle: () => void;
  // The view last visited within each sidebar section (keyed by the same
  // label used below and in nav/navHistory.ts's sidebarSectionForView),
  // so clicking a section you've already drilled into picks up where you
  // left off instead of always resetting to that section's home view —
  // see App.tsx's lastViewBySection.
  lastViewBySection?: Record<string, View>;
}

export function Sidebar({ view, onNavigate, onToggle, lastViewBySection }: SidebarProps) {
  const { active: rearranging, enter: enterRearrangeMode, exit: exitRearrangeMode } = useRearrangeMode();
  const { theme } = useTheme();
  const isActive = (label: string) => {
    if (label === "Home") return view.type === "home";
    if (label === "Recipes") return view.type.startsWith("recipe");
    if (label === "Settings") return view.type.startsWith("settings");
    if (label === "Responsibilities") return view.type.startsWith("responsibilit");
    if (label === "Tasks") return view.type.startsWith("tasks");
    if (label === "Dreams") return view.type === "dreams-web" || view.type === "dream-detail";
    if (label === "Projects") return view.type.startsWith("project") || view.type.startsWith("progress");
    if (label === "Goals") return view.type.startsWith("goal");
    if (label === "Notes") return view.type === "notes";
    if (label === "Skills") return view.type.startsWith("skill");
    if (label === "Checklist") return view.type.startsWith("checklist");
    if (label === "Quick Apps") return view.type.startsWith("quick-apps");
    if (view.type === "placeholder") return view.label === label;
    return false;
  };

  const handleClick = (label: string, isPlaceholder: boolean, skipRemembered = false) => {
    // Already somewhere in this section (e.g. several layers deep on a
    // recipe or goal web) — go back to exactly that page instead of
    // resetting to the section's home view. See App.tsx's
    // lastViewBySection, kept in sync with the same partition used above
    // by isActive (nav/navHistory.ts's sidebarSectionForView).
    const remembered = skipRemembered ? undefined : lastViewBySection?.[label];
    if (remembered) return onNavigate(remembered);

    if (label === "Home") return onNavigate({ type: "home" });
    if (label === "Recipes") return onNavigate({ type: "recipes-home" });
    if (label === "Settings") return onNavigate({ type: "settings-home" });
    if (label === "Responsibilities") return onNavigate({ type: "responsibilities-home" });
    if (label === "Tasks") return onNavigate({ type: "tasks-home" });
    if (label === "Dreams") return onNavigate({ type: "dreams-web" });
    if (label === "Projects") return onNavigate({ type: "projects-home" });
    if (label === "Goals") return onNavigate({ type: "goals-home" });
    if (label === "Notes") return onNavigate({ type: "notes" });
    if (label === "Skills") return onNavigate({ type: "skills-home" });
    if (label === "Checklist") return onNavigate({ type: "checklist-home" });
    if (label === "Quick Apps") return onNavigate({ type: "quick-apps-home" });
    if (isPlaceholder) return onNavigate({ type: "placeholder", label });
  };

  const handleNav = (label: string, isPlaceholder: boolean, skipRemembered = false) => {
    handleClick(label, isPlaceholder, skipRemembered);
    if (isMobileLayoutActive() && theme.sidebarAutoCloseOnMobileNav !== "0") onToggle();
  };

  return (
    <nav className="sidebar" data-color-surface="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-title">
          <StyledHeader headerKey="sidebar-title">My System</StyledHeader>
        </div>
        <button
          className="sidebar-toggle"
          type="button"
          aria-label="Hide sidebar"
          onClick={onToggle}
        >
          ‹
        </button>
      </div>
      <ul className="sidebar-list">
        {sidebarItems.map((item) => (
          <li key={item.label}>
            <button
              className={`sidebar-item ${isActive(item.label) ? "active" : ""}`}
              onClick={() => handleNav(item.label, item.isPlaceholder)}
              onDoubleClick={() => handleNav(item.label, item.isPlaceholder, true)}
            >
              <span className="sidebar-item-icon">
                <Icon iconKey={item.iconKey} size={20} />
              </span>
              <span className="sidebar-item-label">
                <StyledHeader headerKey={sidebarNavHeaderKey(item.label)}>{item.label}</StyledHeader>
              </span>
            </button>
          </li>
        ))}
      </ul>
      <button
        className={`sidebar-item sidebar-rearrange-trigger${rearranging ? " active" : ""}`}
        onClick={rearranging ? exitRearrangeMode : enterRearrangeMode}
        title={
          rearranging
            ? "Exit rearrange mode"
            : "Reorder, add, or save/load layouts of the widgets on a project or goal page"
        }
      >
        ↕ <StyledHeader headerKey="sidebar-rearrange">Rearrange</StyledHeader>
      </button>
    </nav>
  );
}