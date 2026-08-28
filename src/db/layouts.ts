import { getDb } from "./database";
import { ProjectWidgetType, ProjectWidget, ProjectBoardItem, PhotoWidgetSettings, PhotoEntry, DockImage, ProjectTableData } from "../types/project";
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
  createdAt: string;
}

type RawLayoutRow = {
  id: number;
  name: string;
  category: string;
  includeContent: number;
  dataJson: string;
  createdAt: string;
};

function mapRow(row: RawLayoutRow): SavedLayout {
  let widgets: SavedLayoutWidget[] = [];
  try {
    widgets = JSON.parse(row.dataJson);
  } catch {
    console.warn(`Saved layout ${row.id} has unparseable data_json.`);
  }
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    includeContent: !!row.includeContent,
    widgets,
    createdAt: row.createdAt,
  };
}

export async function fetchLayouts(): Promise<SavedLayout[]> {
  const db = await getDb();
  const rows = await db.select<RawLayoutRow[]>(
    `SELECT id, name, category, include_content as includeContent, data_json as dataJson, created_at as createdAt
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
  }
}

export async function saveLayout(
  name: string,
  category: string,
  includeContent: boolean,
  widgets: ProjectWidget[]
): Promise<number> {
  const db = await getDb();
  const data: SavedLayoutWidget[] = await Promise.all(
    widgets.map(async (w) => ({
      widgetType: w.widgetType,
      title: w.title,
      content: includeContent ? await captureWidgetContent(w) : undefined,
    }))
  );
  const result = await db.execute(
    "INSERT INTO saved_layouts (name, category, include_content, data_json) VALUES ($1, $2, $3, $4)",
    [name, category, includeContent ? 1 : 0, JSON.stringify(data)]
  );
  return result.lastInsertId as number;
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
  }
}
