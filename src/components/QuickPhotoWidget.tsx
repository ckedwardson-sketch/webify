import { useEffect, useRef, useState } from "react";
import jsPDF from "jspdf";
import { PhotoEntry, PhotoWidgetSettings, PhotoDisplayMode, PhotoOrientation } from "../types/project";
import { fetchPhotoSettings, savePhotoSettings, fetchPhotos, addPhoto, deletePhoto } from "../db/photos";
import { downloadBlob } from "../capture/captureEngine";
import { Icon } from "../icons/Icon";
import "./QuickPhotoWidget.css";

const CARD_DECK_VISIBLE = 8;
const JPEG_QUALITY = 0.85;

function formatPhotoDate(iso: string): string {
  const d = new Date(iso.replace(" ", "T") + "Z");
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function loadImageDims(dataUrl: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = reject;
    img.src = dataUrl;
  });
}

// One page per photo, image scaled to fit, date/caption/location below
// it — the "export album" button in settings.
async function exportAlbumPdf(photos: PhotoEntry[]): Promise<Blob> {
  const pdf = new jsPDF({ unit: "pt", format: "a4", compress: true });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 40;

  for (let i = 0; i < photos.length; i++) {
    const photo = photos[i];
    if (i > 0) pdf.addPage();
    const dims = await loadImageDims(photo.imageData);
    const maxW = pageWidth - margin * 2;
    const maxH = pageHeight - margin * 2 - 70;
    const scale = Math.min(maxW / dims.width, maxH / dims.height);
    const w = dims.width * scale;
    const h = dims.height * scale;
    const x = (pageWidth - w) / 2;
    pdf.addImage(photo.imageData, "JPEG", x, margin, w, h);

    let textY = margin + h + 22;
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(11);
    pdf.text(formatPhotoDate(photo.takenAt), margin, textY);
    textY += 16;
    if (photo.caption) {
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(10);
      pdf.text(photo.caption, margin, textY, { maxWidth: maxW });
      textY += 16;
    }
    if (photo.latitude != null && photo.longitude != null) {
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(9);
      pdf.text(`${photo.latitude.toFixed(5)}, ${photo.longitude.toFixed(5)}`, margin, textY);
    }
  }

  return pdf.output("blob");
}

// Grabs one frame from a momentarily-opened camera stream — used by
// slideshow/carddeck modes, which don't keep a live feed open, only
// camera-view mode does (see CameraStage below).
async function captureOneFrame(preferredCamera: "front" | "rear" = "rear"): Promise<string> {
  const facingMode = preferredCamera === "front" ? "user" : "environment";
  const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode } });
  try {
    const video = document.createElement("video");
    video.srcObject = stream;
    await video.play();
    await new Promise((r) => setTimeout(r, 200)); // let the sensor settle/focus a beat
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(video, 0, 0);
    return canvas.toDataURL("image/jpeg", JPEG_QUALITY);
  } finally {
    stream.getTracks().forEach((t) => t.stop());
  }
}

