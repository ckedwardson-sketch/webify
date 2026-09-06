// Import support for Notion's "Export" feature (Settings > Export...),
// which produces either loose .md/.csv/.html files or a .zip bundling
// them. Notion appends a trailing 32-char hex id to every exported
// filename ("Project Plan a1b2c3d4e5f6...html") — stripped here so
// imported note titles read the way they did in Notion.
import JSZip from "jszip";

export interface ImportedDoc {
  title: string;
  html: string;
}

const SUPPORTED_EXT = /\.(md|markdown|html?|csv)$/i;
const NOTION_ID_SUFFIX = /\s+[0-9a-f]{32}$/i;

export function cleanNotionTitle(filename: string): string {
  const base = filename.replace(/\.[^./\\]+$/, "").split(/[/\\]/).pop() ?? filename;
  const stripped = base.replace(NOTION_ID_SUFFIX, "").trim();
  return stripped || "Untitled import";
}

function extOf(filename: string): string {
  const m = filename.toLowerCase().match(/\.([a-z0-9]+)$/);
  return m ? m[1] : "";
}

function convertByExtension(filename: string, raw: string): string {
  const ext = extOf(filename);
  if (ext === "csv") return csvToHtmlTable(raw);
  if (ext === "html" || ext === "htm") return notionHtmlToContent(raw);
  return markdownToHtml(raw);
}

