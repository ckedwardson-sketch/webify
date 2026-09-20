// "Capture Context" report generation — deliberately independent of
// captureEngine.ts's screenshot pipeline (used by the floating capture
// widget/Export to AI). That pipeline rasterizes whatever is currently
// on screen with html2canvas and dumps document.body.innerText for
// "readable" text, which bakes in sidebar nav, breadcrumbs, icon-font
// ligature glyphs and toolbar buttons alongside the real content —
// unreadable by a person or an AI. This module instead reads the actual
// rows straight out of SQLite (via the existing db/*.ts functions) and
// renders clean, labeled text plus real attached images — no DOM, no
// navigation, no screenshotting.
import { fetchCategories } from "../db/categories";
import { fetchAllRecipesFlat, fetchRecipe } from "../db/recipes";
import { fetchDreamGraphData, fetchDream } from "../db/dreams";
import { fetchAllGoals, fetchGoal, fetchWidgetsForGoal } from "../db/goals";
import { fetchAllProjects, fetchProject, fetchWidgetsForProject, fetchJournalEntries, fetchBoardItems } from "../db/projects";
import { fetchResponsibilities, fetchResponsibility } from "../db/responsibilities";
import { fetchFieldLayout, fetchFreetextFields, FieldCategory } from "../db/fieldLayout";
import { fetchDockImages } from "../db/dockImages";
import { fetchPhotos } from "../db/photos";
import { fetchCostEntries, fetchCostGroupings } from "../db/costLog";
import { fetchTable } from "../db/tables";
import { ProjectWidget } from "../types/project";
import jsPDF from "jspdf";

export type ContextGroup = "Categories" | "Recipes" | "Dreams" | "Goals" | "Projects" | "Responsibilities";

export interface ContextTarget {
  key: string;
  label: string;
  group: ContextGroup;
  id: number;
}

export async function buildContextCaptureTargets(): Promise<ContextTarget[]> {
  const targets: ContextTarget[] = [];

  const categories = await fetchCategories();
  for (const c of categories) {
    targets.push({ key: `category:${c.id}`, label: `Category: ${c.name}`, group: "Categories", id: c.id });
  }

  const recipes = await fetchAllRecipesFlat();
  for (const r of recipes) {
    targets.push({ key: `recipe:${r.id}`, label: `Recipe: ${r.name}`, group: "Recipes", id: r.id });
  }

  const { dreams } = await fetchDreamGraphData();
  for (const d of dreams) {
    targets.push({ key: `dream:${d.id}`, label: `Dream: ${d.name}`, group: "Dreams", id: d.id });
  }

  const goals = await fetchAllGoals();
  for (const g of goals) {
    targets.push({ key: `goal:${g.id}`, label: `Goal: ${g.name}`, group: "Goals", id: g.id });
  }

  const projects = await fetchAllProjects();
  for (const p of projects) {
    targets.push({ key: `project:${p.id}`, label: `Project: ${p.name}`, group: "Projects", id: p.id });
  }

  const responsibilities = await fetchResponsibilities();
  for (const r of responsibilities) {
    targets.push({ key: `responsibility:${r.id}`, label: `Responsibility: ${r.name}`, group: "Responsibilities", id: r.id });
  }

  return targets;
}

export interface ReportField {
  label: string;
  value: string;
}

export interface ReportImage {
  caption: string;
  dataUrl: string;
}

export interface ReportSection {
  title: string;
  group: ContextGroup;
  fields: ReportField[];
  images: ReportImage[];
}

function formatDateRange(start?: string, end?: string): string | null {
  if (!start && !end) return null;
  if (start && end && start === end) return start;
  if (start && end) return `${start} → ${end}`;
  return start ?? end ?? null;
}

function push(fields: ReportField[], label: string, value: string | null | undefined): void {
  const trimmed = (value ?? "").trim();
  if (trimmed) fields.push({ label, value: trimmed });
}

