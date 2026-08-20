export type ThemeMode = "light" | "dark";

export interface ThemeSettings {
  mode: ThemeMode;
  webBackground: string;
  webNodeProvenBackground: string;
  webNodeUnprovenBackground: string;
  webNodeOutlineColor: string;
}

export const THEME_SETTING_KEYS: (keyof ThemeSettings)[] = [
  "mode",
  "webBackground",
  "webNodeProvenBackground",
  "webNodeUnprovenBackground",
  "webNodeOutlineColor",
];

export const DEFAULT_THEME: ThemeSettings = {
  mode: "light",
  webBackground: "#1e293b",
  webNodeProvenBackground: "#15803d",
  webNodeUnprovenBackground: "#4b5563",
  webNodeOutlineColor: "#94a3b8",
};