// Reads every selected file, expanding any .zip into its member
// .md/.html/.csv entries (Notion's "Export all workspace content"
// download), and converts each into Tiptap-ready HTML.
export async function extractDocsFromFiles(files: FileList | File[]): Promise<ImportedDoc[]> {
  const docs: ImportedDoc[] = [];
  for (const file of Array.from(files)) {
    if (/\.zip$/i.test(file.name)) {
      const zip = await JSZip.loadAsync(file);
      const entries = Object.values(zip.files)
        .filter((entry) => !entry.dir && SUPPORTED_EXT.test(entry.name))
        .sort((a, b) => a.name.localeCompare(b.name));
      for (const entry of entries) {
        const raw = await entry.async("string");
        docs.push({ title: cleanNotionTitle(entry.name), html: convertByExtension(entry.name, raw) });
      }
    } else if (SUPPORTED_EXT.test(file.name)) {
      const raw = await file.text();
      docs.push({ title: cleanNotionTitle(file.name), html: convertByExtension(file.name, raw) });
    }
  }
  return docs;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Bold/italic/inline-code/links — applied to already-escaped text so
// the only "<" / ">" in the result are the tags this inserts.
function inlineMarkdown(escaped: string): string {
  return escaped
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/__([^_]+)__/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(/(?<!_)_([^_]+)_(?!_)/g, "<em>$1</em>")
    .replace(/\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
}

function inline(text: string): string {
  return inlineMarkdown(escapeHtml(text));
}

// A deliberately small markdown subset — headings, bold/italic/code/
// links, bulleted/numbered/checkbox lists, blockquotes, fenced code,
// and horizontal rules — enough to cover a typical Notion markdown
// export without pulling in a full parser dependency.
export function markdownToHtml(markdown: string): string {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  let i = 0;

  const flushList = (buffer: string[], tag: "ul" | "ol") => {
    if (buffer.length === 0) return;
    out.push(`<${tag}>${buffer.map((li) => `<li><p>${inline(li)}</p></li>`).join("")}</${tag}>`);
    buffer.length = 0;
  };

  const flushTaskList = (buffer: { text: string; checked: boolean }[]) => {
    if (buffer.length === 0) return;
    const items = buffer
      .map(
        (item) =>
          `<li data-type="taskItem" data-checked="${item.checked}"><label><input type="checkbox"${
            item.checked ? " checked" : ""
          }><span></span></label><div><p>${inline(item.text)}</p></div></li>`
      )
      .join("");
    out.push(`<ul data-type="taskList">${items}</ul>`);
    buffer.length = 0;
  };

  let ulBuffer: string[] = [];
  let olBuffer: string[] = [];
  let taskBuffer: { text: string; checked: boolean }[] = [];
  let quoteBuffer: string[] = [];

  const flushQuote = () => {
    if (quoteBuffer.length === 0) return;
    out.push(`<blockquote>${quoteBuffer.map((l) => `<p>${inline(l)}</p>`).join("")}</blockquote>`);
    quoteBuffer = [];
  };
  const flushAllLists = () => {
    flushList(ulBuffer, "ul");
    flushList(olBuffer, "ol");
    flushTaskList(taskBuffer);
  };

  while (i < lines.length) {
    const line = lines[i];

    const fence = line.match(/^```(.*)$/);
    if (fence) {
      flushAllLists();
      flushQuote();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) {
        codeLines.push(lines[i]);
        i++;
      }
      out.push(`<pre><code>${escapeHtml(codeLines.join("\n"))}</code></pre>`);
      i++;
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      flushAllLists();
      flushQuote();
      const level = Math.min(heading[1].length, 3);
      out.push(`<h${level}>${inline(heading[2])}</h${level}>`);
      i++;
      continue;
    }

    if (/^\s*([-*_]\s*){3,}$/.test(line) && line.trim().length >= 3) {
      flushAllLists();
      flushQuote();
      out.push("<hr>");
      i++;
      continue;
    }

    const quote = line.match(/^>\s?(.*)$/);
    if (quote) {
      flushList(ulBuffer, "ul");
      flushList(olBuffer, "ol");
      flushTaskList(taskBuffer);
      quoteBuffer.push(quote[1]);
      i++;
      continue;
    }
    flushQuote();

    const task = line.match(/^[-*]\s+\[( |x|X)\]\s+(.*)$/);
    if (task) {
      flushList(ulBuffer, "ul");
      flushList(olBuffer, "ol");
      taskBuffer.push({ text: task[2], checked: task[1].toLowerCase() === "x" });
      i++;
      continue;
    }
    flushTaskList(taskBuffer);

    const bullet = line.match(/^[-*]\s+(.*)$/);
    if (bullet) {
      flushList(olBuffer, "ol");
      ulBuffer.push(bullet[1]);
      i++;
      continue;
    }
    flushList(ulBuffer, "ul");

    const numbered = line.match(/^\d+[.)]\s+(.*)$/);
    if (numbered) {
      olBuffer.push(numbered[1]);
      i++;
      continue;
    }
    flushList(olBuffer, "ol");

    if (line.trim() === "") {
      i++;
      continue;
    }

    out.push(`<p>${inline(line)}</p>`);
    i++;
  }

  flushAllLists();
  flushQuote();

  return out.length > 0 ? out.join("") : "<p></p>";
}

// Notion's HTML export is a full standalone document. Pull just the
// body content and drop anything that could execute (script/style/
// event-handler attributes) before it ever reaches the editor.
export function notionHtmlToContent(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const root = doc.querySelector("article") ?? doc.body;
  if (!root) return "<p></p>";

  root.querySelectorAll("script, style").forEach((el) => el.remove());
  root.querySelectorAll("*").forEach((el) => {
    for (const attr of Array.from(el.attributes)) {
      if (/^on/i.test(attr.name) || attr.name === "style") el.removeAttribute(attr.name);
    }
  });

  const inner = root.innerHTML.trim();
  return inner || "<p></p>";
}

// Simple RFC4180-ish CSV parser (quoted fields, escaped quotes, commas
// and newlines inside quotes) — Notion exports each database as a CSV,
// rendered here as a plain HTML table with a bolded header row.
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += ch;
      i++;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (ch === ",") {
      row.push(field);
      field = "";
      i++;
      continue;
    }
    if (ch === "\r") {
      i++;
      continue;
    }
    if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      i++;
      continue;
    }
    field += ch;
    i++;
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

export function csvToHtmlTable(csv: string): string {
  const rows = parseCsv(csv);
  if (rows.length === 0) return "<p></p>";
  const [header, ...body] = rows;
  const headHtml = `<tr>${header.map((cell) => `<th><p>${inline(cell)}</p></th>`).join("")}</tr>`;
  const bodyHtml = body
    .map((r) => `<tr>${r.map((cell) => `<td><p>${inline(cell)}</p></td>`).join("")}</tr>`)
    .join("");
  return `<table><tbody>${headHtml}${bodyHtml}</tbody></table>`;
}
