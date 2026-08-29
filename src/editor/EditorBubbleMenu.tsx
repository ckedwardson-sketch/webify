import { BubbleMenu } from "@tiptap/react";
import type { Editor } from "@tiptap/core";
import { CommandButton } from "./toolbar/EditorToolbar";
import { MARK_COMMAND_KEYS } from "./commands/registry";
import "./EditorBubbleMenu.css";

// Selection-triggered floating toolbar — BubbleMenu's own default
// shouldShow already only appears on a non-empty text selection, so no
// custom show/hide logic is needed here.
export function EditorBubbleMenu({ editor }: { editor: Editor }) {
  return (
    <BubbleMenu editor={editor} className="editor-bubble-menu" data-overlay-target="editor-bubble-menu">
      {MARK_COMMAND_KEYS.map((key) => (
        <CommandButton key={key} editor={editor} commandKey={key} />
      ))}
    </BubbleMenu>
  );
}