// Journal/cost-log/table/link-board/photo/dock content shared by
// Projects and Goals (both use the same project_widgets-backed widget
// bay) — enumerates each widget's rows and appends readable text or
// collects real images, by widget type.
async function appendWidgetContent(widgets: ProjectWidget[], fields: ReportField[], images: ReportImage[]): Promise<void> {
  for (const w of widgets) {
    const title = w.title?.trim() || FIELD_LABEL_FOR_WIDGET[w.widgetType];
    switch (w.widgetType) {
      case "journal": {
        const entries = await fetchJournalEntries(w.id);
        if (entries.length === 0) break;
        const text = entries
          .map((e) => `[${new Date(e.createdAt).toLocaleDateString()}] ${e.content}`)
          .join("\n\n");
        push(fields, `Journal — ${title}`, text);
        break;
      }
      case "costlog": {
        const entries = await fetchCostEntries(w.id);
        if (entries.length === 0) break;
        const total = entries.reduce((sum, e) => sum + e.amount, 0);
        const lines = entries.map(
          (e) => `$${e.amount.toFixed(2)} — ${e.description} (${new Date(e.createdAt).toLocaleDateString()})`
        );
        push(fields, `Cost Log — ${title}`, `${lines.join("\n")}\n\nTotal: $${total.toFixed(2)}`);
        break;
      }
      case "mastercostlog": {
        const groupings = await fetchCostGroupings(w.id);
        if (groupings.length === 0) break;
        push(fields, `Master Cost Log — ${title}`, `Groupings: ${groupings.map((g) => g.name).join(", ")}`);
        break;
      }
      case "table": {
        const data = await fetchTable(w.id);
        const hasContent = data.rows.some((row) => row.some((cell) => cell.trim()));
        if (!hasContent) break;
        const text = [data.columns.join(" | "), ...data.rows.map((row) => row.join(" | "))].join("\n");
        push(fields, `Table — ${title}`, text);
        break;
      }
      case "linkboard": {
        const items = await fetchBoardItems(w.id);
        const lines: string[] = [];
        for (const item of items) {
          if (item.itemType === "text" && item.textContent) lines.push(item.textContent);
          else if (item.itemType === "link" && item.linkHref) lines.push(`${item.linkLabel || item.linkHref}: ${item.linkHref}`);
          else if (item.itemType === "image" && item.imageData) images.push({ caption: title, dataUrl: item.imageData });
        }
        push(fields, `Links/Notes — ${title}`, lines.join("\n"));
        break;
      }
      case "photo": {
        const photos = await fetchPhotos(w.id);
        for (const p of photos) images.push({ caption: p.caption?.trim() || title, dataUrl: p.imageData });
        break;
      }
      case "dock": {
        const dockImages = await fetchDockImages(w.id);
        dockImages.forEach((img, i) => images.push({ caption: `${title} ${dockImages.length > 1 ? i + 1 : ""}`.trim(), dataUrl: img.imageData }));
        break;
      }
      case "calculator":
        break;
    }
  }
}

const FIELD_LABEL_FOR_WIDGET: Record<ProjectWidget["widgetType"], string> = {
  journal: "Journal",
  linkboard: "Links / Notes",
  table: "Table",
  photo: "Photos",
  dock: "Image Dock",
  costlog: "Cost Log",
  calculator: "Calculator",
  mastercostlog: "Master Cost Log",
};

// Freetext fields are a generic, unlimited-per-owner field type (see
// db/fieldLayout.ts) — their content lives outside the entity's own TS
// interface entirely, so they have to be pulled separately via the
// owner's field_layout rows.
async function appendFreetextFields(category: FieldCategory, ownerId: number, fields: ReportField[]): Promise<void> {
  const layout = await fetchFieldLayout(category, ownerId);
  const freetextIds = layout.filter((f) => f.fieldType === "freetext" && f.refId !== null).map((f) => f.refId!);
  if (freetextIds.length === 0) return;
  const freetextMap = await fetchFreetextFields(freetextIds);
  for (const row of layout) {
    if (row.fieldType !== "freetext" || row.refId === null) continue;
    const ft = freetextMap.get(row.refId);
    if (ft) push(fields, row.customLabel ?? ft.label, ft.content);
  }
}

// Solo Image Dock fields (field_layout's "solo_dock") are excluded from
// fetchWidgetsForProject/Goal on purpose — they render inline as a
// field, not in the widget bay — so their images have to be pulled by
// walking the owner's field_layout rows directly.
async function appendSoloDockImages(category: FieldCategory, ownerId: number, images: ReportImage[]): Promise<void> {
  const layout = await fetchFieldLayout(category, ownerId);
  for (const row of layout) {
    if (row.fieldType !== "solo_dock" || row.refId === null) continue;
    const dockImages = await fetchDockImages(row.refId);
    const label = row.customLabel ?? "Image Dock";
    dockImages.forEach((img, i) => images.push({ caption: `${label} ${dockImages.length > 1 ? i + 1 : ""}`.trim(), dataUrl: img.imageData }));
  }
}

async function buildGoalSection(id: number): Promise<ReportSection | null> {
  const goal = await fetchGoal(id);
  if (!goal) return null;
  const fields: ReportField[] = [];
  const images: ReportImage[] = [];

  push(fields, "Goals", goal.goals);
  push(fields, "Reasoning", goal.reasoning);
  push(fields, "What needs doing", goal.needsDoing);
  push(fields, "Estimated start date", goal.estimatedStartDate ?? null);
  push(fields, "When it should be done", formatDateRange(goal.expectedDateStart, goal.expectedDateEnd));

  if (goal.imageData) images.push({ caption: goal.name, dataUrl: goal.imageData });

  await appendFreetextFields("goal", id, fields);
  await appendSoloDockImages("goal", id, images);
  await appendWidgetContent(await fetchWidgetsForGoal(id), fields, images);

  return { title: goal.name, group: "Goals", fields, images };
}

