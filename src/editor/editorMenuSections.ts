// Builds the shared "Turn into / Format" section list from the command
// registry, consumed by both the right-click context menu and the slash
// command menu. Link/Image stay toolbar-only — they need their own
// popover UI (search box, tabs) rather than a single run() call.
import type { Editor } from "@tiptap/core";
import { EDITOR_COMMAND_REGISTRY, MARK_COMMAND_KEYS, SLASH_COMMAND_KEYS } from "./commands/registry";
import type { ContextMenuSection } from "../components/ContextMenu";

export function buildEditorContextMenuSections(editor: Editor, onDone: () => void): ContextMenuSection[] {
  return [
    {
      label: "Turn into",
      items: SLASH_COMMAND_KEYS.map((key) => {
        const def = EDITOR_COMMAND_REGISTRY[key];
        return {
          key,
          label: def.label,
          onSelect: () => {
            def.run(editor);
            onDone();
          },
        };
      }),
    },
    {
      label: "Format",
      items: MARK_COMMAND_KEYS.map((key) => {
        const def = EDITOR_COMMAND_REGISTRY[key];
        return {
          key,
          label: def.label,
          onSelect: () => {
            def.run(editor);
            onDone();
          },
        };
      }),
    },
  ];
}
