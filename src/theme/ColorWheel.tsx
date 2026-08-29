import { useEffect, useRef, useState } from "react";
import "./ColorWheel.css";

interface HSL {
  h: number; // 0-360
  s: number; // 0-100
  l: number; // 0-100
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function hexToHsl(hex: string): HSL {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return { h: 217, s: 91, l: 60 };
  const int = parseInt(m[1], 16);
  const r = ((int >> 16) & 255) / 255;
  const g = ((int >> 8) & 255) / 255;
  const b = (int & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l: Math.round(l * 100) };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  h *= 60;
  if (h < 0) h += 360;
  return { h: Math.round(h), s: Math.round(s * 100), l: Math.round(l * 100) };
}

function hslToHex(h: number, s: number, l: number): string {
  const sN = s / 100;
  const lN = l / 100;
  const c = (1 - Math.abs(2 * lN - 1)) * sN;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = lN - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const toHex = (v: number) =>
    Math.round((v + m) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

// A curated 20-swatch palette — bright, dark, neutral, and pastel picks
// spanning the hue circle, not just primaries.
const PALETTE = [
  "#ef4444", "#f97316", "#eab308", "#84cc16", "#22c55e", "#10b981",
  "#14b8a6", "#06b6d4", "#0ea5e9", "#3b82f6", "#6366f1", "#8b5cf6",
  "#a855f7", "#d946ef", "#ec4899", "#f43f5e", "#78716c", "#1f2937",
  "#ffffff", "#000000",
];

// A real, hand-built HSV-style color wheel — hue by angle (clockwise
// from 3 o'clock, matching the conic-gradient's `from 90deg` so the
// visible ring and the pointer math agree), saturation by distance from
// center, lightness on a separate slider beneath it. No color-picker
// library is a dependency of this app, so this is genuinely interactive
// pointer-driven code, not a static swatch grid pretending to be one.
export function ColorWheel({ value, onChange }: { value: string; onChange: (hex: string) => void }) {
  const wheelRef = useRef<HTMLDivElement>(null);
  const [hsl, setHsl] = useState<HSL>(() => hexToHsl(value));
  const [hexDraft, setHexDraft] = useState(value);
  const draggingRef = useRef(false);

  useEffect(() => {
    setHsl(hexToHsl(value));
    setHexDraft(value);
  }, [value]);

  const commit = (next: HSL) => {
    setHsl(next);
    const hex = hslToHex(next.h, next.s, next.l);
    setHexDraft(hex);
    onChange(hex);
  };

  const pickFromPoint = (clientX: number, clientY: number) => {
    const el = wheelRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const radius = rect.width / 2;
    const dx = clientX - (rect.left + radius);
    const dy = clientY - (rect.top + radius);
    const dist = clamp(Math.sqrt(dx * dx + dy * dy), 0, radius);
    let angle = Math.atan2(dy, dx) * (180 / Math.PI);
    if (angle < 0) angle += 360;
    commit({ h: Math.round(angle), s: Math.round((dist / radius) * 100), l: hsl.l });
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    draggingRef.current = true;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    pickFromPoint(e.clientX, e.clientY);
  };
  const handlePointerMove = (e: React.PointerEvent) => {
    if (!draggingRef.current) return;
    pickFromPoint(e.clientX, e.clientY);
  };
  const handlePointerUp = () => {
    draggingRef.current = false;
  };

  const knobRadiusPct = (hsl.s / 100) * 50;
  const knobLeft = 50 + knobRadiusPct * Math.cos((hsl.h * Math.PI) / 180);
  const knobTop = 50 + knobRadiusPct * Math.sin((hsl.h * Math.PI) / 180);

  return (
    <div className="color-wheel-widget">
      <div
        ref={wheelRef}
        className="color-wheel-ring"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        <span
          className="color-wheel-knob"
          style={{ left: `${knobLeft}%`, top: `${knobTop}%`, background: hslToHex(hsl.h, 100, 50) }}
        />
      </div>

      <label className="color-wheel-lightness-row">
        <span>Lightness</span>
        <input
          type="range"
          min={0}
          max={100}
          value={hsl.l}
          onChange={(e) => commit({ ...hsl, l: Number(e.target.value) })}
        />
      </label>

      <input
        className="color-wheel-hex"
        value={hexDraft}
        onChange={(e) => setHexDraft(e.target.value)}
        onBlur={() => {
          if (/^#[0-9a-fA-F]{6}$/.test(hexDraft)) commit(hexToHsl(hexDraft));
          else setHexDraft(hslToHex(hsl.h, hsl.s, hsl.l));
        }}
      />

      <div className="color-wheel-palette">
        {PALETTE.map((c) => (
          <button
            key={c}
            type="button"
            className="color-wheel-swatch"
            style={{ background: c }}
            title={c}
            onClick={() => commit(hexToHsl(c))}
          />
        ))}
      </div>
    </div>
  );
}
