// Converts a note page's old row-per-block content into the single HTML
// document the new Tiptap-based editor expects. Used once by the
// migrate_notes_blocks_to_content backfill in database.ts — notes_blocks
// itself is left in place afterward, unread by the live app.
export interface LegacyNoteBlockRow {
  blockType: string;
  content: string;
  checked: number | boolean;
}

function escapeHtml(raw: string): string {
  return raw.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// These old block types render as one Tiptap list/blockquote/callout
// node with many children, not one node per block — so consecutive runs
// of the same type get grouped into a single wrapper.
const GROUPABLE = new Set(["bulleted", "numbered", "todo", "quote", "callout"]);

function wrapGroup(type: string, rows: LegacyNoteBlockRow[]): string {
  if (type === "quote") {
    return `<blockquote>${rows.map((r) => `<p>${escapeHtml(r.content)}</p>`).join("")}</blockquote>`;
  }
  if (type === "callout") {
    return `<div data-callout="">${rows.map((r) => `<p>${escapeHtml(r.content)}</p>`).join("")}</div>`;
  }
  const items = rows
    .map((r) => {
      const text = `<p>${escapeHtml(r.content)}</p>`;
      if (type === "todo") {
        const checked = r.checked ? "true" : "false";
        const checkedAttr = r.checked ? " checked" : "";
        return `<li data-type="taskItem" data-checked="${checked}"><label><input type="checkbox"${checkedAttr}><span></span></label><div>${text}</div></li>`;
      }
      return `<li>${text}</li>`;
    })
    .join("");
  if (type === "todo") return `<ul data-type="taskList">${items}</ul>`;
  return type === "numbered" ? `<ol>${items}</ol>` : `<ul>${items}</ul>`;
}

export function notesBlocksToHtml(blocks: LegacyNoteBlockRow[]): string {
  if (blocks.length === 0) return "<p></p>";

  const html: string[] = [];
  let i = 0;
  while (i < blocks.length) {
    const block = blocks[i];
    if (GROUPABLE.has(block.blockType)) {
      const group: LegacyNoteBlockRow[] = [];
      while (i < blocks.length && blocks[i].blockType === block.blockType) {
        group.push(blocks[i]);
        i++;
      }
      html.push(wrapGroup(block.blockType, group));
      continue;
    }
    switch (block.blockType) {
      case "heading1":
        html.push(`<h1>${escapeHtml(block.content)}</h1>`);
        break;
      case "heading2":
        html.push(`<h2>${escapeHtml(block.content)}</h2>`);
        break;
      case "heading3":
        html.push(`<h3>${escapeHtml(block.content)}</h3>`);
        break;
      case "divider":
        html.push("<hr>");
        break;
      default:
        html.push(`<p>${escapeHtml(block.content)}</p>`);
    }
    i++;
  }
  return html.join("") || "<p></p>";
}
