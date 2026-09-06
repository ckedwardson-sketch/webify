import { DecalDef, decalCanvasStyle, decalPercentStyle } from "./decals";

// Renders whichever decals match a given target/surface — used inside
// a pane card (target="pane"), inside a page's data-color-surface=
// "page-bg" wrapper (target="page-bg"), or (wrapped in React Flow's
// <ViewportPortal> by the caller) as an overlay on a web/graph canvas
// (target="canvas") that pans/zooms with it for free. A decal with no
// `surface` set applies to every instance of its target; one with a
// surface only renders where that surface matches.
export function DecalLayer({
  decals,
  target,
  surface,
  size = 28,
}: {
  decals: DecalDef[];
  target: DecalDef["target"];
  surface?: string;
  size?: number;
}) {
  const matches = decals.filter((d) => d.target === target && (d.surface === undefined || d.surface === surface));
  if (matches.length === 0) return null;

  return (
    <>
      {matches.map((d) => {
        const style = target === "canvas" ? decalCanvasStyle(d) : decalPercentStyle(d);
        const isImage = d.source.startsWith("data:");
        return (
          <div
            key={d.id}
            style={{
              ...style,
              fontSize: size,
              width: isImage ? size : undefined,
              height: isImage ? size : undefined,
              zIndex: target === "page-bg" ? 0 : 5,
            }}
          >
            {isImage ? (
              <img src={d.source} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
            ) : (
              d.source
            )}
          </div>
        );
      })}
    </>
  );
}
