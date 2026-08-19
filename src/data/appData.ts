export interface SidebarItem {
  label: string;
  isPlaceholder: boolean;
}

// Everything except Recipes is a stub for now — clicking it shows a
// "coming soon" page. Add real sections here as they get built out.
export const sidebarItems: SidebarItem[] = [
  { label: "Home", isPlaceholder: false },
  { label: "Goals", isPlaceholder: true },
  { label: "Projects", isPlaceholder: true },
  { label: "Progress Webs", isPlaceholder: true },
  { label: "Recipes", isPlaceholder: false },
  { label: "Responsibilities", isPlaceholder: true },
  { label: "Inventory", isPlaceholder: true },
  { label: "Notes", isPlaceholder: true },
];
