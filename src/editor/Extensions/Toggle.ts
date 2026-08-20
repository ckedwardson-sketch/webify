// src/editor/extensions/Toggle.ts
import { Node, mergeAttributes } from "@tiptap/core";
import type { Editor } from "@tiptap/core";

// A toggle is <details><summary>...</summary><div>...content...</div></details>.
// Splitting it into three nodes (wrapper / summary / content) lets each
// part have the right editing rules — the summary is a single line,
// the content can hold any normal blocks, including nested toggles.

export const Toggle = Node.create({
  name: "toggle",
  group: "block",
  content: "toggleSummary toggleContent",
  defining: true,
  isolating: true,

  parseHTML() {
    return [{ tag: "details" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["details", mergeAttributes(HTMLAttributes), 0];
  },
});

export const ToggleSummary = Node.create({
  name: "toggleSummary",
  content: "inline*",
  defining: true,

  parseHTML() {
    return [{ tag: "summary" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["summary", mergeAttributes(HTMLAttributes), 0];
  },
});

export const ToggleContent = Node.create({
  name: "toggleContent",
  content: "block+",
  defining: true,

  parseHTML() {
    return [{ tag: "div[data-toggle-content]" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-toggle-content": "" }), 0];
  },
});

export const toggleExtensions = [Toggle, ToggleSummary, ToggleContent];

export function insertToggle(editor: Editor) {
  editor
    .chain()
    .focus()
    .insertContent({
      type: "toggle",
      content: [
        { type: "toggleSummary", content: [{ type: "text", text: "Toggle" }] },
        { type: "toggleContent", content: [{ type: "paragraph" }] },
      ],
    })
    .run();
}
