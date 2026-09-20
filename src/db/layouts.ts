import { getDb } from "./database";
import { ProjectWidgetType, ProjectWidget, ProjectBoardItem, PhotoWidgetSettings, PhotoEntry, DockImage, ProjectTableData, CostEntry } from "../types/project";
import {
  fetchJournalEntries,
  addJournalEntry,
  fetchBoardItems,
  addTextBoardItem,
  addLinkBoardItem,
  addImageBoardItem,
} from "./projects";
import { fetchTable, saveTable } from "./tables";
import { fetchPhotoSettings, savePhotoSettings, fetchPhotos, addPhoto } from "./photos";
import { fetchDockImages, addDockImage } from "./dockImages";
import { fetchCostEntries, addCostEntry } from "./costLog";
import { FieldCategory, FieldLayoutSnapshot, snapshotFieldLayout, applySavedFieldLayout } from "./fieldLayout";

// A "layout" is a saved snapshot of one page's widget list — see
// components/RearrangeToolbar.tsx. `category` is where it was saved
// from (e.g. "project", "goal") and is purely organizational: any
// layout can be loaded onto any page whose current widget types are a
// superset of the layout's (see isLayoutCompatible in
// RearrangeModeContext.tsx) — category isn't an access restriction.
export interface SavedLayoutWidget {
  widgetType: ProjectWidgetType;
  title: string;
  // Present only when the layout was saved with "include content"
  // checked. Shape depends on widgetType — see captureWidgetContent/
  // applyWidgetContent below, the only two places that need to agree
  // on it.
  content?: unknown;
}

export interface SavedLayout {
  id: number;
  name: string;
  category: string;
  includeContent: boolean;
  widgets: SavedLayoutWidget[];
  // The page's field list at save time (which fields were present, their
  // order, custom labels, and per-field styling) — null for layouts
  // saved before this existed, or if the snapshot somehow failed to
  // capture. See db/fieldLayout.ts's FieldLayoutSnapshot.
  fieldLayout: FieldLayoutSnapshot | null;
  createdAt: string;
}

type RawLayoutRow = {
  id: number;
  name: string;
  category: string;
  includeContent: number;
  dataJson: string;
  fieldLayoutJson: string | null;
  createdAt: string;
};

function mapRow(row: RawLayoutRow): SavedLayout {
  let widgets: SavedLayoutWidget[] = [];
  try {
    widgets = JSON.parse(row.dataJson);
  } catch {
    console.warn(`Saved layout ${row.id} has unparseable data_json.`);
  }
  let fieldLayout: FieldLayoutSnapshot | null = null;
  if (row.fieldLayoutJson) {
    try {
      fieldLayout = JSON.parse(row.fieldLayoutJson);
    } catch {
      console.warn(`Saved layout ${row.id} has unparseable field_layout_json.`);
    }
  }
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    includeContent: !!row.includeContent,
    widgets,
    fieldLayout,
    createdAt: row.createdAt,
  };
}

export async function fetchLayouts(): Promise<SavedLayout[]> {
  const db = await getDb();
  const rows = await db.select<RawLayoutRow[]>(
    `SELECT id, name, category, include_content as includeContent, data_json as dataJson,
            field_layout_json as fieldLayoutJson, created_at as createdAt
     FROM saved_layouts ORDER BY created_at DESC`
  );
  return rows.map(mapRow);
}

// Reads whatever's needed to recreate each widget's content later — see
// applyWidgetContent's matching switch.
export async function captureWidgetContent(w: ProjectWidget): Promise<unknown> {
  switch (w.widgetType) {
    case "journal":
      return await fetchJournalEntries(w.id);
    case "linkboard":
      return await fetchBoardItems(w.id);
    case "table":
      return await fetchTable(w.id);
    case "photo":
      return { settings: await fetchPhotoSettings(w.id), photos: await fetchPhotos(w.id) };
    case "dock":
      return await fetchDockImages(w.id);
    case "costlog":
      return await fetchCostEntries(w.id);
    case "calculator":
      return undefined;
    case "mastercostlog":
      // Its groupings/sources reference other widgets by id (see
      // db/costLog.ts's master_cost_log_sources) — those ids wouldn't
      // resolve to anything meaningful on a copied/loaded layout, so a
      // Master Cost Log always starts empty rather than carrying over
      // dangling references.
      return undefined;
  }
}

