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
export function ImageDockWidget({ widgetId }: { widgetId: number }) {
  const [images, setImages] = useState<DockImage[]>([]);
  const [editing, setEditing] = useState(false);

  const load = () => {
    fetchDockImages(widgetId).then(setImages);
  };

  useEffect(load, [widgetId]);

  return (
    <>
      <button className="image-dock-preview" onClick={() => setEditing(true)} title="Click to edit">
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

      {editing && <ImageDockEditor widgetId={widgetId} images={images} onChange={load} onClose={() => setEditing(false)} />}
    </>
  );
}

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
    <>
      <div className="image-dock-backdrop" onClick={onClose} />
      <div className="image-dock-overlay">
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
          <button className="add-button" onClick={onClose}>
            Save
          </button>
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
    </>
  );
}
