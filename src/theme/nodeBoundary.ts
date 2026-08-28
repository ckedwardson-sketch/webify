// Ray-casts from a node's center out to its silhouette (SHAPE_POLYGONS
// in nodeShapes.ts) at a given rotational angle, so a connection handle
// can be placed exactly on the node's visible edge regardless of shape.
// This is what makes a link's anchor point survive a shape change: the
// angle is what's persisted (see DreamLink.sourceAngle/targetAngle),
// and the actual (x, y) is always recomputed against whatever shape is
// currently active.
import { NodeShapeKey, ShapePoint, SHAPE_POLYGONS } from "./nodeShapes";

const CENTER: ShapePoint = { x: 50, y: 50 };

// 0deg = straight up (12 o'clock), increasing clockwise — the
// "rotational position" the rest of this feature talks about.
function directionForAngle(angleDeg: number): { dx: number; dy: number } {
  const rad = (angleDeg * Math.PI) / 180;
  return { dx: Math.sin(rad), dy: -Math.cos(rad) };
}

// Ray (origin + t*dir, t >= 0) vs. segment (a -> b) intersection.
// Returns the ray parameter t if they cross within the segment,
// otherwise null. Standard 2D ray/segment intersection via the
// perpendicular-dot-product method.
function rayIntersectSegment(
  origin: ShapePoint,
  dir: { dx: number; dy: number },
  a: ShapePoint,
  b: ShapePoint
): number | null {
  const v1x = origin.x - a.x;
  const v1y = origin.y - a.y;
  const v2x = b.x - a.x;
  const v2y = b.y - a.y;
  const v3x = -dir.dy;
  const v3y = dir.dx;

  const denom = v2x * v3x + v2y * v3y;
  if (Math.abs(denom) < 1e-9) return null;

  const t = (v2x * v1y - v2y * v1x) / denom;
  const s = (v1x * v3x + v1y * v3y) / denom;
  if (t >= 0 && s >= 0 && s <= 1) return t;
  return null;
}

// Where a ray from the node's center at `angleDeg` crosses the given
// shape's silhouette, in percent coordinates (0-100) within the node's
// own bounding box — directly usable as a Handle's left/top style.
// Falls back to the rectangle's boundary for an unrecognized shape key,
// same fallback nodeShapes.ts's other helpers use.
export function pointOnShapeBoundary(shape: string, angleDeg: number): ShapePoint {
  const polygon = SHAPE_POLYGONS[shape as NodeShapeKey] ?? SHAPE_POLYGONS.rectangle;
  const dir = directionForAngle(angleDeg);

  let bestT = Infinity;
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i];
    const b = polygon[(i + 1) % polygon.length];
    const t = rayIntersectSegment(CENTER, dir, a, b);
    if (t !== null && t < bestT) bestT = t;
  }

  if (!Number.isFinite(bestT)) return CENTER; // shouldn't happen for a closed polygon around the center
  return { x: CENTER.x + bestT * dir.dx, y: CENTER.y + bestT * dir.dy };
}

// Inverse of directionForAngle — the compass-style angle (0 = up,
// clockwise) a plain (dx, dy) direction vector corresponds to. Used to
// pick a sensible default anchor angle for a link that predates angle
// tracking (points it toward whatever it's connected to) instead of an
// arbitrary fixed direction.
export function angleFromDirection(dx: number, dy: number): number {
  if (dx === 0 && dy === 0) return 0;
  const deg = (Math.atan2(dx, -dy) * 180) / Math.PI;
  return (deg + 360) % 360;
}
