import { ReactNode, useState } from "react";
import { useRearrangeMode } from "./RearrangeModeContext";
import { AddFieldMenu } from "./AddFieldMenu";
import { FieldHeader } from "../components/FieldHeader";
import { FieldLayoutRow, FieldType, PairMode } from "../db/fieldLayout";
import { useDynamicOverlay } from "../overlay/DynamicOverlayContext";
import "./RearrangeableField.css";

// One row in the field list — either a single full-width field, or a
// primary plus the one field paired to its right (see fieldRows.ts).
// This is the actual native drag source/target (not the individual
// FieldSlots inside it): dropping anywhere on either half of a paired
// row still targets the row as a whole, and only the primary's handle
// (inside its FieldSlot) can start a drag — see useFieldLayout.ts's
// handleDragStart/handleDrop, which both key off the primary's id.
export function FieldRow({
  primaryId,
  paired,
  pairMode,
  dragOverId,
  onDragOver,
  onDragLeave,
  onDrop,
  children,
}: {
  primaryId: number;
  paired: boolean;
  pairMode: PairMode | null;
  dragOverId: number | null;
  onDragOver: (e: React.DragEvent, id: number) => void;
  onDragLeave: (id: number) => void;
  onDrop: (e: React.DragEvent, id: number) => void;
  children: ReactNode;
}) {
  const modeClass = paired ? ` field-row-paired field-row-${pairMode ?? "compact"}` : "";
  return (
    <div
      className={`field-row${modeClass}${dragOverId === primaryId ? " field-row-drop-target" : ""}`}
      onDragOver={(e) => onDragOver(e, primaryId)}
      onDragLeave={() => onDragLeave(primaryId)}
      onDrop={(e) => onDrop(e, primaryId)}
    >
      {children}
    </div>
  );
}

// The chrome around one field's actual content: the rearrange dashed
// outline, delete/copy click-capture + hover glow, an optional drag
// handle (only the row's primary gets one), and an optional header.
// `header`: pass a ReactNode to use it as-is, `null` to render none (the
// field's own content already has a header — widgets/freetext/memory),
// or omit it to get the generic renameable FieldHeader built from
// defaultLabel/field.customLabel.
export function FieldSlot({
  field,
  defaultLabel,
  header,
  rearranging,
  deleteToolActive,
  copyToolActive,
  removable,
  copiable,
  copied,
  showDragHandle,
  onDragStart,
  onDelete,
  onCopy,
  onRename,
  trailing,
  children,
}: {
  field: FieldLayoutRow;
  defaultLabel: string;
  header?: ReactNode | null;
  rearranging: boolean;
  deleteToolActive: boolean;
  copyToolActive: boolean;
  removable: boolean;
  copiable: boolean;
  copied: boolean;
  showDragHandle: boolean;
  onDragStart: (e: React.DragEvent, id: number) => void;
  onDelete?: () => void;
  onCopy?: () => void;
  onRename: (label: string | null) => void;
  // Extra chrome anchored to this slot's right edge, e.g. FieldPairBar
  // (on the primary, when unpaired) or PairControls (on the secondary).
  trailing?: ReactNode;
  children: ReactNode;
}) {
  const deleteArmed = rearranging && deleteToolActive && removable;
  const copyArmed = rearranging && copyToolActive && copiable;
  const resolvedHeader = header === null ? null : (header ?? (
    <FieldHeader defaultLabel={defaultLabel} customLabel={field.customLabel} editable={rearranging} onRename={onRename} />
  ));

  return (
    <div
      className={`field-slot${rearranging ? " field-slot-rearranging" : ""}${deleteArmed ? " field-slot-delete-armed" : ""}${copyArmed ? " field-slot-copy-armed" : ""}${copied ? " field-slot-copied" : ""}`}
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
      {(rearranging && showDragHandle) || resolvedHeader ? (
        <div className="field-slot-header-row">
          {rearranging && showDragHandle && (
            <span
              className="field-slot-drag-handle"
              draggable
              title="Drag to reorder"
              onDragStart={(e) => onDragStart(e, field.id)}
            >
              ⠿
            </span>
          )}
          {resolvedHeader}
        </div>
      ) : null}
      {children}
      {rearranging && trailing}
    </div>
  );
}

// The right-edge blue bar (unpaired primary fields only, in rearrange
// mode) — hover to reveal, click to open a menu of what can go beside
// this field, with a compact/expand switch at the bottom that decides
// how the new pair renders (see RearrangeableField.css's
// .field-row-compact/.field-row-expand). Widgets are deliberately
// excluded from this menu (see AddFieldMenu.tsx's hideWidgetSection) —
// "add a widget to the grid" doesn't correspond to "pair a new field
// next to this one"; the widgets *grid itself* (if removed) can still
// be re-added here as a whole, same as any other field type.
export function FieldPairBar({ primaryId }: { primaryId: number }) {
  const { target } = useRearrangeMode();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<PairMode>("compact");

  if (!target) return null;

  const close = () => setOpen(false);

  return (
    <div className="field-pair-bar-wrapper">
      <button
        type="button"
        className={`field-pair-bar${open ? " field-pair-bar-active" : ""}`}
        onClick={() => setOpen((v) => !v)}
        title="Add a field to the right"
      >
        <span className="field-pair-bar-plus">+</span>
      </button>
      {open && (
        <>
          <div className="menu-backdrop" onClick={close} />
          <div className="rearrange-add-menu field-pair-menu">
            <AddFieldMenu
              target={target}
              hideWidgetSection
              onPickWidget={async () => {}}
              onPickField={async (type: FieldType) => {
                await target.onAddPairedField?.(primaryId, type, mode);
                close();
              }}
            />
            <div className="rearrange-add-menu-title">Layout</div>
            <div className="field-pair-mode-switch">
              <button
                type="button"
                className={mode === "compact" ? "active" : ""}
                onClick={() => setMode("compact")}
              >
                Compact
              </button>
              <button type="button" className={mode === "expand" ? "active" : ""} onClick={() => setMode("expand")}>
                Expand
              </button>
            </div>
            <p className="field-pair-mode-hint">
              {mode === "compact"
                ? "Both fields share this row's normal width."
                : "The row widens to fit both fields at full size (desktop only)."}
            </p>
          </div>
        </>
      )}
    </div>
  );
}

