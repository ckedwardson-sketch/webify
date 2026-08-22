import { View } from "../types/nav";
import { ICON_REGISTRY } from "../icons/registry";
import { TEXT_ELEMENT_REGISTRY } from "../icons/textRegistry";
import { BUTTON_STYLE_REGISTRY } from "../icons/buttonRegistry";
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
