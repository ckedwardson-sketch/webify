// A compact Tiptap field standing in for a plain <textarea> on the
// Project/Goal/Dream/Progress/Responsibility detail pages and
// FreetextFieldEditor — gives those built-in/freetext fields the same
// right-click Turn-into/Format/Spelling menu Notes and Recipes already
// have (see useEditorContextMenu.ts), instead of a menu-less plain
// field. No persistent toolbar/bubble menu/slash command by design —
// these are small inline fields, not full pages; the right-click menu
// *is* the toolbar here. Content is stored as HTML in the same TEXT
// column the plain string used to live in (see htmlContent.ts's
// toEditorContent for the legacy-plain-text migration on read).
import { CSSProperties, useEffect } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Highlight from "@tiptap/extension-highlight";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Placeholder from "@tiptap/extension-placeholder";
import { toggleExtensions } from "./extensions/Toggle";
import { calloutExtensions } from "./extensions/Callout";
import { SpellCheck } from "./extensions/SpellCheck";
import "./extensions/SpellCheck.css";
import { toEditorContent } from "./htmlContent";
import { useEditorContextMenu } from "./useEditorContextMenu";
import { useEditorSettings } from "./EditorSettingsContext";
import { ContextMenu } from "../components/ContextMenu";
import "./RichTextField.css";

export function RichTextField({
  value,
  onChange,
  onBlur,
  placeholder,
  className,
  style,
  fieldId,
  onResizeField,
}: {
  value: string;
  onChange: (html: string) => void;
  // Fires after onChange with the final HTML, same "commit on blur"
  // convention every other field on these pages already uses.
  onBlur?: (html: string) => void;
  placeholder?: string;
  className?: string;
  style?: CSSProperties;
  // Passed straight through to a resizable field's persisted height —
  // see fieldStyle.ts's handleFieldResizeMouseUp, which this component
  // replicates on its own wrapper since a Tiptap editor has no native
  // <textarea> to drag-resize.
  fieldId?: number;
  onResizeField?: (fieldId: number, heightPx: number | null) => void;
}) {
  const { settings } = useEditorSettings();

  const editor = useEditor(
    {
      extensions: [
        StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
        Underline,
        Highlight,
        TaskList,
        TaskItem.configure({ nested: true }),
        ...toggleExtensions,
        ...calloutExtensions,
        Placeholder.configure({ placeholder: placeholder ?? "" }),
        ...(settings.spellcheckEnabled ? [SpellCheck] : []),
      ],
      content: toEditorContent(value),
      onUpdate: ({ editor }) => onChange(editor.getHTML()),
      onBlur: ({ editor }) => onBlur?.(editor.getHTML()),
    },
    [settings.spellcheckEnabled]
  );

  // Only push external value changes (switching records, a saved-layout
  // load) into the editor — never on every keystroke, since onUpdate
  // above already keeps `value` in sync with what's on screen while
  // typing, and re-setting content on every render would fight the
  // cursor position.
  useEffect(() => {
    if (!editor || editor.isFocused) return;
    if (editor.getHTML() !== toEditorContent(value)) {
      editor.commands.setContent(toEditorContent(value), { emitUpdate: false });
    }
  }, [value, editor]);

  const { menuPos, sections, close, handlers } = useEditorContextMenu(editor);

  if (!editor) return null;

  return (
    <div
      className={`rich-text-field${className ? ` ${className}` : ""}`}
      style={style}
      onClick={(e) => {
        if (e.target === e.currentTarget) editor.commands.focus("end");
      }}
      onMouseUp={(e) => {
        if (fieldId != null) onResizeField?.(fieldId, e.currentTarget.offsetHeight);
      }}
      {...(settings.contextMenuEnabled ? handlers : {})}
    >
      <EditorContent editor={editor} className="rich-text-field-content" />
      {menuPos && <ContextMenu x={menuPos.x} y={menuPos.y} sections={sections} onClose={close} />}
    </div>
  );
}