// Lives on the secondary field of an existing pair — switch compact/
// expand later, or split the pair back into two normal fields.
export function PairControls({
  mode,
  onSetMode,
  onUnpair,
}: {
  mode: PairMode;
  onSetMode: (mode: PairMode) => void;
  onUnpair: () => void;
}) {
  return (
    <div className="field-pair-controls">
      <button
        type="button"
        className={mode === "compact" ? "active" : ""}
        title="Compact"
        onClick={() => onSetMode("compact")}
      >
        ▥
      </button>
      <button type="button" className={mode === "expand" ? "active" : ""} title="Expand" onClick={() => onSetMode("expand")}>
        ⛶
      </button>
      <button type="button" title="Unpair" onClick={onUnpair}>
        ✕
      </button>
    </div>
  );
}

// A blue insertion zone between two rows, visible for the whole time
// rearrange mode is active — hovering it grows a "+" affordance, and
// clicking opens a small categorized picker anchored right there. When
// the clipboard has something in it (see RearrangeModeContext.tsx), the
// same popover leads with a "Paste" option — there's no separate paste
// *tool* to arm first, adding and pasting are just two options in one
// menu now. `order` is this gap's field_layout sort_order value.
export function FieldGap({ order }: { order: number }) {
  const { target, setInsertAt, clipboard, clearClipboard } = useRearrangeMode();
  const [open, setOpen] = useState(false);

  if (!target) return null;

  const toggle = () => {
    setInsertAt(order);
    setOpen((v) => !v);
  };

  const close = () => {
    setOpen(false);
    setInsertAt(null);
  };

  const paste = () => {
    if (!clipboard) return;
    target.onPasteField(clipboard, order).then(() => {
      clearClipboard();
      close();
    });
  };

  return (
    <div className="field-gap-wrapper">
      <button
        type="button"
        className={`field-gap${open ? " field-gap-active" : ""}${clipboard ? " field-gap-paste-armed" : ""}`}
        onClick={toggle}
        title={clipboard ? "Add a new area here, or paste" : "Add a new area here"}
      >
        <span className="field-gap-plus">+</span>
      </button>
      {open && (
        <>
          <div className="menu-backdrop" onClick={close} />
          <div className="rearrange-add-menu field-gap-menu">
            {clipboard && (
              <>
                <button className="dropdown-item field-gap-paste-item" onClick={paste}>
                  📌 Paste "{clipboard.label}"
                </button>
                <div className="rearrange-add-menu-divider" />
              </>
            )}
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
// The actual component every Detail page (Project/Goal/Dream) renders
// per field — flat, explicit props driven by the page's own local
// drag/delete/copy state, NOT global context (each page owns its own
// `fields` list and drag-over id, since only one page is ever mounted
// at a time). This is deliberately independent of FieldSlot above:
// FieldSlot is field-object-based groundwork for the not-yet-wired
// pairing feature (FieldPairBar/PairControls), while this is what's
// actually live today. Only the small ⠿ handle is the native drag
// source — NOT the whole wrapper — same reasoning as FieldSlot's.
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
  const { colorModeOpen, openFieldStyle } = useDynamicOverlay();

  return (
    <div
      className={`field-slot${rearranging ? " field-slot-rearranging" : ""}${
        dragOverId === id ? " field-slot-drop-target" : ""
      }${deleteArmed ? " field-slot-delete-armed" : ""}${copyArmed ? " field-slot-copy-armed" : ""}${
        copied ? " field-slot-copied" : ""
      }`}
      // Nearer than the page's own data-color-surface="page-bg" ancestor
      // (see PageBackgroundContext.tsx), so ctrl+hovering a field while
      // Color Mode is on edits the field background default, not the
      // whole page's background — see ColorModeHoverPopover.tsx. A
      // specific field's own background (set via ctrl+click's field
      // style panel) always wins visually since it's a more specific
      // inline style; this only decides what ctrl+hover opens.
      data-color-surface="field"
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
      onClick={(e) => {
        // Ctrl+click opens this field's style/visibility controls in the
        // Dynamic Settings panel (see overlay/FieldStyleQuickEdit.tsx)
        // instead of the old always-visible inline 🎨 icon — kept out of
        // rearrange mode (where a plain click already means something:
        // picking up drag, or the delete/copy tools above) and out of
        // Color Mode (ctrl+hover already owns this element there, for
        // background editing — see data-color-surface above).
        if (!e.ctrlKey || rearranging || colorModeOpen) return;
        e.preventDefault();
        e.stopPropagation();
        openFieldStyle(id);
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