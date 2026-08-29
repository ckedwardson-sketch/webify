// Resolves the effective input mode ("mouse" vs "touch") for the
// editor's tool-access surfaces — mirrors theme/mobileLayout.ts's
// auto/on/off convention, reusing (pointer: coarse) as the device
// heuristic rather than inventing new touch-detection infra.
export type ResolvedInputMode = "mouse" | "touch";

export function resolveInputMode(mode: "auto" | "mouse" | "touch"): ResolvedInputMode {
  if (mode === "mouse" || mode === "touch") return mode;
  return window.matchMedia("(pointer: coarse)").matches ? "touch" : "mouse";
}
