import React, { useEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/core";
import { useEditorSettings } from "./EditorSettingsContext";
import { resolveInputMode } from "./inputMode";
import { buildEditorContextMenuSections } from "./editorMenuSections";
import type { ContextMenuSection } from "../components/ContextMenu";

const LONG_PRESS_MS = 500;

// Wires right-click (mouse) or long-press (touch) on an editor's root
// element to the shared ContextMenu, gated by the user's editor
// settings. Both surfaces open the identical menu at the pointer
// position — one toggle, not a combinatorial device/setting matrix.
export function useEditorContextMenu(editor: Editor | null) {
  const { settings } = useEditorSettings();
  const [menuPos, setMenuPos] = useState<{ x: number; y: number } | null>(null);
  const longPressTimer = useRef<number | null>(null);
  const mode = resolveInputMode(settings.inputMode);

  const close = () => setMenuPos(null);

  useEffect(() => {
    return () => {
      if (longPressTimer.current) window.clearTimeout(longPressTimer.current);
    };
  }, []);

  const cancelLongPress = () => {
    if (longPressTimer.current) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const onContextMenu = (e: React.MouseEvent) => {
    if (!settings.contextMenuEnabled || mode !== "mouse" || !editor) return;
    e.preventDefault();
    setMenuPos({ x: e.clientX, y: e.clientY });
  };

  const onTouchStart = (e: React.TouchEvent) => {
    if (!settings.contextMenuEnabled || mode !== "touch" || !editor) return;
    const touch = e.touches[0];
    if (!touch) return;
    const x = touch.clientX;
    const y = touch.clientY;
    longPressTimer.current = window.setTimeout(() => setMenuPos({ x, y }), LONG_PRESS_MS);
  };

  const sections: ContextMenuSection[] = editor ? buildEditorContextMenuSections(editor, close) : [];

  return {
    menuPos,
    sections,
    close,
    handlers: {
      onContextMenu,
      onTouchStart,
      onTouchMove: cancelLongPress,
      onTouchEnd: cancelLongPress,
    },
  };
}
