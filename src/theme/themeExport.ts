// Shared shape for every theme import/export path — file export/import
// (SettingsHomePage), the in-app preset library, and the AI designer
// bundle (ExportToAiModal). Kept in its own module (rather than
// declared inline in SettingsHomePage.tsx, where it originally lived)
// so ExportToAiModal can share the exact same type without a
// component-to-component import.
import { TextElementOverride } from "../db/textElements";
import { ButtonStyleOverride } from "../db/buttonStyles";
import { PageSurfaceOverride } from "../db/pageBackgrounds";
import { ThemeSettings } from "./themeDefaults";
import { CustomSliderDef } from "./customSliders";

export interface ThemeExport {
  icons: Record<string, string>;
  textElements: Record<string, TextElementOverride>;
  buttonStyles: Record<string, ButtonStyleOverride>;
  themeSettings: Partial<ThemeSettings>;
  // Optional — most themes won't define any. See customSliders.ts and
  // AI_DESIGNER_INSTRUCTIONS.md (built by aiDesignerInstructions.ts) for
  // the full contract an AI designer follows to add adjustable sliders
  // (e.g. a grain-overlay opacity knob) to a theme it hands back.
  customSliders?: CustomSliderDef[];
  // Optional — per-section "Color Mode" page backgrounds (see
  // PageBackgroundContext.tsx / db/pageBackgrounds.ts), keyed by the
  // "section:*" scope keys from theme/pageScope.ts. Only ever the
  // portable section-level keys, never an entity-specific one like
  // "project:5" — those are this install's own data, not theme content.
  pageBackgrounds?: Record<string, Record<string, PageSurfaceOverride>>;
}
