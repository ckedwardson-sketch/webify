import { sidebarItems } from "../data/appData";
import { View } from "../types/nav";
import "./Sidebar.css";

interface SidebarProps {
  view: View;
  onNavigate: (view: View) => void;
  onToggle: () => void;
}

export function Sidebar({ view, onNavigate, onToggle }: SidebarProps) {
  const isActive = (label: string) => {
    if (label === "Home") return view.type === "home";
    if (label === "Recipes") return view.type.startsWith("recipe");
    if (label === "Settings") return view.type.startsWith("settings");
    if (label === "Responsibilities") return view.type.startsWith("responsibilit");
    if (label === "Dreams") return view.type === "dreams-web" || view.type === "dream-detail";
    if (label === "Projects") return view.type.startsWith("project");
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
    if (isPlaceholder) return onNavigate({ type: "placeholder", label });
  };

  const handleNav = (label: string, isPlaceholder: boolean) => {
    handleClick(label, isPlaceholder);
    if (window.matchMedia("(max-width: 768px)").matches) onToggle();
  };

  return (
    <nav className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-title">My System</div>
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
              {item.label}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
