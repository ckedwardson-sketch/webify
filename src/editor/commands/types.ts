// src/editor/commands/types.ts
import type { Editor } from "@tiptap/core";

// One entry per formatting action available anywhere in the app's rich
// text editors. Every access surface — the fixed toolbar, the right-click
// context menu, the selection bubble menu, the slash command menu — reads
// from the same registry (see registry.ts) so there's exactly one place
// that knows what "bold" or "turn into heading" actually does.
export interface EditorCommandDef {
  key: string;
  label: string;
  // Icon shown in the fixed toolbar (themeable text-glyph icon system).
  textElementKey?: string;
  // Icon shown in menus (context menu / slash menu) — the plain themeable
  // icon system, since those render label + icon side by side.
  iconKey?: string;
  run: (editor: Editor) => void;
  isActive?: (editor: Editor) => boolean;
  // Restricts where a command is offered: "mark" commands (bold, italic,
  // highlight...) make sense in the bubble menu; "block" commands (turn
  // into heading/list/callout...) make sense in the slash menu. Both are
  // always offered in the toolbar and context menu.
  kind: "mark" | "block";
}
