// src/editor/extensions/SlashCommand.ts
import { Extension } from "@tiptap/core";
import Suggestion from "@tiptap/suggestion";
import { ReactRenderer } from "@tiptap/react";
import tippy, { Instance as TippyInstance } from "tippy.js";
import { SlashMenu, SlashMenuRef, SlashItem } from "../SlashMenu";
import { EDITOR_COMMAND_REGISTRY, SLASH_COMMAND_KEYS } from "../commands/registry";

function getItems(query: string): SlashItem[] {
  return SLASH_COMMAND_KEYS.map((key) => EDITOR_COMMAND_REGISTRY[key])
    .filter((def) => def.label.toLowerCase().includes(query.toLowerCase()))
    .map((def) => ({ key: def.key, label: def.label }));
}

export const SlashCommand = Extension.create({
  name: "slashCommand",

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        char: "/",
        startOfLine: false,
        items: ({ query }: { query: string }) => getItems(query),
        command: ({ editor, range, props }: { editor: any; range: any; props: SlashItem }) => {
          editor.chain().focus().deleteRange(range).run();
          EDITOR_COMMAND_REGISTRY[props.key]?.run(editor);
        },
        render: () => {
          let component: ReactRenderer<SlashMenuRef>;
          let popup: TippyInstance[];

          return {
            onStart: (props: any) => {
              component = new ReactRenderer(SlashMenu, {
                props: { items: props.items, command: props.command },
                editor: props.editor,
              });
              if (!props.clientRect) return;
              popup = tippy("body", {
                getReferenceClientRect: props.clientRect,
                appendTo: () => document.body,
                content: component.element,
                showOnCreate: true,
                interactive: true,
                trigger: "manual",
                placement: "bottom-start",
              });
            },
            onUpdate(props: any) {
              component.updateProps({ items: props.items, command: props.command });
              if (!props.clientRect) return;
              popup[0].setProps({ getReferenceClientRect: props.clientRect });
            },
            onKeyDown(props: any) {
              if (props.event.key === "Escape") {
                popup[0].hide();
                return true;
              }
              return component.ref?.onKeyDown(props) ?? false;
            },
            onExit() {
              popup[0].destroy();
              component.destroy();
            },
          };
        },
      }),
    ];
  },
});
