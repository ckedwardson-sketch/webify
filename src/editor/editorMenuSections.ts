// Builds the shared "Turn into / Format" section list from the command
// registry, consumed by both the right-click context menu and the slash
// command menu. Link/Image aren't here — they need their own popover UI
// (search box, tabs) rather than a single run() call, so NoteContentEditor
// and RecipeEditor append their own "Insert" section alongside this one.
import type { Editor } from "@tiptap/core";
import { EDITOR_COMMAND_REGISTRY, MARK_COMMAND_KEYS, SLASH_COMMAND_KEYS } from "./commands/registry";
import type { ContextMenuSection } from "../components/ContextMenu";
import { findMisspelledWordAt } from "./extensions/SpellCheck";
import { getSpellChecker } from "./spellcheck/dictionary";

const MAX_SUGGESTIONS = 5;

// Right-click landed on a word the dictionary flags — prepend a
// "Spelling" section with the top suggestions ahead of the regular
// Turn into/Format sections. Returns [] when the click wasn't on a
// flagged word, so callers can splice it in unconditionally.
export function buildSpellingSection(editor: Editor, clientPos: { x: number; y: number }, onDone: () => void): ContextMenuSection[] {
  const coords = editor.view.posAtCoords({ left: clientPos.x, top: clientPos.y });
  if (!coords) return [];
  const hit = findMisspelledWordAt(editor, coords.pos);
  if (!hit) return [];

  const suggestions = getSpellChecker().suggest(hit.word, MAX_SUGGESTIONS);
  const items = suggestions.length
    ? suggestions.map((suggestion, i) => ({
        key: `spelling-${i}`,
        label: suggestion,
        onSelect: () => {
          editor.chain().focus().insertContentAt({ from: hit.from, to: hit.to }, suggestion).run();
          onDone();
        },
      }))
    : [{ key: "spelling-none", label: "No suggestions", onSelect: () => {}, disabled: true }];

  return [{ label: "Spelling", items }];
}

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