async function buildProjectSection(id: number): Promise<ReportSection | null> {
  const project = await fetchProject(id);
  if (!project) return null;
  const fields: ReportField[] = [];
  const images: ReportImage[] = [];

  push(fields, "Goals", project.goals);
  push(fields, "Reasoning", project.reasoning);
  push(fields, "What needs doing", project.needsDoing);
  push(fields, "Estimated start date", project.estimatedStartDate ?? null);
  push(fields, "When it should be done", formatDateRange(project.expectedDateStart, project.expectedDateEnd));

  if (project.imageData) images.push({ caption: project.name, dataUrl: project.imageData });

  await appendFreetextFields("project", id, fields);
  await appendSoloDockImages("project", id, images);
  await appendWidgetContent(await fetchWidgetsForProject(id), fields, images);

  return { title: project.name, group: "Projects", fields, images };
}

async function buildDreamSection(id: number): Promise<ReportSection | null> {
  const dream = await fetchDream(id);
  if (!dream) return null;
  const fields: ReportField[] = [];

  push(fields, "Reasoning", dream.reasoning);
  push(fields, "Other words", dream.notes);
  push(fields, "Priority", dream.priority);
  push(fields, "Estimated start date", dream.estimatedStartDate ?? null);
  push(fields, "Expected date", formatDateRange(dream.expectedDateStart, dream.expectedDateEnd));

  await appendFreetextFields("dream", id, fields);

  return { title: dream.name, group: "Dreams", fields, images: [] };
}

async function buildRecipeSection(id: number): Promise<ReportSection | null> {
  const recipe = await fetchRecipe(id);
  if (!recipe) return null;
  const fields: ReportField[] = [];
  const images: ReportImage[] = [];

  const flags = [
    recipe.isProven && "Proven",
    recipe.isFavorite && "Favorite",
    recipe.isFrozen && "Frozen",
    recipe.isHomegrown && "Homegrown",
  ].filter(Boolean) as string[];
  if (flags.length > 0) push(fields, "Status", flags.join(", "));

  push(fields, "Instructions", recipe.instructions);
  push(fields, "Inspiration", recipe.inspiration ?? null);
  push(fields, "Reference notes", recipe.referenceContent ?? null);

  if (recipe.imageData) images.push({ caption: recipe.name, dataUrl: recipe.imageData });

  return { title: recipe.name, group: "Recipes", fields, images };
}

async function buildResponsibilitySection(id: number): Promise<ReportSection | null> {
  const resp = await fetchResponsibility(id);
  if (!resp) return null;
  const fields: ReportField[] = [];
  const images: ReportImage[] = [];

  push(fields, "Category", resp.category);
  push(fields, "Description", resp.description);
  push(fields, "Consequences of skipping", resp.consequences);
  push(fields, "Reasoning", resp.reasoning);

  if (resp.imageData) images.push({ caption: resp.name, dataUrl: resp.imageData });

  return { title: resp.name, group: "Responsibilities", fields, images };
}

async function buildCategorySection(id: number): Promise<ReportSection | null> {
  const categories = await fetchCategories();
  const category = categories.find((c) => c.id === id);
  if (!category) return null;
  const recipes = (await fetchAllRecipesFlat()).filter((r) => r.categoryId === id);
  const fields: ReportField[] = [];
  push(
    fields,
    "Recipes in this category",
    recipes.length > 0 ? recipes.map((r) => r.name).join("\n") : "(none yet)"
  );
  return { title: category.name, group: "Categories", fields, images: [] };
}

async function buildSectionForTarget(target: ContextTarget): Promise<ReportSection | null> {
  switch (target.group) {
    case "Categories":
      return buildCategorySection(target.id);
    case "Recipes":
      return buildRecipeSection(target.id);
    case "Dreams":
      return buildDreamSection(target.id);
    case "Goals":
      return buildGoalSection(target.id);
    case "Projects":
      return buildProjectSection(target.id);
    case "Responsibilities":
      return buildResponsibilitySection(target.id);
  }
}

// Images come straight out of SQLite as whatever the user originally
// uploaded (often an uncompressed phone-camera PNG/JPEG several
// megabytes each) — re-encoding every one down to a bounded JPEG here
// is what keeps a report with a dozen photos from becoming a
// multi-hundred-megabyte PDF (the original ask: "downscale images as
// base64 is very big").
const MAX_IMAGE_WIDTH = 1000;
const IMAGE_JPEG_QUALITY = 0.75;

