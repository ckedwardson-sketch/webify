export interface SidebarItem {
  label: string;
  isPlaceholder: boolean;
}

// Inventory is still a stub for now — clicking it shows a "coming
// soon" page. Progress Webs isn't its own sidebar entry — only projects
// have one, opened from inside a project page.
export const sidebarItems: SidebarItem[] = [
  { label: "Home", isPlaceholder: false },
  { label: "Dreams", isPlaceholder: false },
  { label: "Goals", isPlaceholder: false },
  { label: "Projects", isPlaceholder: false },
  { label: "Recipes", isPlaceholder: false },
  { label: "Responsibilities", isPlaceholder: false },
  { label: "Inventory", isPlaceholder: true },
  { label: "Notes", isPlaceholder: false },
  { label: "Settings", isPlaceholder: false },
];
