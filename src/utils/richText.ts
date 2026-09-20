// Strips a Tiptap field's stored HTML down to plain text for contexts
// that only ever show plain strings (Web card previews, graph node
// captions) — those never render raw HTML, so leaving tags in would
// show up as literal "<p>" text instead of formatting.
export function htmlToPlainText(html: string): string {
  if (!html) return "";
  if (!html.includes("<")) return html;
  const doc = new DOMParser().parseFromString(html, "text/html");
  const blocks = doc.body.querySelectorAll("p, li, h1, h2, h3, blockquote, div");
  blocks.forEach((el) => el.append("\n"));
  return (doc.body.textContent ?? "").replace(/\n{2,}/g, "\n").trim();
}
