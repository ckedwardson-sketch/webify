import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import "./SlashMenu.css";

export interface SlashItem {
  key: string;
  label: string;
}

export interface SlashMenuProps {
  items: SlashItem[];
  command: (item: SlashItem) => void;
}

export interface SlashMenuRef {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean;
}

// Floating filtered list mounted by extensions/SlashCommand.ts via
// ReactRenderer/tippy — keyboard nav is driven externally through the
// imperative onKeyDown handle since Suggestion intercepts keydown
// itself before it reaches this component's DOM.
export const SlashMenu = forwardRef<SlashMenuRef, SlashMenuProps>(({ items, command }, ref) => {
  const [selected, setSelected] = useState(0);

  useEffect(() => setSelected(0), [items]);

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }) => {
      if (items.length === 0) return false;
      if (event.key === "ArrowDown") {
        setSelected((i) => (i + 1) % items.length);
        return true;
      }
      if (event.key === "ArrowUp") {
        setSelected((i) => (i - 1 + items.length) % items.length);
        return true;
      }
      if (event.key === "Enter") {
        const item = items[selected];
        if (item) command(item);
        return true;
      }
      return false;
    },
  }));

  if (items.length === 0) {
    return (
      <div className="slash-menu">
        <div className="slash-menu-empty">No matches</div>
      </div>
    );
  }

  return (
    <div className="slash-menu" data-overlay-target="editor-slash-command">
      {items.map((item, i) => (
        <button
          key={item.key}
          className={`slash-menu-item${i === selected ? " active" : ""}`}
          onMouseEnter={() => setSelected(i)}
          onClick={() => command(item)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
});
SlashMenu.displayName = "SlashMenu";
