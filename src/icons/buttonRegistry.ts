export interface ButtonStyleDef {
  key: string;
  label: string;
  defaultText: string;
  defaultFontFamily: string;
  defaultFontSize: number; // px
  defaultTextColor: string;
  defaultBackgroundColor: string;
  defaultBorderColor: string;
  defaultPaddingX: number; // px
  defaultPaddingY: number; // px
  defaultBorderRadius: number; // px
}

export const BUTTON_STYLE_REGISTRY: ButtonStyleDef[] = [
  {
    key: "web-filter-toggle",
    label: "Web: Filter button",
    defaultText: "Filter",
    defaultFontFamily: "inherit",
    defaultFontSize: 14,
    defaultTextColor: "#ffffff",
    defaultBackgroundColor: "#3b82f6",
    defaultBorderColor: "#3b82f6",
    defaultPaddingX: 14,
    defaultPaddingY: 8,
    defaultBorderRadius: 6,
  },
  {
    key: "web-zoom-back",
    label: "Web: Zoom Out / Back button",
    defaultText: "Zoom Out / Back",
    defaultFontFamily: "inherit",
    defaultFontSize: 14,
    defaultTextColor: "#ffffff",
    defaultBackgroundColor: "#0f172a",
    defaultBorderColor: "#475569",
    defaultPaddingX: 12,
    defaultPaddingY: 6,
    defaultBorderRadius: 6,
  },
];
