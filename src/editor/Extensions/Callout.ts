// src/editor/extensions/Callout.ts
import { Node, mergeAttributes } from "@tiptap/core";
import type { Editor } from "@tiptap/core";

// A callout is a highlighted box of arbitrary block content — restores
// the old fake-block "callout" type as a real, nestable Tiptap node.
// Fixed default icon for v1 (no icon picker, unlike Notion's) to keep
// this proportionate; modeled directly on Toggle.ts's node shape.
export const Callout = Node.create({
  name: "callout",
  group: "block",
  content: "block+",
  defining: true,

  parseHTML() {
    return [{ tag: "div[data-callout]" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-callout": "" }), 0];
  },
});

export const calloutExtensions = [Callout];

export function insertCallout(editor: Editor) {
  editor
    .chain()
    .focus()
    .insertContent({
      type: "callout",
      content: [{ type: "paragraph" }],
    })
    .run();
}
