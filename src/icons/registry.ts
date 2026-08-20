export interface IconDef {
  key: string;
  label: string;
  defaultGlyph: string;
}

export const ICON_REGISTRY: IconDef[] = [
  { key: "web-view", label: "Open Web View button", defaultGlyph: "🕸️" },
  { key: "frozen", label: "Frozen status indicator", defaultGlyph: "❄️" },
  { key: "homegrown", label: "Homegrown status indicator", defaultGlyph: "🌱" },
  { key: "iteration", label: "Create / view iterations button", defaultGlyph: "🌱" },
  { key: "link", label: "Editor: link tool", defaultGlyph: "🔗" },
  { key: "image", label: "Editor: image tool", defaultGlyph: "🖼" },
  { key: "divider", label: "Editor: divider tool", defaultGlyph: "—" },
  { key: "list", label: "Editor: list tool", defaultGlyph: "☰" },
  { key: "filter", label: "Web: filter button", defaultGlyph: "🔽" },
  { key: "back", label: "Web: zoom out / back button", defaultGlyph: "🔍" },
  { key: "rename", label: "List row: rename button", defaultGlyph: "✏️" },
  { key: "delete", label: "List row: delete button", defaultGlyph: "🗑️" },
  { key: "add-image", label: "List row: add image button", defaultGlyph: "📷" },
];
