import { getDb } from "./database";
import { PhotoEntry, PhotoWidgetSettings } from "../types/project";

const DEFAULT_SETTINGS: PhotoWidgetSettings = {
  displayMode: "carddeck",
  slideshowIntervalSeconds: 5,
  carddeckIntervalSeconds: 0,
  orientation: "landscape",
  preferredCamera: "rear",
  askForCaption: false,
  captureLocation: false,
};

type RawSettingsRow = {
  displayMode: PhotoWidgetSettings["displayMode"];
  slideshowIntervalSeconds: number;
  carddeckIntervalSeconds: number;
  orientation: PhotoWidgetSettings["orientation"];
  preferredCamera: PhotoWidgetSettings["preferredCamera"];
  askForCaption: number;
  captureLocation: number;
};

export async function fetchPhotoSettings(widgetId: number): Promise<PhotoWidgetSettings> {
  const db = await getDb();
  const rows = await db.select<RawSettingsRow[]>(
    `SELECT display_mode as displayMode, slideshow_interval_seconds as slideshowIntervalSeconds,
            carddeck_interval_seconds as carddeckIntervalSeconds, orientation,
            preferred_camera as preferredCamera,
            ask_for_caption as askForCaption, capture_location as captureLocation
     FROM photo_widget_settings WHERE widget_id = $1`,
    [widgetId]
  );
  if (rows.length === 0) return DEFAULT_SETTINGS;
  const r = rows[0];
  return {
    displayMode: r.displayMode,
    slideshowIntervalSeconds: r.slideshowIntervalSeconds,
    carddeckIntervalSeconds: r.carddeckIntervalSeconds,
    orientation: r.orientation,
    preferredCamera: r.preferredCamera ?? "rear",
    askForCaption: !!r.askForCaption,
    captureLocation: !!r.captureLocation,
  };
}

export async function savePhotoSettings(widgetId: number, settings: PhotoWidgetSettings): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT INTO photo_widget_settings
       (widget_id, display_mode, slideshow_interval_seconds, carddeck_interval_seconds, orientation, preferred_camera, ask_for_caption, capture_location)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT(widget_id) DO UPDATE SET
       display_mode = excluded.display_mode,
       slideshow_interval_seconds = excluded.slideshow_interval_seconds,
       carddeck_interval_seconds = excluded.carddeck_interval_seconds,
       orientation = excluded.orientation,
       preferred_camera = excluded.preferred_camera,
       ask_for_caption = excluded.ask_for_caption,
       capture_location = excluded.capture_location`,
    [
      widgetId,
      settings.displayMode,
      settings.slideshowIntervalSeconds,
      settings.carddeckIntervalSeconds,
      settings.orientation,
      settings.preferredCamera,
      settings.askForCaption ? 1 : 0,
      settings.captureLocation ? 1 : 0,
    ]
  );
}

export async function fetchPhotos(widgetId: number): Promise<PhotoEntry[]> {
  const db = await getDb();
  return db.select<PhotoEntry[]>(
    `SELECT id, widget_id as widgetId, image_data as imageData, caption,
            latitude, longitude, taken_at as takenAt, sort_order as sortOrder
     FROM photo_entries WHERE widget_id = $1 ORDER BY sort_order, id`,
    [widgetId]
  );
}

export async function addPhoto(
  widgetId: number,
  imageData: string,
  caption: string | null,
  latitude: number | null,
  longitude: number | null
): Promise<number> {
  const db = await getDb();
  const existing = await db.select<{ maxOrder: number | null }[]>(
    "SELECT MAX(sort_order) as maxOrder FROM photo_entries WHERE widget_id = $1",
    [widgetId]
  );
  const nextOrder = (existing[0].maxOrder ?? -1) + 1;
  const result = await db.execute(
    `INSERT INTO photo_entries (widget_id, image_data, caption, latitude, longitude, sort_order)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [widgetId, imageData, caption, latitude, longitude, nextOrder]
  );
  return result.lastInsertId as number;
}

export async function deletePhoto(id: number): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM photo_entries WHERE id = $1", [id]);
}
