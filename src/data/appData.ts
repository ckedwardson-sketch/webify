export interface SidebarItem {
  label: string;
  isPlaceholder: boolean;
  // Key into icons/registry.ts — used by the sidebar's icon-based
  // layout modes (see theme.sidebarMode / Sidebar.tsx). Overridable the
  // same way as any other app icon (icons/IconContext.tsx).
  iconKey: string;
}

// Inventory is still a stub for now — clicking it shows a "coming
// soon" page. Progress Webs isn't its own sidebar entry — only projects
// have one, opened from inside a project page.
export const sidebarItems: SidebarItem[] = [
  { label: "Home", isPlaceholder: false, iconKey: "nav-home" },
  { label: "Quick Apps", isPlaceholder: false, iconKey: "nav-quick-apps" },
  { label: "Dreams", isPlaceholder: false, iconKey: "nav-dreams" },
  { label: "Goals", isPlaceholder: false, iconKey: "nav-goals" },
  { label: "Projects", isPlaceholder: false, iconKey: "nav-projects" },
  { label: "Skills", isPlaceholder: false, iconKey: "nav-skills" },
  { label: "Recipes", isPlaceholder: false, iconKey: "nav-recipes" },
  { label: "Responsibilities", isPlaceholder: false, iconKey: "nav-responsibilities" },
  { label: "Tasks", isPlaceholder: false, iconKey: "nav-tasks" },
  { label: "Inventory", isPlaceholder: true, iconKey: "nav-inventory" },
  { label: "Notes", isPlaceholder: false, iconKey: "nav-notes" },
  { label: "Settings", isPlaceholder: false, iconKey: "nav-settings" },
];
