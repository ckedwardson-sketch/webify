// src/editor/RecipeEditor.tsx
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Highlight from "@tiptap/extension-highlight";
import { openUrl } from "@tauri-apps/plugin-opener";
import { ResizableImage } from "./extensions/ResizableImage";
import { toggleExtensions } from "./extensions/Toggle";
import { calloutExtensions } from "./extensions/Callout";
import { SlashCommand } from "./extensions/SlashCommand";
import { fetchAllRecipesFlat } from "../db/recipes";
import { fetchAllNotePagesFlat } from "../db/notes";
import { toEditorContent } from "./htmlContent";
import { EditorToolbar } from "./toolbar/EditorToolbar";
import { ListPopover } from "./toolbar/ListPopover";
import { LinkPopover, LinkTargetProvider } from "./toolbar/LinkPopover";
import { ImageButton } from "./toolbar/ImageButton";
import { EditorBubbleMenu } from "./EditorBubbleMenu";
import { useEditorContextMenu } from "./useEditorContextMenu";
import { useEditorSettings } from "./EditorSettingsContext";
import { ContextMenu } from "../components/ContextMenu";
import { EDITOR_COMMAND_REGISTRY } from "./commands/registry";
import "./RecipeEditor.css";

const RECIPE_LINK_PROVIDER: LinkTargetProvider = {
  tabKey: "recipe",
  tabLabel: "Recipe",
  hrefScheme: "app://recipe/",
  searchPlaceholder: "Search recipes…",
  fetchTargets: async () =>
    (await fetchAllRecipesFlat()).map((r) => ({ id: r.id, name: r.name, groupLabel: r.categoryName })),
};

const NOTE_LINK_PROVIDER: LinkTargetProvider = {
  tabKey: "note",
  tabLabel: "Note",
  hrefScheme: "app://note/",
  searchPlaceholder: "Search notes…",
  fetchTargets: async () =>
    (await fetchAllNotePagesFlat()).map((n) => ({ id: n.id, name: n.title, groupLabel: n.category })),
};

export function RecipeEditor({
  content,
  onChange,
  onOpenRecipeLink,
  onOpenNoteLink,
}: {
  content: string;
  onChange: (html: string) => void;
  onOpenRecipeLink: (recipeId: number) => void;
  onOpenNoteLink?: (noteId: number) => void;
}) {
  const { settings } = useEditorSettings();

  const editor = useEditor(
    {
      extensions: [
        StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
        Underline,
        Link.configure({ openOnClick: false, autolink: true }),
        Highlight,
        ResizableImage,
        TaskList,
        TaskItem.configure({ nested: true }),
        ...toggleExtensions,
        ...calloutExtensions,
        ...(settings.slashCommandEnabled ? [SlashCommand] : []),
      ],
      content: toEditorContent(content),
      onBlur: ({ editor }) => onChange(editor.getHTML()),
      editorProps: {
        handleClick(_view, _pos, event) {
          const target = event.target as HTMLElement;
          const anchor = target.closest("a");
          if (anchor) {
            const href = anchor.getAttribute("href") || "";
            event.preventDefault();
            if (href.startsWith("app://recipe/")) {
              const id = parseInt(href.replace("app://recipe/", ""), 10);
              if (!isNaN(id)) onOpenRecipeLink(id);
            } else if (href.startsWith("app://note/")) {
              const id = parseInt(href.replace("app://note/", ""), 10);
              if (!isNaN(id)) onOpenNoteLink?.(id);
            } else if (href) {
              openUrl(href).catch(() => {});
            }
            return true;
          }
          return false;
        },
      },
    },
    [settings.slashCommandEnabled]
  );

  const { menuPos, sections, close, handlers } = useEditorContextMenu(editor);

  if (!editor) return null;

  return (
    <div className="recipe-editor">
      {settings.toolbarEnabled && (
        <EditorToolbar
          editor={editor}
          groups={[
            ["bold", "italic", "underline", "strike", "code", "highlight"],
            ["heading1", "heading2", "heading3"],
            [
              <ListPopover
                key="list"
                editor={editor}
                commandKeys={["orderedList", "bulletList", "taskList", "toggleList"]}
                extraItems={[{ label: "Callout", onSelect: () => EDITOR_COMMAND_REGISTRY.callout.run(editor) }]}
              />,
              "blockquote",
              "codeBlock",
            ],
            [
              <LinkPopover key="link" editor={editor} providers={[RECIPE_LINK_PROVIDER, NOTE_LINK_PROVIDER]} />,
              <ImageButton key="image" editor={editor} />,
              "horizontalRule",
            ],
          ]}
        />
      )}

      <div
        className="recipe-editor-body"
        data-overlay-target="editor-context-menu"
        {...(settings.contextMenuEnabled ? handlers : {})}
      >
        {settings.bubbleMenuEnabled && <EditorBubbleMenu editor={editor} />}
        <EditorContent editor={editor} className="recipe-editor-content" />
      </div>

      {menuPos && <ContextMenu x={menuPos.x} y={menuPos.y} sections={sections} onClose={close} />}
    </div>
  );
}
