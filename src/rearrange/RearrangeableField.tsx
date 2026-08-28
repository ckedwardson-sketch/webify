import { ReactNode, useState } from "react";
import { useRearrangeMode } from "./RearrangeModeContext";
import { AddFieldMenu } from "./AddFieldMenu";
import "./RearrangeableField.css";

// Wraps one vertical "area" of a Project/Goal Detail page (a text field,
// a date field, the whole widget grid, a freetext box...) with the same
// drag-to-reorder / tool-click-to-copy-or-delete interaction the widget
// grid already had — generalized to every field on the page, not just
// widgets. `removable`/`copiable` gate whether the delete/copy tools do
// anything here — most built-in fields are permanent (see
// db/fieldLayout.ts's REMOVABLE_FIELD_TYPES).
//
// Only the small ⠿ handle is the actual native drag source — NOT this
// whole wrapper — deliberately: this wrapper can contain another
// draggable region (the widget grid, itself full of individually
// draggable widget cards), and a draggable ancestor around a draggable
// descendant is a well-known way to make HTML5 drag-and-drop misbehave
// or stop firing altogether in Chromium/WebView2. Dragging from inside
// a text field's own textarea/input would also fight the browser's
// native text-selection drag if the whole card were the drag source.
// setDragImage below makes the drag still *look* like you're carrying
// the whole card, even though only the handle initiates it.
export function RearrangeableField({
  id,
  rearranging,
  deleteToolActive,
  copyToolActive,
  removable,
  copiable,
  copied,
  dragOverId,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDelete,
  onCopy,
  children,
}: {
  id: number;
  rearranging: boolean;
  deleteToolActive: boolean;
  copyToolActive: boolean;
  removable: boolean;
  copiable: boolean;
  copied: boolean;
  dragOverId: number | null;
  onDragStart: (e: React.DragEvent, id: number) => void;
  onDragOver: (e: React.DragEvent, id: number) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent, id: number) => void;
  onDelete?: () => void;
  onCopy?: () => void;
  children: ReactNode;
}) {
  const deleteArmed = rearranging && deleteToolActive && removable;
  const copyArmed = rearranging && copyToolActive && copiable;

  return (
    <div
      className={`field-slot${rearranging ? " field-slot-rearranging" : ""}${
        dragOverId === id ? " field-slot-drop-target" : ""
      }${deleteArmed ? " field-slot-delete-armed" : ""}${copyArmed ? " field-slot-copy-armed" : ""}${
        copied ? " field-slot-copied" : ""
      }`}
      onDragOver={(e) => onDragOver(e, id)}
      onDragLeave={onDragLeave}
      onDrop={(e) => onDrop(e, id)}
      onClickCapture={(e) => {
        if (!rearranging) return;
        if (deleteToolActive && removable && onDelete) {
          e.preventDefault();
          e.stopPropagation();
          onDelete();
        } else if (copyToolActive && copiable && onCopy) {
          e.preventDefault();
          e.stopPropagation();
          onCopy();
        }
      }}
    >
      {rearranging && (
        <span
          className="field-slot-drag-handle"
          draggable
          title="Drag to reorder"
          onDragStart={(e) => {
            const card = (e.currentTarget as HTMLElement).parentElement;
            if (card) {
              const rect = card.getBoundingClientRect();
              e.dataTransfer.setDragImage(card, e.clientX - rect.left, e.clientY - rect.top);
            }
            onDragStart(e, id);
          }}
        >
          ⠿
        </span>
      )}
      {children}
    </div>
  );
}

// A blue insertion zone between two fields, visible for the whole time
// rearrange mode is active (not just while the toolbar's add-menu is
// open) — hovering it grows a "+" affordance, and clicking opens a
// small categorized picker anchored right there instead of routing
// through the toolbar. See "THE BIG ONES" #2's "areas between field
// will glow... to indicate where the thing will go," and the later
// "crisp new field button and hover feature" follow-up. `order` is this
// gap's field_layout sort_order value — passed straight to
// target.onAddField/onAddWidget's insertion point (see
// RearrangeModeContext.tsx's insertAt).
export function FieldGap({ order }: { order: number }) {
  const { target, setInsertAt, pasteToolActive, clipboard, clearClipboard } = useRearrangeMode();
  const [open, setOpen] = useState(false);

  if (!target) return null;

  const toggle = () => {
    if (pasteToolActive && clipboard) {
      // Passed explicitly rather than via insertAt/context — those only
      // reach the registered target's closure on the *next* render, and
      // this paste happens in the same click, with no render in between
      // (unlike the add-menu path, where opening the menu and then
      // clicking an item are two separate interactions).
      target.onPasteField(clipboard, order).then(clearClipboard);
      return;
    }
    setInsertAt(order);
    setOpen((v) => !v);
  };

  const close = () => {
    setOpen(false);
    setInsertAt(null);
  };

  return (
    <div className="field-gap-wrapper">
      <button
        type="button"
        className={`field-gap${open ? " field-gap-active" : ""}${pasteToolActive && clipboard ? " field-gap-paste-armed" : ""}`}
        onClick={toggle}
        title={pasteToolActive && clipboard ? "Paste here" : "Add a new area here"}
      >
        <span className="field-gap-plus">{pasteToolActive && clipboard ? "📌" : "+"}</span>
      </button>
      {open && (
        <>
          <div className="menu-backdrop" onClick={close} />
          <div className="rearrange-add-menu field-gap-menu">
            <AddFieldMenu
              target={target}
              onPickWidget={async (type) => {
                await target.onAddWidget(type);
                close();
              }}
              onPickField={async (type) => {
                await target.onAddField(type);
                close();
              }}
            />
          </div>
        </>
      )}
    </div>
  );
}
