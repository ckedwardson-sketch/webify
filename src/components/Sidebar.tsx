import { sidebarItems } from "../data/appData";
import { View } from "../types/nav";
import { useRearrangeMode } from "../rearrange/RearrangeModeContext";
import { isMobileLayoutActive } from "../theme/mobileLayout";
import { sidebarNavHeaderKey } from "../icons/headerRegistry";
import { StyledHeader } from "./StyledHeader";
import "./Sidebar.css";

interface SidebarProps {
  view: View;
  onNavigate: (view: View) => void;
  onToggle: () => void;
}

export function Sidebar({ view, onNavigate, onToggle }: SidebarProps) {
  const { active: rearranging, enter: enterRearrangeMode, exit: exitRearrangeMode } = useRearrangeMode();
  const isActive = (label: string) => {
    if (label === "Home") return view.type === "home";
    if (label === "Recipes") return view.type.startsWith("recipe");
    if (label === "Settings") return view.type.startsWith("settings");
    if (label === "Responsibilities") return view.type.startsWith("responsibilit");
    if (label === "Dreams") return view.type === "dreams-web" || view.type === "dream-detail";
    if (label === "Projects") return view.type.startsWith("project") || view.type.startsWith("progress");
    if (label === "Goals") return view.type.startsWith("goal");
    if (label === "Notes") return view.type === "notes";
    if (view.type === "placeholder") return view.label === label;
    return false;
  };

  const handleClick = (label: string, isPlaceholder: boolean) => {
    if (label === "Home") return onNavigate({ type: "home" });
    if (label === "Recipes") return onNavigate({ type: "recipes-home" });
    if (label === "Settings") return onNavigate({ type: "settings-home" });
    if (label === "Responsibilities") return onNavigate({ type: "responsibilities-home" });
    if (label === "Dreams") return onNavigate({ type: "dreams-web" });
    if (label === "Projects") return onNavigate({ type: "projects-home" });
    if (label === "Goals") return onNavigate({ type: "goals-home" });
    if (label === "Notes") return onNavigate({ type: "notes" });
    if (isPlaceholder) return onNavigate({ type: "placeholder", label });
  };

  const handleNav = (label: string, isPlaceholder: boolean) => {
    handleClick(label, isPlaceholder);
    if (isMobileLayoutActive()) onToggle();
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
            >
              <StyledHeader headerKey={sidebarNavHeaderKey(item.label)}>{item.label}</StyledHeader>
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
