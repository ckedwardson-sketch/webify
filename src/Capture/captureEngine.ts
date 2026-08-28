// Shared screenshot/PDF plumbing used by both the floating capture
// widget (ScreenCaptureWidget.tsx) and the Export to AI flow
// (ExportToAiModal.tsx) — one implementation so a fix here (or a future
// html2canvas swap) only has to happen once.
import html2canvas from "html2canvas-pro";
import jsPDF from "jspdf";
import { View } from "../types/nav";
import { CaptureTarget } from "./captureTargetList";

export interface Capture {
  dataUrl: string;
  width: number;
  height: number;
  label: string;
}

// The floating capture widget renders itself into document.body as a
// fixed-position overlay, so a naive document.body screenshot bakes the
// widget's own panel/button into every capture. Give it this id (see
// ScreenCaptureWidget.tsx) so captureViewport can hide it for the
// instant it takes the screenshot, regardless of which caller — the
// widget itself or the Export to AI flow — triggered the capture.
export const CAPTURE_WIDGET_HIDE_ID = "webify-screen-capture-widget";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Capture size/quality knobs. html2canvas defaults to
// window.devicePixelRatio for its internal render scale, which on a 2x
// (or 3x) display quadrupled (or 9x'd) the pixel count before a single
// byte of image encoding even happened — combined with lossless PNG
// output, a batch of a dozen-plus full-page captures ballooned into a
// PDF tens of megabytes in size. These bring it down to something an
// AI designer can actually receive as a file upload: capture at a flat
// 1x scale (still sharp enough to read UI text/colors), downscale
// anything wider than MAX_CAPTURE_WIDTH, and encode as JPEG rather than
// PNG (screenshots are mostly gradients/photos/shadows, where JPEG at
// this quality is 5-10x smaller than PNG with no visible difference for
// design-review purposes).
const CAPTURE_SCALE = 1;
const MAX_CAPTURE_WIDTH = 1600;
const JPEG_QUALITY = 0.72;

function downscaleCanvas(canvas: HTMLCanvasElement, maxWidth: number): HTMLCanvasElement {
  if (canvas.width <= maxWidth) return canvas;
  const scale = maxWidth / canvas.width;
  const out = document.createElement("canvas");
  out.width = maxWidth;
  out.height = Math.round(canvas.height * scale);
  const ctx = out.getContext("2d");
  if (!ctx) return canvas;
  ctx.drawImage(canvas, 0, 0, out.width, out.height);
  return out;
}

// html2canvas-pro (unlike plain html2canvas 1.x) understands modern CSS
// color functions like color-mix(), which every themed surface in this
// app uses for its background (see surfacePresets.ts's --surface-bg-
// opacity). A resolved solid background color (rather than
// backgroundColor: null) also keeps dark-mode captures readable — a
// transparent capture composited onto jsPDF's white page would make
// light-on-dark text nearly invisible.
export async function captureViewport(): Promise<{ dataUrl: string; width: number; height: number }> {
  const hideEl = document.getElementById(CAPTURE_WIDGET_HIDE_ID);
  const prevVisibility = hideEl?.style.visibility ?? "";
  if (hideEl) hideEl.style.visibility = "hidden";

  try {
    const resolvedBg = getComputedStyle(document.documentElement).getPropertyValue("--color-bg").trim();
    const rawCanvas = await html2canvas(document.body, {
      backgroundColor: resolvedBg || "#ffffff",
      scale: CAPTURE_SCALE,
    });
    const canvas = downscaleCanvas(rawCanvas, MAX_CAPTURE_WIDTH);
    return {
      dataUrl: canvas.toDataURL("image/jpeg", JPEG_QUALITY),
      width: canvas.width,
      height: canvas.height,
    };
  } finally {
    if (hideEl) hideEl.style.visibility = prevVisibility;
  }
}

export function capturesToPdfBlob(captures: Capture[]): Blob {
  if (captures.length === 0) throw new Error("No captures to build a PDF from.");
  const first = captures[0];
  const pdf = new jsPDF({
    orientation: first.width >= first.height ? "landscape" : "portrait",
    unit: "px",
    format: [first.width, first.height],
    compress: true,
  });

  captures.forEach((cap, i) => {
    if (i > 0) {
      pdf.addPage([cap.width, cap.height], cap.width >= cap.height ? "landscape" : "portrait");
    }
    pdf.addImage(cap.dataUrl, "JPEG", 0, 0, cap.width, cap.height);
  });

  return pdf.output("blob");
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Navigates through each target, waits for it to render, and captures
// it. Wrapped in try/finally (the original widget-only version wasn't)
// so a failure partway through — e.g. html2canvas choking on one
// unusual page — still restores navigation and reports progress as
// finished, instead of leaving the caller's "batch in progress" state
// stuck forever with no visible error.
export async function runCaptureBatch(opts: {
  targets: CaptureTarget[];
  currentView: View;
  onNavigate: (view: View) => void;
  onProgress?: (message: string, index: number, total: number) => void;
}): Promise<{ captures: Capture[]; errors: { label: string; message: string }[] }> {
  const { targets, currentView, onNavigate, onProgress } = opts;
  const captures: Capture[] = [];
  const errors: { label: string; message: string }[] = [];

  try {
    for (let i = 0; i < targets.length; i++) {
      const target = targets[i];
      onProgress?.(`Capturing ${i + 1} / ${targets.length}: ${target.label}`, i, targets.length);
      try {
        onNavigate(target.view);
        // Give React + the page's own data-loading effects time to
        // finish rendering before we capture. Not a guaranteed "ready"
        // signal, just a practical delay — SQLite reads are fast, so
        // this is generous for the current page set.
        await sleep(900);
        const shot = await captureViewport();
        captures.push({ ...shot, label: target.label });
      } catch (err) {
        console.error(`Capture failed for "${target.label}":`, err);
        errors.push({ label: target.label, message: err instanceof Error ? err.message : String(err) });
      }
    }
  } finally {
    onNavigate(currentView);
  }

  return { captures, errors };
}