export async function saveLayout(
  name: string,
  category: string,
  includeContent: boolean,
  widgets: ProjectWidget[],
  // The owner whose field list (which fields are present, order, custom
  // labels, styling) should be captured alongside the widgets — omitted
  // by any caller that has no field-layout owner to snapshot (there are
  // none left, but keeps this additive/optional rather than a breaking
  // signature change for any caller found later).
  fieldOwner?: { category: FieldCategory; ownerId: number }
): Promise<number> {
  const db = await getDb();
  const data: SavedLayoutWidget[] = await Promise.all(
    widgets.map(async (w) => ({
      widgetType: w.widgetType,
      title: w.title,
      content: includeContent ? await captureWidgetContent(w) : undefined,
    }))
  );
  const fieldLayout = fieldOwner ? await snapshotFieldLayout(fieldOwner.category, fieldOwner.ownerId) : null;
  const result = await db.execute(
    "INSERT INTO saved_layouts (name, category, include_content, data_json, field_layout_json) VALUES ($1, $2, $3, $4, $5)",
    [name, category, includeContent ? 1 : 0, JSON.stringify(data), fieldLayout ? JSON.stringify(fieldLayout) : null]
  );
  return result.lastInsertId as number;
}

// Applies a saved layout's field snapshot (if it has one — older
// layouts saved before this existed don't) onto `ownerId`, replacing its
// current field list. No-op if the layout was saved without one. Widgets
// are applied separately by each page's own handleApplyLayout (see
// ProjectDetailPage.tsx/GoalDetailPage.tsx) since widget ownership
// (project_id vs goal_id) already varies per page.
export async function applyLayoutFieldLayout(
  layout: SavedLayout,
  category: FieldCategory,
  ownerId: number
): Promise<void> {
  if (!layout.fieldLayout) return;
  await applySavedFieldLayout(category, ownerId, layout.fieldLayout);
}

export async function deleteLayout(id: number): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM saved_layouts WHERE id = $1", [id]);
}

// Re-creates one saved widget's content on a freshly-created widget —
// the inverse of captureWidgetContent. No-op (an empty widget) if the
// layout was saved without content.
export async function applyWidgetContent(
  newWidgetId: number,
  widgetType: ProjectWidgetType,
  content: unknown
): Promise<void> {
  if (content === undefined) return;
  switch (widgetType) {
    case "journal":
      for (const e of content as { content: string }[]) await addJournalEntry(newWidgetId, e.content);
      break;
    case "linkboard":
      for (const it of content as ProjectBoardItem[]) {
        if (it.itemType === "text" && it.textContent) await addTextBoardItem(newWidgetId, it.textContent);
        else if (it.itemType === "link" && it.linkHref) await addLinkBoardItem(newWidgetId, it.linkHref, it.linkLabel ?? "");
        else if (it.itemType === "image" && it.imageData) await addImageBoardItem(newWidgetId, it.imageData);
      }
      break;
    case "table":
      await saveTable(newWidgetId, content as ProjectTableData);
      break;
    case "photo": {
      const { settings, photos } = content as { settings: PhotoWidgetSettings; photos: PhotoEntry[] };
      await savePhotoSettings(newWidgetId, settings);
      for (const p of photos) await addPhoto(newWidgetId, p.imageData, p.caption ?? null, p.latitude ?? null, p.longitude ?? null);
      break;
    }
    case "dock":
      for (const img of content as DockImage[]) await addDockImage(newWidgetId, img.imageData);
      break;
    case "costlog":
      for (const e of content as CostEntry[]) await addCostEntry(newWidgetId, e.amount, e.description);
      break;
    case "calculator":
      break;
    case "mastercostlog":
      break;
  }
}
