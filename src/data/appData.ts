export interface SidebarItem {
  label: string;
  isPlaceholder: boolean;
}

// Goals, Progress Webs, Inventory, and Notes are still stubs for now —
// clicking them shows a "coming soon" page.
export const sidebarItems: SidebarItem[] = [
  { label: "Home", isPlaceholder: false },
  { label: "Dreams", isPlaceholder: false },
  { label: "Goals", isPlaceholder: true },
  { label: "Projects", isPlaceholder: false },
  { label: "Progress Webs", isPlaceholder: true },
  { label: "Recipes", isPlaceholder: false },
  { label: "Responsibilities", isPlaceholder: false },
  { label: "Inventory", isPlaceholder: true },
  { label: "Notes", isPlaceholder: true },
  { label: "Settings", isPlaceholder: false },
];
