// src/editor/RecipeEditor.tsx
import React, { useRef, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import { openUrl } from "@tauri-apps/plugin-opener";
import { ResizableImage } from "./extensions/ResizableImage";
import { toggleExtensions, insertToggle } from "./extensions/Toggle";
import { fetchAllRecipesFlat, RecipeLinkTarget } from "../db/recipes";
import { Icon } from "../icons/Icon";
import { TextElement } from "../icons/TextElement";
import "./RecipeEditor.css";

// Old recipes had plain-text instructions. If the content doesn't
// look like HTML, treat each line as its own paragraph so line breaks
// aren't lost when it's loaded into the editor.
function toEditorContent(raw: string): string {
  if (!raw) return "<p></p>";
  if (raw.includes("<") && raw.includes(">")) return raw;
  return raw
    .split("\n")
    .map((line) => `<p>${line || ""}</p>`)
    .join("");
}

export function RecipeEditor({
  content,
  onChange,
  onOpenRecipeLink,
}: {
  content: string;
  onChange: (html: string) => void;
  onOpenRecipeLink: (recipeId: number) => void;
}) {
  const [showListMenu, setShowListMenu] = useState(false);
  const [showLinkMenu, setShowLinkMenu] = useState(false);
  const [linkMode, setLinkMode] = useState<"recipe" | "url">("recipe");
  const [linkSearch, setLinkSearch] = useState("");
  const [linkUrlInput, setLinkUrlInput] = useState("");
  const [linkRecipes, setLinkRecipes] = useState<RecipeLinkTarget[]>([]);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Underline,
      Link.configure({ openOnClick: false, autolink: true }),
      ResizableImage,
      TaskList,
      TaskItem.configure({ nested: true }),
      ...toggleExtensions,
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
          } else if (href) {
            openUrl(href).catch(() => {});
          }
          return true;
        }
        return false;
      },
    },
  });

  if (!editor) return null;

  const openLinkMenu = async () => {
    setShowListMenu(false);
    if (linkRecipes.length === 0) {
      setLinkRecipes(await fetchAllRecipesFlat());
    }
    setShowLinkMenu(true);
  };

  const insertRecipeLink = (target: RecipeLinkTarget) => {
    const { from, to } = editor.state.selection;
    const href = `app://recipe/${target.id}`;
    if (from === to) {
      editor
        .chain()
        .focus()
        .insertContent({ type: "text", text: target.name, marks: [{ type: "link", attrs: { href } }] })
        .run();
    } else {
      editor.chain().focus().setLink({ href }).run();
    }
    setShowLinkMenu(false);
    setLinkSearch("");
  };

  const insertUrlLink = () => {
    const url = linkUrlInput.trim();
    if (!url) return;
    const { from, to } = editor.state.selection;
    if (from === to) {
      editor
        .chain()
        .focus()
        .insertContent({ type: "text", text: url, marks: [{ type: "link", attrs: { href: url } }] })
        .run();
    } else {
      editor.chain().focus().setLink({ href: url }).run();
    }
    setShowLinkMenu(false);
    setLinkUrlInput("");
  };

  const handleImageSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      editor.chain().focus().setImage({ src: reader.result as string }).run();
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const filteredLinkRecipes = linkRecipes.filter((r) =>
    r.name.toLowerCase().includes(linkSearch.toLowerCase())
  );

  return (
    <div className="recipe-editor">
      <div className="recipe-editor-toolbar">
        <div className="toolbar-group">
          <button
            className={editor.isActive("bold") ? "active" : ""}
            onClick={() => editor.chain().focus().toggleBold().run()}
            title="Bold"
          >
            <TextElement elementKey="bold-button" />
          </button>
          <button
            className={editor.isActive("italic") ? "active" : ""}
            onClick={() => editor.chain().focus().toggleItalic().run()}
            title="Italic"
          >
            <TextElement elementKey="italic-button" />
          </button>
          <button
            className={editor.isActive("underline") ? "active" : ""}
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            title="Underline"
          >
            <TextElement elementKey="underline-button" />
          </button>
          <button
            className={editor.isActive("strike") ? "active" : ""}
            onClick={() => editor.chain().focus().toggleStrike().run()}
            title="Strikethrough"
          >
            <TextElement elementKey="strike-button" />
          </button>
          <button
            className={editor.isActive("code") ? "active" : ""}
            onClick={() => editor.chain().focus().toggleCode().run()}
            title="Inline code"
          >
            <TextElement elementKey="code-button" />
          </button>
        </div>

        <div className="toolbar-group">
          <button
            className={editor.isActive("heading", { level: 1 }) ? "active" : ""}
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            title="Heading 1"
          >
            <TextElement elementKey="heading1-button" />
          </button>
          <button
            className={editor.isActive("heading", { level: 2 }) ? "active" : ""}
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            title="Heading 2"
          >
            <TextElement elementKey="heading2-button" />
          </button>
          <button
            className={editor.isActive("heading", { level: 3 }) ? "active" : ""}
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            title="Heading 3"
          >
            <TextElement elementKey="heading3-button" />
          </button>
        </div>

        <div className="toolbar-group">
          <div className="toolbar-popover-wrapper">
            <button
              onClick={() => {
                setShowLinkMenu(false);
                setShowListMenu((v) => !v);
              }}
              title="Lists"
            >
              <Icon iconKey="list" size={15} />
            </button>
            {showListMenu && (
              <>
                <div className="toolbar-backdrop" onClick={() => setShowListMenu(false)} />
                <div className="toolbar-popover">
                  <button
                    onClick={() => {
                      editor.chain().focus().toggleOrderedList().run();
                      setShowListMenu(false);
                    }}
                  >
                    Numbered list
                  </button>
                  <button
                    onClick={() => {
                      editor.chain().focus().toggleBulletList().run();
                      setShowListMenu(false);
                    }}
                  >
                    Bulleted list
                  </button>
                  <button
                    onClick={() => {
                      editor.chain().focus().toggleTaskList().run();
                      setShowListMenu(false);
                    }}
                  >
                    To-do list
                  </button>
                  <button
                    onClick={() => {
                      insertToggle(editor);
                      setShowListMenu(false);
                    }}
                  >
                    Toggle list
                  </button>
                </div>
              </>
            )}
          </div>

          <button
            className={editor.isActive("blockquote") ? "active" : ""}
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            title="Quote"
          >
            <TextElement elementKey="quote-button" />
          </button>
        </div>

        <div className="toolbar-group">
          <div className="toolbar-popover-wrapper">
            <button onClick={openLinkMenu} title="Link">
              <Icon iconKey="link" size={15} />
            </button>
            {showLinkMenu && (
              <>
                <div className="toolbar-backdrop" onClick={() => setShowLinkMenu(false)} />
                <div className="toolbar-popover link-popover">
                  <div className="link-mode-tabs">
                    <button
                      className={linkMode === "recipe" ? "active" : ""}
                      onClick={() => setLinkMode("recipe")}
                    >
                      Recipe
                    </button>
                    <button
                      className={linkMode === "url" ? "active" : ""}
                      onClick={() => setLinkMode("url")}
                    >
                      URL
                    </button>
                  </div>

                  {linkMode === "recipe" ? (
                    <>
                      <input
                        className="link-search-input"
                        autoFocus
                        placeholder="Search recipes…"
                        value={linkSearch}
                        onChange={(e) => setLinkSearch(e.target.value)}
                      />
                      <div className="link-recipe-list">
                        {filteredLinkRecipes.length === 0 ? (
                          <div className="link-recipe-empty">No matches</div>
                        ) : (
                          filteredLinkRecipes.map((r) => (
                            <button
                              key={r.id}
                              className="link-recipe-item"
                              onClick={() => insertRecipeLink(r)}
                            >
                              <span className="link-recipe-name">{r.name}</span>
                              <span className="link-recipe-category">{r.categoryName}</span>
                            </button>
                          ))
                        )}
                      </div>
                    </>
                  ) : (
                    <>
                      <input
                        className="link-search-input"
                        autoFocus
                        placeholder="https://…"
                        value={linkUrlInput}
                        onChange={(e) => setLinkUrlInput(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && insertUrlLink()}
                      />
                      <button className="link-insert-button" onClick={insertUrlLink}>
                        Insert
                      </button>
                    </>
                  )}
                </div>
              </>
            )}
          </div>

          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={handleImageSelected}
          />
          <button onClick={() => imageInputRef.current?.click()} title="Image">
            <Icon iconKey="image" size={15} />
          </button>

          <button onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Divider">
            <Icon iconKey="divider" size={15} />
          </button>
        </div>
      </div>

      <EditorContent editor={editor} className="recipe-editor-content" />
    </div>
  );
}