function downscaleImage(dataUrl: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, MAX_IMAGE_WIDTH / img.width);
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(dataUrl);
        return;
      }
      // Flatten any transparency onto white first — JPEG has no alpha
      // channel, so skipping this turns a transparent PNG's background
      // solid black instead.
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL("image/jpeg", IMAGE_JPEG_QUALITY));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

export async function generateContextReport(
  targets: ContextTarget[],
  onProgress?: (message: string) => void
): Promise<{ blob: Blob; sectionCount: number; errors: { label: string; message: string }[] }> {
  const sections: ReportSection[] = [];
  const errors: { label: string; message: string }[] = [];

  for (let i = 0; i < targets.length; i++) {
    const target = targets[i];
    onProgress?.(`Reading ${i + 1} / ${targets.length}: ${target.label}`);
    try {
      const section = await buildSectionForTarget(target);
      if (section) sections.push(section);
    } catch (err) {
      console.error(`Capture Context: failed to read "${target.label}":`, err);
      errors.push({ label: target.label, message: err instanceof Error ? err.message : String(err) });
    }
  }

  if (sections.length === 0) {
    throw new Error("No content could be read for the selected items.");
  }

  const totalImages = sections.reduce((sum, s) => sum + s.images.length, 0);
  let imagesDone = 0;
  for (const section of sections) {
    for (const image of section.images) {
      imagesDone++;
      onProgress?.(`Compressing image ${imagesDone} / ${totalImages}...`);
      image.dataUrl = await downscaleImage(image.dataUrl);
    }
  }

  return { blob: buildContextReportPdf(sections), sectionCount: sections.length, errors };
}

const PAGE_MARGIN = 42;

function buildContextReportPdf(sections: ReportSection[]): Blob {
  const pdf = new jsPDF({ unit: "pt", format: "letter", compress: true });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const contentWidth = pageWidth - PAGE_MARGIN * 2;
  let y = PAGE_MARGIN;

  const ensureSpace = (needed: number) => {
    if (y + needed > pageHeight - PAGE_MARGIN) {
      pdf.addPage();
      y = PAGE_MARGIN;
    }
  };

  const writeParagraph = (text: string, fontSize: number, lineHeight: number, bold = false) => {
    pdf.setFont("helvetica", bold ? "bold" : "normal");
    pdf.setFontSize(fontSize);
    const lines: string[] = pdf.splitTextToSize(text, contentWidth);
    for (const line of lines) {
      ensureSpace(lineHeight);
      pdf.text(line, PAGE_MARGIN, y);
      y += lineHeight;
    }
  };

  // Cover page: report title + a table of contents, so a reader (human
  // or AI) knows exactly what's in the file before hitting the detail
  // pages.
  writeParagraph("Webify Capture Context Report", 20, 26, true);
  writeParagraph(`Generated ${new Date().toLocaleString()}`, 10, 16);
  y += 8;
  writeParagraph(`${sections.length} item(s) included:`, 12, 18, true);
  for (const section of sections) {
    writeParagraph(`•  [${section.group}] ${section.title}`, 10.5, 15);
  }

  for (const section of sections) {
    pdf.addPage();
    y = PAGE_MARGIN;
    writeParagraph(section.group, 9.5, 13);
    writeParagraph(section.title, 18, 24, true);
    y += 6;

    if (section.fields.length === 0 && section.images.length === 0) {
      writeParagraph("(No content recorded for this item.)", 11, 16);
    }

    for (const field of section.fields) {
      ensureSpace(24);
      writeParagraph(field.label, 11, 15, true);
      writeParagraph(field.value, 10.5, 14);
      y += 10;
    }

    for (const image of section.images) {
      let props: { width: number; height: number };
      try {
        props = pdf.getImageProperties(image.dataUrl);
      } catch (err) {
        console.error(`Capture Context: skipping unreadable image for "${section.title}":`, err);
        continue;
      }
      const scale = Math.min(1, contentWidth / props.width);
      const imgW = props.width * scale;
      const imgH = props.height * scale;

      if (imgH + 30 > pageHeight - PAGE_MARGIN * 2) {
        // Taller than a whole page even at full content width — give it
        // its own page rather than splitting an image across pages.
        pdf.addPage();
        y = PAGE_MARGIN;
      } else {
        ensureSpace(imgH + 30);
      }
      if (image.caption) writeParagraph(image.caption, 9.5, 13);
      pdf.addImage(image.dataUrl, "JPEG", PAGE_MARGIN, y, imgW, imgH);
      y += imgH + 16;
    }
  }

  return pdf.output("blob");
}

export function downloadContextReport(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
