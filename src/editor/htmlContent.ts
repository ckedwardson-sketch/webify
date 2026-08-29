// src/editor/htmlContent.ts
// Old recipes/notes had plain-text content. If it doesn't look like
// HTML, treat each line as its own paragraph so line breaks aren't
// lost when it's loaded into a Tiptap editor.
export function toEditorContent(raw: string): string {
  if (!raw) return "<p></p>";
  if (raw.includes("<") && raw.includes(">")) return raw;
  return raw
    .split("\n")
    .map((line) => `<p>${line || ""}</p>`)
    .join("");
}
