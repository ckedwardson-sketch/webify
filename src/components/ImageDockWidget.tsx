import { useEffect, useRef, useState } from "react";
import { DockImage } from "../types/project";
import {
  fetchDockImages,
  addDockImage,
  updateDockImageLayout,
  bringDockImageToFront,
  deleteDockImage,
} from "../db/dockImages";
import "./ImageDockWidget.css";

const MIN_SIZE = 8; // percent

type DragState =
  | { kind: "move"; id: number; startClientX: number; startClientY: number; startX: number; startY: number }
  | {
      kind: "resize";
      id: number;
      startClientX: number;
      startClientY: number;
      startWidth: number;
      startHeight: number;
    };

// A freeform photo collage widget — a "text box sized" rectangle you
// click to open a full editing overlay in, rather than a page you
// navigate to (see ProjectDetailPage.tsx's widget grid, which renders
// this directly inline instead of a nav-button card like Journal/Board/
// Table). Every image is stored as percent-of-box x/y/width/height, so
// the same layout holds up whether it's shown small (inline preview) or
// large (the overlay).
//
// `embedded` is for when this widget is already inside someone else's
// modal (see NodeWidgetOverlay.tsx) — in that case it must not spawn its
// own nested backdrop/overlay on click (that produced two independently-
// closable modals stacked on each other, which visibly flashed), so it
// renders the editor content directly in place instead.
//
// `onPreviewClick`, similarly, is for when this widget is rendered
// directly inside a React Flow node's content (a Web card's widget bay —
// see NodeCardFields.tsx) rather than at the page's own top level. A
// React Flow node's wrapper has a CSS `transform` on it (that's how
// React Flow positions nodes), which makes it the containing block for
// any `position: fixed` descendant — so this component's own
// ImageDockEditor overlay (fixed, sized off the *viewport*) would render
// clipped to that small transformed node instead of the screen, looking
// squashed and flickering as the canvas re-renders. Passing
// onPreviewClick routes the click out to the caller instead (which opens
// NodeWidgetOverlay — rendered at the page's own top level, outside the
// node tree, so its fixed positioning is unaffected) rather than opening
// this component's own internal overlay.
//
// `fitAspectRatio` sizes the preview to the aspect ratio of its one
// photo (when there's exactly one — the common case for a "big display"
// card) instead of a fixed CSS shape, so a wide/short or tall/narrow
// photo isn't stretched or cropped into a shape it was never meant for.
export function ImageDockWidget({
  widgetId,
  embedded = false,
  onPreviewClick,
  fitAspectRatio = false,
}: {
  widgetId: number;
  embedded?: boolean;
  onPreviewClick?: () => void;
  fitAspectRatio?: boolean;
}) {
  const [images, setImages] = useState<DockImage[]>([]);
  const [editing, setEditing] = useState(false);
  const [naturalRatio, setNaturalRatio] = useState<number | null>(null);

  const load = () => {
    fetchDockImages(widgetId).then(setImages);
  };

  useEffect(load, [widgetId]);

  useEffect(() => {
    if (!fitAspectRatio || images.length !== 1) {
      setNaturalRatio(null);
      return;
    }
    let cancelled = false;
    const img = new Image();
    img.onload = () => {
      if (!cancelled && img.naturalHeight > 0) setNaturalRatio(img.naturalWidth / img.naturalHeight);
    };
    img.src = images[0].imageData;
    return () => {
      cancelled = true;
    };
  }, [fitAspectRatio, images]);

  if (embedded) {
    return <ImageDockEditorContent widgetId={widgetId} images={images} onChange={load} />;
  }

  return (
    <>
      <button
        className="image-dock-preview"
        style={naturalRatio ? { aspectRatio: String(naturalRatio), height: "auto" } : undefined}
        onClick={() => (onPreviewClick ? onPreviewClick() : setEditing(true))}
        title="Click to edit"
      >
        {images.length === 0 ? (
          <span className="image-dock-empty">Image Dock — click to add photos</span>
        ) : (
          images.map((img) => (
            <img
              key={img.id}
              src={img.imageData}
              alt=""
              style={{
                position: "absolute",
                left: `${img.x}%`,
                top: `${img.y}%`,
                width: `${img.width}%`,
                height: `${img.height}%`,
                zIndex: img.zIndex,
                objectFit: "cover",
                borderRadius: 4,
                boxShadow: "0 1px 4px rgba(0,0,0,0.4)",
                pointerEvents: "none",
              }}
            />
          ))
        )}
      </button>

      {!onPreviewClick && editing && (
        <ImageDockEditor widgetId={widgetId} images={images} onChange={load} onClose={() => setEditing(false)} />
      )}
    </>
  );
}

