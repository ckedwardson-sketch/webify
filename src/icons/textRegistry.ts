export interface TextElementDef {
  key: string;
  label: string;
  defaultText: string;
  defaultSize: number; // px
  defaultColor: string;
}

export const TEXT_ELEMENT_REGISTRY: TextElementDef[] = [
  { key: "bold-button", label: "Editor: Bold button", defaultText: "B", defaultSize: 14, defaultColor: "#444444" },
  { key: "italic-button", label: "Editor: Italic button", defaultText: "I", defaultSize: 14, defaultColor: "#444444" },
  { key: "underline-button", label: "Editor: Underline button", defaultText: "U", defaultSize: 14, defaultColor: "#444444" },
  { key: "strike-button", label: "Editor: Strikethrough button", defaultText: "S", defaultSize: 14, defaultColor: "#444444" },
  { key: "code-button", label: "Editor: Inline code button", defaultText: "</>", defaultSize: 11, defaultColor: "#444444" },
  { key: "heading1-button", label: "Editor: Heading 1 button", defaultText: "H¹", defaultSize: 13, defaultColor: "#444444" },
  { key: "heading2-button", label: "Editor: Heading 2 button", defaultText: "H²", defaultSize: 13, defaultColor: "#444444" },
  { key: "heading3-button", label: "Editor: Heading 3 button", defaultText: "H³", defaultSize: 13, defaultColor: "#444444" },
  { key: "quote-button", label: "Editor: Quote button", defaultText: "\"", defaultSize: 16, defaultColor: "#444444" },
  { key: "add-button", label: "Header + (add) button", defaultText: "+", defaultSize: 18, defaultColor: "#333333" },
  { key: "drag-handle", label: "List row: drag handle", defaultText: "⋮⋮", defaultSize: 16, defaultColor: "#64748b" },
];
