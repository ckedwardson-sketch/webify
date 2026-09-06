// src/editor/toolbar/EditorToolbar.tsx
import React from "react";
import type { Editor } from "@tiptap/core";
import { EDITOR_COMMAND_REGISTRY } from "../commands/registry";
import { TextElement } from "../../icons/TextElement";
import { Icon } from "../../icons/Icon";
import "./EditorToolbar.css";

// A toolbar slot is either a registry command key (rendered as a plain
// toggle button) or an arbitrary React node (bespoke popovers like
// ListPopover that don't fit the "single command" shape). Link/Image
// live in the editor's right-click menu instead (see LinkPanel and
// NoteContentEditor/RecipeEditor's insertSections) since they need a
// popover UI unlike this toolbar's plain toggle buttons. Grouping into
// `groups` reproduces the visually separated clusters both Recipe and
// Notes want.
export type ToolbarSlot = string | React.ReactNode;

export function CommandButton({ editor, commandKey }: { editor: Editor; commandKey: string }) {
  const def = EDITOR_COMMAND_REGISTRY[commandKey];
  if (!def) return null;
  const active = def.isActive?.(editor) ?? false;
  return (
    <button className={active ? "active" : ""} onClick={() => def.run(editor)} title={def.label}>
      {def.textElementKey ? (
        <TextElement elementKey={def.textElementKey} />
      ) : (
        <Icon iconKey={def.iconKey ?? ""} size={15} />
      )}
    </button>
  );
}

export function EditorToolbar({
  editor,
  groups,
  orientation = "vertical",
}: {
  editor: Editor;
  groups: ToolbarSlot[][];
  orientation?: "vertical" | "horizontal";
}) {
  return (
    <div
      className={`recipe-editor-toolbar${orientation === "horizontal" ? " toolbar-horizontal" : ""}`}
      data-overlay-target="editor-toolbar"
    >
      {groups.map((slots, gi) => (
        <div className="toolbar-group" key={gi}>
          {slots.map((slot, si) =>
            typeof slot === "string" ? (
              <CommandButton key={slot} editor={editor} commandKey={slot} />
            ) : (
              <React.Fragment key={si}>{slot}</React.Fragment>
            )
          )}
        </div>
      ))}
    </div>
  );
}