// Shared drag/resize/add/delete logic and markup for the editor — used
// both standalone (wrapped in its own backdrop+overlay by
// ImageDockEditor below) and embedded directly inside a parent overlay
// (see ImageDockWidget's `embedded` prop) with no extra chrome of its
// own beyond the toolbar and the photo box.
function ImageDockEditorContent({
  widgetId,
  images,
  onChange,
  onClose,
}: {
  widgetId: number;
  images: DockImage[];
  onChange: () => void;
  // Only standalone mode passes this — shows a "Save" button that closes
  // the editor. Embedded mode omits it: the parent overlay's own close
  // button (see NodeWidgetOverlay.tsx) is the only way to close there.
  onClose?: () => void;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [live, setLive] = useState<Record<number, { x: number; y: number; width: number; height: number }>>({});
  const [overTrash, setOverTrash] = useState(false);

  const valueFor = (img: DockImage) => live[img.id] ?? { x: img.x, y: img.y, width: img.width, height: img.height };

  useEffect(() => {
    const handleMove = (e: MouseEvent) => {
      if (!drag || !boxRef.current) return;
      const rect = boxRef.current.getBoundingClientRect();
      const dxPct = ((e.clientX - drag.startClientX) / rect.width) * 100;
      const dyPct = ((e.clientY - drag.startClientY) / rect.height) * 100;

      if (drag.kind === "move") {
        const img = images.find((i) => i.id === drag.id)!;
        const { width: w, height: h } = valueFor(img);
        const x = Math.min(100 - w, Math.max(0, drag.startX + dxPct));
        const y = Math.min(100 - h, Math.max(0, drag.startY + dyPct));
        setLive((prev) => ({ ...prev, [drag.id]: { x, y, width: w, height: h } }));

        // Trash hit-test: is the pointer over the trash icon right now?
        const trashEl = document.getElementById(`image-dock-trash-${widgetId}`);
        if (trashEl) {
          const t = trashEl.getBoundingClientRect();
          const inside = e.clientX >= t.left && e.clientX <= t.right && e.clientY >= t.top && e.clientY <= t.bottom;
          setOverTrash(inside);
        }
      } else {
        const img = images.find((i) => i.id === drag.id)!;
        const cur = valueFor(img);
        const width = Math.max(MIN_SIZE, Math.min(100 - cur.x, drag.startWidth + dxPct));
        const height = Math.max(MIN_SIZE, Math.min(100 - cur.y, drag.startHeight + dyPct));
        setLive((prev) => ({ ...prev, [drag.id]: { ...cur, width, height } }));
      }
    };

    const handleUp = async () => {
      if (!drag) return;
      const finalVal = live[drag.id];
      if (drag.kind === "move" && overTrash) {
        await deleteDockImage(drag.id);
        setLive((prev) => {
          const next = { ...prev };
          delete next[drag.id];
          return next;
        });
        setOverTrash(false);
        setDrag(null);
        onChange();
        return;
      }
      if (finalVal) {
        await updateDockImageLayout(drag.id, finalVal.x, finalVal.y, finalVal.width, finalVal.height);
      }
      setDrag(null);
      onChange();
    };

    if (drag) {
      window.addEventListener("mousemove", handleMove);
      window.addEventListener("mouseup", handleUp);
    }
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drag, live, overTrash, images]);

  const startMove = (img: DockImage, e: React.MouseEvent) => {
    e.preventDefault();
    bringDockImageToFront(img.id, widgetId).then(onChange);
    setDrag({ kind: "move", id: img.id, startClientX: e.clientX, startClientY: e.clientY, startX: img.x, startY: img.y });
  };

  const startResize = (img: DockImage, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDrag({
      kind: "resize",
      id: img.id,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startWidth: img.width,
      startHeight: img.height,
    });
  };

  const handleAddImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      await addDockImage(widgetId, reader.result as string);
      onChange();
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  return (
    <div className="image-dock-editor-content">
      <div className="image-dock-toolbar">
        <button className="add-button secondary" onClick={() => fileInputRef.current?.click()}>
          + Add image
        </button>
        <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleAddImage} />
        <div
          id={`image-dock-trash-${widgetId}`}
          className={`image-dock-trash${overTrash ? " image-dock-trash-active" : ""}`}
          title="Drag an image here to remove it"
        >
          🗑
        </div>
        {onClose && (
          <button className="add-button" onClick={onClose}>
            Save
          </button>
        )}
      </div>

      <div className="image-dock-box" ref={boxRef}>
        {images.length === 0 && <span className="image-dock-empty">No photos yet — add one above.</span>}
        {images.map((img) => {
          const v = valueFor(img);
          return (
            <div
              key={img.id}
              className="image-dock-item"
              style={{
                left: `${v.x}%`,
                top: `${v.y}%`,
                width: `${v.width}%`,
                height: `${v.height}%`,
                zIndex: img.zIndex,
                opacity: drag?.id === img.id && drag.kind === "move" && overTrash ? 0.35 : 1,
              }}
              onMouseDown={(e) => startMove(img, e)}
            >
              <img src={img.imageData} alt="" draggable={false} />
              <div className="image-dock-resize-handle" onMouseDown={(e) => startResize(img, e)} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Standalone (non-embedded) wrapper — adds the backdrop + full-screen
// overlay chrome and a Save/close button around ImageDockEditorContent.
// Only used when ImageDockWidget is NOT already inside another modal.
function ImageDockEditor({
  widgetId,
  images,
  onChange,
  onClose,
}: {
  widgetId: number;
  images: DockImage[];
  onChange: () => void;
  onClose: () => void;
}) {
  return (
    <>
      <div className="image-dock-backdrop" onClick={onClose} />
      <div className="image-dock-overlay">
        <ImageDockEditorContent widgetId={widgetId} images={images} onChange={onChange} onClose={onClose} />
      </div>
    </>
  );
}