export function QuickPhotoWidget({ widgetId }: { widgetId: number }) {
  const [photos, setPhotos] = useState<PhotoEntry[]>([]);
  const [settings, setSettings] = useState<PhotoWidgetSettings | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [capturing, setCapturing] = useState(false);
  const [captureError, setCaptureError] = useState<string | null>(null);
  const [pendingCapture, setPendingCapture] = useState<string | null>(null);
  const [captionDraft, setCaptionDraft] = useState("");

  const load = () => {
    Promise.all([fetchPhotoSettings(widgetId), fetchPhotos(widgetId)]).then(([s, p]) => {
      setSettings(s);
      setPhotos(p);
    });
  };

  useEffect(load, [widgetId]);

  // Slideshow auto-advance.
  useEffect(() => {
    if (!settings || settings.displayMode !== "slideshow" || settings.slideshowIntervalSeconds <= 0) return;
    const id = setInterval(() => {
      setActiveIndex((i) => (photos.length === 0 ? 0 : (i + 1) % photos.length));
    }, settings.slideshowIntervalSeconds * 1000);
    return () => clearInterval(id);
  }, [settings, photos.length]);

  // Card deck auto-rotate.
  useEffect(() => {
    if (!settings || settings.displayMode !== "carddeck" || settings.carddeckIntervalSeconds <= 0) return;
    const id = setInterval(() => {
      setActiveIndex((i) => (photos.length === 0 ? 0 : (i + 1) % photos.length));
    }, settings.carddeckIntervalSeconds * 1000);
    return () => clearInterval(id);
  }, [settings, photos.length]);

  const finishCapture = async (dataUrl: string) => {
    if (!settings) return;
    if (settings.askForCaption) {
      setPendingCapture(dataUrl);
      setCaptionDraft("");
      return;
    }
    await saveCapturedPhoto(dataUrl, null);
  };

  const saveCapturedPhoto = async (dataUrl: string, caption: string | null) => {
    let lat: number | null = null;
    let lon: number | null = null;
    if (settings?.captureLocation && "geolocation" in navigator) {
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 4000 })
        );
        lat = pos.coords.latitude;
        lon = pos.coords.longitude;
      } catch {
        // Location unavailable/denied — save without it rather than blocking the capture.
      }
    }
    await addPhoto(widgetId, dataUrl, caption, lat, lon);
    setPendingCapture(null);
    load();
  };

  const handleQuickCapture = async () => {
    if (!settings || capturing) return;
    setCapturing(true);
    setCaptureError(null);
    try {
      const dataUrl = await captureOneFrame(settings.preferredCamera);
      await finishCapture(dataUrl);
    } catch (err) {
      setCaptureError(err instanceof Error ? err.message : "Couldn't reach the camera.");
    } finally {
      setCapturing(false);
    }
  };

  const handleSaveSettings = async (next: PhotoWidgetSettings) => {
    setSettings(next);
    await savePhotoSettings(widgetId, next);
  };

  const handleExportAlbum = async () => {
    if (photos.length === 0) return;
    const blob = await exportAlbumPdf(photos);
    downloadBlob(blob, `photo-album-${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  const handleDeletePhoto = async (id: number) => {
    await deletePhoto(id);
    setActiveIndex((i) => Math.max(0, i - 1));
    load();
  };

  if (!settings) return null;

  return (
    <div className="quick-photo-widget" style={{ aspectRatio: settings.orientation === "portrait" ? "3 / 4" : "4 / 3" }}>
      <div className="quick-photo-menu-wrapper">
        <button className="quick-photo-menu-button" onClick={() => setShowMenu((v) => !v)} title="Quick Photo settings">
          <Icon iconKey="menu-more" size={16} />
        </button>
        {showMenu && (
          <>
            <div className="menu-backdrop" onClick={() => setShowMenu(false)} />
            <div className="managed-row-dropdown" style={{ top: "100%", right: 0 }}>
              <button
                className="dropdown-item"
                onClick={() => {
                  setShowMenu(false);
                  setShowSettings(true);
                }}
              >
                Settings
              </button>
              <button
                className="dropdown-item"
                onClick={() => {
                  setShowMenu(false);
                  handleExportAlbum();
                }}
              >
                Export album (PDF)
              </button>
            </div>
          </>
        )}
      </div>

      {settings.displayMode === "camera" && (
        <CameraStage
          onCapture={finishCapture}
          settingsOrientation={settings.orientation}
          preferredCamera={settings.preferredCamera}
        />
      )}

      {settings.displayMode === "slideshow" && (
        <SlideshowStage
          photos={photos}
          activeIndex={activeIndex}
          setActiveIndex={setActiveIndex}
          onCapture={handleQuickCapture}
          onDelete={handleDeletePhoto}
          capturing={capturing}
        />
      )}

      {settings.displayMode === "carddeck" && (
        <CardDeckStage
          photos={photos}
          activeIndex={activeIndex}
          setActiveIndex={setActiveIndex}
          onCapture={handleQuickCapture}
          onDelete={handleDeletePhoto}
          capturing={capturing}
        />
      )}

      {captureError && <div className="quick-photo-error">{captureError}</div>}

      {pendingCapture && (
        <CaptionPrompt
          dataUrl={pendingCapture}
          caption={captionDraft}
          onCaptionChange={setCaptionDraft}
          onCancel={() => setPendingCapture(null)}
          onSave={() => saveCapturedPhoto(pendingCapture, captionDraft.trim() || null)}
        />
      )}

      {showSettings && (
        <PhotoSettingsPanel settings={settings} onSave={handleSaveSettings} onClose={() => setShowSettings(false)} />
      )}
    </div>
  );
}

// ---- Camera view — a real live feed, click anywhere to capture -------

function CameraStage({
  onCapture,
  settingsOrientation,
  preferredCamera,
}: {
  onCapture: (dataUrl: string) => void;
  settingsOrientation: PhotoOrientation;
  preferredCamera: "front" | "rear";
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<"user" | "environment">(
    preferredCamera === "front" ? "user" : "environment"
  );
  // On-the-fly orientation toggle, independent of the settings-panel
  // orientation (which only governs slideshow/carddeck) — camera view
  // needs to flip live while framing a shot.
  const [liveOrientation, setLiveOrientation] = useState<PhotoOrientation>(settingsOrientation);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let cancelled = false;
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode } })
      .then((s) => {
        if (cancelled) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        stream = s;
        if (videoRef.current) videoRef.current.srcObject = s;
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Camera unavailable — check app permissions."));
    return () => {
      cancelled = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [facingMode]);

  const handleClick = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")!.drawImage(video, 0, 0);
    onCapture(canvas.toDataURL("image/jpeg", JPEG_QUALITY));
  };

  return (
    <div className={`quick-photo-stage quick-photo-camera quick-photo-orientation-${liveOrientation}`} onClick={handleClick}>
      {error ? (
        <div className="quick-photo-error">{error}</div>
      ) : (
        <video ref={videoRef} autoPlay playsInline muted className="quick-photo-camera-video" />
      )}
      <div className="quick-photo-camera-controls" onClick={(e) => e.stopPropagation()}>
        <button
          className="quick-photo-icon-btn"
          title="Flip camera"
          onClick={() => setFacingMode((m) => (m === "user" ? "environment" : "user"))}
        >
          🔄
        </button>
        <button
          className="quick-photo-icon-btn"
          title="Rotate orientation"
          onClick={() => setLiveOrientation((o) => (o === "portrait" ? "landscape" : "portrait"))}
        >
          ⤾
        </button>
      </div>
    </div>
  );
}

// ---- Slideshow — one photo at a time, auto-advances -------------------

function SlideshowStage({
  photos,
  activeIndex,
  setActiveIndex,
  onCapture,
  onDelete,
  capturing,
}: {
  photos: PhotoEntry[];
  activeIndex: number;
  setActiveIndex: (i: number) => void;
  onCapture: () => void;
  onDelete: (id: number) => void;
  capturing: boolean;
}) {
  const current = photos[activeIndex % Math.max(1, photos.length)];

  // Direction is worked out from whatever actually changed activeIndex
  // — the prev/next buttons here, the parent's auto-advance interval,
  // or a dot click — rather than only the two local buttons, so the
  // slide direction is correct regardless of what triggered it. Wraps
  // (last -> first, first -> last) still read as "next"/"prev".
  const prevIndexRef = useRef(activeIndex);
  const direction =
    activeIndex === prevIndexRef.current
      ? "next"
      : activeIndex > prevIndexRef.current || (prevIndexRef.current === photos.length - 1 && activeIndex === 0)
      ? "next"
      : "prev";
  useEffect(() => {
    prevIndexRef.current = activeIndex;
  }, [activeIndex]);

  return (
    <div className="quick-photo-stage quick-photo-slideshow" onClick={onCapture}>
      {photos.length === 0 ? (
        <span className="quick-photo-empty">{capturing ? "Capturing…" : "Click to take the first photo"}</span>
      ) : (
        <>
          {/* key={current.id} remounts the img on every photo change,
              which restarts the CSS slide-in animation (see
              .quick-photo-slide-in-next/prev keyframes) — simpler and
              more robust than manually animating two overlapping
              images in and out. */}
          <img
            key={current.id}
            src={current.imageData}
            alt=""
            className={`quick-photo-slideshow-img quick-photo-slide-in-${direction}`}
          />
          <div className="quick-photo-slideshow-caption">
            {formatPhotoDate(current.takenAt)}
            {current.caption ? ` — ${current.caption}` : ""}
          </div>
          <div className="quick-photo-slideshow-dots" onClick={(e) => e.stopPropagation()}>
            {photos.map((p, i) => (
              <button
                key={p.id}
                className={`quick-photo-dot${i === activeIndex % photos.length ? " quick-photo-dot-active" : ""}`}
                onClick={() => setActiveIndex(i)}
                title={formatPhotoDate(p.takenAt)}
              />
            ))}
          </div>
          <div className="quick-photo-stage-controls" onClick={(e) => e.stopPropagation()}>
            <button
              className="quick-photo-icon-btn"
              onClick={() => setActiveIndex((activeIndex - 1 + photos.length) % photos.length)}
            >
              ‹
            </button>
            <button className="quick-photo-icon-btn" onClick={() => onDelete(current.id)}>
              🗑
            </button>
            <button className="quick-photo-icon-btn" onClick={() => setActiveIndex((activeIndex + 1) % photos.length)}>
              ›
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ---- Card deck — up to 8 fanned/overlapping cards ----------------------

function CardDeckStage({
  photos,
  activeIndex,
  setActiveIndex,
  onCapture,
  onDelete,
  capturing,
}: {
  photos: PhotoEntry[];
  activeIndex: number;
  setActiveIndex: (i: number) => void;
  onCapture: () => void;
  onDelete: (id: number) => void;
  capturing: boolean;
}) {
  if (photos.length === 0) {
    return (
      <div className="quick-photo-stage quick-photo-carddeck" onClick={onCapture}>
        <span className="quick-photo-empty">{capturing ? "Capturing…" : "Click to take the first photo"}</span>
      </div>
    );
  }

  const front = activeIndex % photos.length;
  // Ordered so the active card is last (drawn on top); the rest are the
  // next CARD_DECK_VISIBLE-1 cards behind it in the deck, each nudged a
  // little further back — anything past the visible count is fully
  // hidden behind the bottom bar (per spec).
  const visible = Array.from({ length: Math.min(CARD_DECK_VISIBLE, photos.length) }, (_, i) => (front + i) % photos.length)
    .reverse();

  return (
    <div className="quick-photo-stage quick-photo-carddeck">
      <div className="quick-photo-deck">
        {visible.map((idx, depthFromFront) => {
          const depth = visible.length - 1 - depthFromFront; // 0 = front card
          const photo = photos[idx];
          const isFront = depth === 0;
          // Every card shares the same pivot point, well below the
          // visible stage (transform-origin below the card, in CSS) —
          // rotating each one around that single distant point is what
          // actually traces a circular arc (like cards fanned from a
          // hinge below the deck) instead of the old hand-tuned
          // translate/rotate combo, which just made a diagonal pile.
          // key={photo.id} staying stable while `depth` changes as
          // activeIndex moves is what lets the transform transition
          // (see .quick-photo-card's CSS) animate smoothly instead of
          // jumping.
          return (
            <div
              key={photo.id}
              className={`quick-photo-card${isFront ? " quick-photo-card-front" : ""}`}
              style={{
                transform: `rotate(${depth * 7}deg) scale(${1 - depth * 0.035})`,
                zIndex: 100 - depth,
                opacity: depth === visible.length - 1 && visible.length === CARD_DECK_VISIBLE ? 0.6 : 1,
              }}
              onClick={(e) => {
                e.stopPropagation();
                if (isFront) onCapture();
                else setActiveIndex(idx);
              }}
            >
              <img src={photo.imageData} alt="" draggable={false} />
              {isFront && (
                <div className="quick-photo-stage-controls" onClick={(e) => e.stopPropagation()}>
                  <span className="quick-photo-card-caption">{formatPhotoDate(photo.takenAt)}</span>
                  <button className="quick-photo-icon-btn" onClick={() => onDelete(photo.id)}>
                    🗑
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="quick-photo-deck-bar" />
    </div>
  );
}

// ---- Optional caption prompt after a capture ---------------------------

function CaptionPrompt({
  dataUrl,
  caption,
  onCaptionChange,
  onCancel,
  onSave,
}: {
  dataUrl: string;
  caption: string;
  onCaptionChange: (v: string) => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  return (
    <>
      <div className="menu-backdrop" onClick={onCancel} />
      <div className="quick-photo-caption-prompt">
        <button className="quick-photo-dialog-close" onClick={onCancel} title="Close">
          ✕
        </button>
        <img src={dataUrl} alt="" className="quick-photo-caption-preview" />
        <textarea
          className="instructions-textarea"
          rows={2}
          autoFocus
          placeholder="Add a note (optional)…"
          value={caption}
          onChange={(e) => onCaptionChange(e.target.value)}
        />
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button className="add-button secondary" onClick={onCancel}>
            Discard
          </button>
          <button className="add-button" onClick={onSave}>
            Save
          </button>
        </div>
      </div>
    </>
  );
}

// ---- Settings panel ------------------------------------------------------

function PhotoSettingsPanel({
  settings,
  onSave,
  onClose,
}: {
  settings: PhotoWidgetSettings;
  onSave: (s: PhotoWidgetSettings) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(settings);

  const commit = (next: PhotoWidgetSettings) => {
    setDraft(next);
    onSave(next);
  };

  return (
    <>
      <div className="menu-backdrop" onClick={onClose} />
      <div className="quick-photo-settings-panel">
        <button className="quick-photo-dialog-close" onClick={onClose} title="Close">
          ✕
        </button>
        <h3 style={{ marginTop: 0 }}>Quick Photo Settings</h3>

        <label className="project-field-label">
          Display mode
          <select
            className="inline-add-input"
            value={draft.displayMode}
            onChange={(e) => commit({ ...draft, displayMode: e.target.value as PhotoDisplayMode })}
          >
            <option value="camera">Camera view (live)</option>
            <option value="slideshow">Slideshow</option>
            <option value="carddeck">Card deck</option>
          </select>
        </label>

        {draft.displayMode !== "camera" && (
          <label className="project-field-label">
            Camera (used when tapping to capture — camera view has its own live flip button instead)
            <select
              className="inline-add-input"
              value={draft.preferredCamera}
              onChange={(e) => commit({ ...draft, preferredCamera: e.target.value as "front" | "rear" })}
            >
              <option value="rear">Rear</option>
              <option value="front">Front</option>
            </select>
          </label>
        )}

        {draft.displayMode === "slideshow" && (
          <label className="project-field-label">
            Slideshow interval (seconds, 0 = manual only)
            <input
              type="number"
              min={0}
              className="resp-lead-time-input"
              value={draft.slideshowIntervalSeconds}
              onChange={(e) => commit({ ...draft, slideshowIntervalSeconds: Math.max(0, Number(e.target.value) || 0) })}
            />
          </label>
        )}

        {draft.displayMode === "carddeck" && (
          <label className="project-field-label">
            Card deck auto-rotate interval (seconds, 0 = click to rotate only)
            <input
              type="number"
              min={0}
              className="resp-lead-time-input"
              value={draft.carddeckIntervalSeconds}
              onChange={(e) => commit({ ...draft, carddeckIntervalSeconds: Math.max(0, Number(e.target.value) || 0) })}
            />
          </label>
        )}

        {draft.displayMode !== "camera" && (
          <label className="project-field-label">
            Orientation
            <select
              className="inline-add-input"
              value={draft.orientation}
              onChange={(e) => commit({ ...draft, orientation: e.target.value as PhotoOrientation })}
            >
              <option value="landscape">Landscape</option>
              <option value="portrait">Portrait</option>
            </select>
          </label>
        )}

        <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
          <input
            type="checkbox"
            checked={draft.askForCaption}
            onChange={(e) => commit({ ...draft, askForCaption: e.target.checked })}
          />
          Ask for a note before saving each photo
        </label>

        <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
          <input
            type="checkbox"
            checked={draft.captureLocation}
            onChange={(e) => commit({ ...draft, captureLocation: e.target.checked })}
          />
          Save location with each photo (if available)
        </label>

        <button className="add-button" style={{ marginTop: 14 }} onClick={onClose}>
          Done
        </button>
      </div>
    </>
  );
}
