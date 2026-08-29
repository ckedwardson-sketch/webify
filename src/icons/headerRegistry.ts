import { sidebarItems } from "../data/appData";

export interface HeaderStyleDef {
  key: string;
  label: string;
  defaultText: string;
  defaultSize: number; // px
  defaultColor: string;
  defaultBold: boolean;
  defaultUnderline: boolean;
}

// Shared by the registry below and Sidebar.tsx, so a nav item's
// registry key and the key it renders with can't drift apart.
export function sidebarNavHeaderKey(label: string): string {
  return `sidebar-nav-${label.toLowerCase().replace(/\s+/g, "-")}`;
}

// One entry per named "header" in the sidebar's chrome — like
// TEXT_ELEMENT_REGISTRY (icons/textRegistry.ts), overrides both the text
// content and its style (font size/color/bold/underline), just not
// limited to short glyphs. Built from data/appData.ts's sidebarItems so
// a new nav entry there automatically gets its own styleable/renameable
// header. `defaultText` is the label actually rendered until overridden
// — see StyledHeader.tsx's `children` fallback.
export const HEADER_STYLE_REGISTRY: HeaderStyleDef[] = [
  { key: "sidebar-title", label: "Sidebar: app title", defaultText: "My System", defaultSize: 15, defaultColor: "#e2e8f0", defaultBold: true, defaultUnderline: false },
  ...sidebarItems.map((item) => ({
    key: sidebarNavHeaderKey(item.label),
    label: `Sidebar: ${item.label}`,
    defaultText: item.label,
    defaultSize: 14,
    defaultColor: "#cbd5e1",
    defaultBold: false,
    defaultUnderline: false,
  })),
  { key: "sidebar-rearrange", label: "Sidebar: Rearrange trigger", defaultText: "Rearrange", defaultSize: 14, defaultColor: "#cbd5e1", defaultBold: false, defaultUnderline: false },
];
