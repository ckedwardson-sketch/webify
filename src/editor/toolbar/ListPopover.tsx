// src/editor/toolbar/ListPopover.tsx
import { useState } from "react";
import type { Editor } from "@tiptap/core";
import { Icon } from "../../icons/Icon";
import { EDITOR_COMMAND_REGISTRY } from "../commands/registry";

// The "Lists" toolbar button: opens a popover of block-turn-into
// options. `extraItems` lets a consumer (Notes) append its own entries
// (Callout) without forking this component.
export function ListPopover({
  editor,
  commandKeys,
  extraItems,
}: {
  editor: Editor;
  commandKeys: string[];
  extraItems?: { label: string; onSelect: () => void }[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="toolbar-popover-wrapper">
      <button onClick={() => setOpen((v) => !v)} title="Lists">
        <Icon iconKey="list" size={15} />
      </button>
      {open && (
        <>
          <div className="toolbar-backdrop" onClick={() => setOpen(false)} />
          <div className="toolbar-popover">
            {commandKeys.map((key) => {
              const def = EDITOR_COMMAND_REGISTRY[key];
              if (!def) return null;
              return (
                <button
                  key={key}
                  onClick={() => {
                    def.run(editor);
                    setOpen(false);
                  }}
                >
                  {def.label}
                </button>
              );
            })}
            {extraItems?.map((item) => (
              <button
                key={item.label}
                onClick={() => {
                  item.onSelect();
                  setOpen(false);
                }}
              >
                {item.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
