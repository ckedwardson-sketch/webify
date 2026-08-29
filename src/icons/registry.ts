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
  { key: "code-block", label: "Editor: code block tool", defaultGlyph: "{ }" },
  { key: "callout", label: "Editor: callout tool", defaultGlyph: "💡" },
  { key: "highlight", label: "Editor: highlight tool", defaultGlyph: "🖍" },
  { key: "text-color", label: "Editor: text color tool", defaultGlyph: "A" },
  { key: "menu-more", label: "⋯ actions menu button", defaultGlyph: "⋯" },
  { key: "widget-journal", label: "Widget icon: Journal", defaultGlyph: "📓" },
  { key: "widget-linkboard", label: "Widget icon: Board", defaultGlyph: "🧷" },
  { key: "widget-table", label: "Widget icon: Table", defaultGlyph: "📊" },
  { key: "widget-photo", label: "Widget icon: Quick Photo", defaultGlyph: "📷" },
  { key: "widget-dock", label: "Widget icon: Image Dock", defaultGlyph: "🖼" },
];
