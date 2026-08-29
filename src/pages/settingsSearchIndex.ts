import { View } from "../types/nav";
import { ICON_REGISTRY } from "../icons/registry";
import { TEXT_ELEMENT_REGISTRY } from "../icons/textRegistry";
import { BUTTON_STYLE_REGISTRY } from "../icons/buttonRegistry";
import { HEADER_STYLE_REGISTRY } from "../icons/headerRegistry";
import { THEME_COLOR_GROUPS } from "../theme/themeFieldGroups";

export interface SettingsSearchItem {
  section: string;
  label: string;
  key: string;
  view: View;
}

// Flat, searchable index over every individually-customizable setting
// across Icons / Text Elements / Buttons / Theme, built from the same
// registries each settings page renders from — so this can't drift out
// of sync with what's actually on each page.
export function buildSettingsSearchIndex(): SettingsSearchItem[] {
  const items: SettingsSearchItem[] = [];

  for (const def of ICON_REGISTRY) {
    items.push({
      section: "Icons",
      label: def.label,
      key: def.key,
      view: { type: "settings-icons", focusKey: def.key },
    });
  }

  for (const def of TEXT_ELEMENT_REGISTRY) {
    items.push({
      section: "Text Elements",
      label: def.label,
      key: def.key,
      view: { type: "settings-text", focusKey: def.key },
    });
  }

  for (const def of BUTTON_STYLE_REGISTRY) {
    items.push({
      section: "Buttons",
      label: def.label,
      key: def.key,
      view: { type: "settings-buttons", focusKey: def.key },
    });
  }

  for (const def of HEADER_STYLE_REGISTRY) {
    items.push({
      section: "Headers",
      label: def.label,
      key: def.key,
      view: { type: "settings-headers", focusKey: def.key },
    });
  }

  const EDITOR_SETTINGS_FIELDS = [
    { key: "editor-toolbar", label: "Fixed toolbar" },
    { key: "editor-context-menu", label: "Right-click / long-press menu" },
    { key: "editor-bubble-menu", label: "Selection toolbar" },
    { key: "editor-slash-command", label: "Slash commands" },
    { key: "editor-input-mode", label: "Input mode" },
  ];
  for (const field of EDITOR_SETTINGS_FIELDS) {
    items.push({
      section: "Editor Tools",
      label: field.label,
      key: field.key,
      view: { type: "settings-editor", focusKey: field.key },
    });
  }

  for (const group of THEME_COLOR_GROUPS) {
    for (const field of group.fields) {
      items.push({
        section: `Theme — ${group.title}`,
        label: field.label,
        key: field.key,
        view: { type: "settings-theme", focusKey: field.key },
      });
    }
  }

  return items;
}

// Lazily-built lookup Map from item key -> SettingsSearchItem, shared by
// the overlay panel (leaf lookup) and the live-element reverse-jump
// feature (data-overlay-target="{key}" -> settings item) — one flat map
// so the two directions can't drift apart.
let settingsItemByKeyCache: Map<string, SettingsSearchItem> | null = null;

export function findSettingsItemByKey(key: string): SettingsSearchItem | undefined {
  if (!settingsItemByKeyCache) {
    settingsItemByKeyCache = new Map(buildSettingsSearchIndex().map((item) => [item.key, item]));
  }
  return settingsItemByKeyCache.get(key);
}

// Same flat items as buildSettingsSearchIndex(), regrouped by
// page/location instead of by settings-category. Used by
// SettingsDynamicSearchPage (grouped tree view) and DynamicOverlayPanel
// (scoped-to-current-page view) — both built on this single source of
// truth so the two views can't drift apart.
export interface SettingsLocationGroup {
  page: string; // top-level group: a distinct screen in the app
  location: string; // sub-group within that screen (section/registry)
  items: SettingsSearchItem[];
}

export function buildSettingsByLocation(): SettingsLocationGroup[] {
  const flat = buildSettingsSearchIndex();
  const byPage = new Map<string, Map<string, SettingsSearchItem[]>>();

  const pageFor = (item: SettingsSearchItem): { page: string; location: string } => {
    if (item.section === "Icons") return { page: "Settings — Icons", location: "Icons" };
    if (item.section === "Text Elements") return { page: "Settings — Text Elements", location: "Text Elements" };
    if (item.section === "Buttons") return { page: "Settings — Buttons", location: "Buttons" };
    if (item.section === "Headers") return { page: "Settings — Headers", location: "Headers" };
    if (item.section === "Editor Tools") return { page: "Settings — Editor Tools", location: "Editor Tools" };
    if (item.section.startsWith("Theme")) {
      const location = item.section.includes("—") ? item.section.split("—")[1].trim() : "Theme";
      return { page: "Settings — Theme", location };
    }
    return { page: item.section, location: item.section };
  };

  for (const item of flat) {
    const { page, location } = pageFor(item);
    if (!byPage.has(page)) byPage.set(page, new Map());
    const locMap = byPage.get(page)!;
    if (!locMap.has(location)) locMap.set(location, []);
    locMap.get(location)!.push(item);
  }

  const groups: SettingsLocationGroup[] = [];
  for (const [page, locMap] of byPage) {
    for (const [location, items] of locMap) {
      groups.push({ page, location, items });
    }
  }
  return groups;
}
