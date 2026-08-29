// src/editor/toolbar/ImageButton.tsx
import React, { useRef } from "react";
import type { Editor } from "@tiptap/core";
import { Icon } from "../../icons/Icon";

export function ImageButton({ editor }: { editor: Editor }) {
  const inputRef = useRef<HTMLInputElement>(null);

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

  return (
    <>
      <input ref={inputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleImageSelected} />
      <button onClick={() => inputRef.current?.click()} title="Image">
        <Icon iconKey="image" size={15} />
      </button>
    </>
  );
}
