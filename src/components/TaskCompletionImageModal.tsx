import { useRef, useState } from "react";
import "./ManagedListRow.css"; // .menu-backdrop
import "./NodeWidgetOverlay.css";
import "./TaskCompletionImageModal.css";

const JPEG_QUALITY = 0.85;

// Grabs a single frame from a momentarily-opened camera, same one-shot
// approach as QuickPhotoWidget.tsx's captureOneFrame (not exported from
// there, so kept small and local rather than reaching across files for
// one helper).
async function captureOneFrame(): Promise<string> {
  const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
  try {
    const video = document.createElement("video");
    video.srcObject = stream;
    await video.play();
    await new Promise((r) => setTimeout(r, 200));
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")!.drawImage(video, 0, 0);
    return canvas.toDataURL("image/jpeg", JPEG_QUALITY);
  } finally {
    stream.getTracks().forEach((t) => t.stop());
  }
}

// Shown right after a hold-to-complete fires. Clicking the backdrop
// (anywhere but the two buttons) skips the image and still completes
// the task — this is a nicety, not a required step.
export function TaskCompletionImageModal({
  onDone,
  onSkip,
}: {
  onDone: (imageDataUrl: string) => void;
  onSkip: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [capturing, setCapturing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => onDone(reader.result as string);
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleCamera = async () => {
    setError(null);
    setCapturing(true);
    try {
      const dataUrl = await captureOneFrame();
      onDone(dataUrl);
    } catch {
      setError("Couldn't access the camera.");
    } finally {
      setCapturing(false);
    }
  };

  return (
    <>
      <div className="menu-backdrop" onClick={onSkip} />
      <div className="node-widget-overlay task-completion-image-modal" onClick={(e) => e.stopPropagation()}>
        <div className="node-widget-overlay-header">
          <span className="node-widget-overlay-title">Task complete — add a photo?</span>
        </div>
        <p className="page-text">Click anywhere outside this box to skip.</p>
        <div className="task-completion-image-actions">
          <button type="button" className="add-button secondary" onClick={() => fileInputRef.current?.click()}>
            Choose file
          </button>
          <button type="button" className="add-button secondary" onClick={handleCamera} disabled={capturing}>
            {capturing ? "Opening camera…" : "Use camera"}
          </button>
        </div>
        {error && <p className="page-text task-completion-image-error">{error}</p>}
        <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleFile} />
      </div>
    </>
  );
}
