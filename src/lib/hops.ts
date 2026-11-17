/**
 * Line hops: where a line's sideways segment crosses another line's vertical
 * segment, the sideways one draws a small bump over it, so crossings don't
 * look like junctions.
 *
 * Lines here are "down, across, down" steps in flow coordinates:
 * from (sx, sy) down to the turn height cy, across to tx, down to (tx, ty).
 * A straight vertical line has sx === tx.
 */

export interface StepLine {
  id: string;
  sx: number;
  sy: number;
  tx: number;
  ty: number;
  /** Turn height, or undefined for lines that don't take part (e.g. side to side). */
  cy?: number;
}

/** Bump radius. Hops closer than this plus the corner radius to an end are skipped. */
export const HOP_RADIUS = 6;
const CORNER_RADIUS = 10;
/** Lines that only touch (merge at a turn) are not crossings. */
const EPSILON = 1;

/** Map of line id -> x positions where its sideways segment hops. */
export function findHops(lines: StepLine[]): Map<string, number[]> {
  // Every vertical piece of every line.
  const verticals: { id: string; x: number; y1: number; y2: number }[] = [];
  for (const l of lines) {
    if (l.cy === undefined || l.sx === l.tx) {
      verticals.push({ id: l.id, x: l.sx, y1: Math.min(l.sy, l.ty), y2: Math.max(l.sy, l.ty) });
    } else {
      verticals.push({ id: l.id, x: l.sx, y1: Math.min(l.sy, l.cy), y2: Math.max(l.sy, l.cy) });
      verticals.push({ id: l.id, x: l.tx, y1: Math.min(l.cy, l.ty), y2: Math.max(l.cy, l.ty) });
    }
  }

  const hops = new Map<string, number[]>();
  const margin = CORNER_RADIUS + HOP_RADIUS;
  for (const l of lines) {
    if (l.cy === undefined || l.sx === l.tx) continue;
    const left = Math.min(l.sx, l.tx) + margin;
    const right = Math.max(l.sx, l.tx) - margin;
    const xs = new Set<number>();
    for (const v of verticals) {
      if (v.id === l.id) continue;
      if (v.x <= left || v.x >= right) continue;
      // Strictly inside the vertical's span: a line that ends or turns at
      // this height merges here rather than crossing.
      if (l.cy <= v.y1 + EPSILON || l.cy >= v.y2 - EPSILON) continue;
      xs.add(v.x);
    }
    if (xs.size) hops.set(l.id, [...xs]);
  }
  return hops;
}

/**
 * SVG path for a down-across-down step with rounded corners and a bump at
 * each hop x on the sideways segment.
 */
export function stepPathWithHops(
  sx: number,
  sy: number,
  tx: number,
  ty: number,
  cy: number,
  hops: number[],
): string {
  if (sx === tx) return `M ${sx} ${sy} L ${tx} ${ty}`;
  const dir = Math.sign(tx - sx);
  const r = Math.min(CORNER_RADIUS, Math.abs(tx - sx) / 2, cy - sy, ty - cy);
  const h = HOP_RADIUS;
  // Going right, a clockwise arc bulges upward; going left, counter-clockwise does.
  const sweep = dir > 0 ? 1 : 0;

  const parts = [`M ${sx} ${sy}`, `L ${sx} ${cy - r}`, `Q ${sx} ${cy} ${sx + dir * r} ${cy}`];
  const ordered = [...hops].sort((a, b) => (a - b) * dir);
  for (const x of ordered) {
    parts.push(`L ${x - dir * h} ${cy}`, `A ${h} ${h} 0 0 ${sweep} ${x + dir * h} ${cy}`);
  }
  parts.push(`L ${tx - dir * r} ${cy}`, `Q ${tx} ${cy} ${tx} ${cy + r}`, `L ${tx} ${ty}`);
  return parts.join(' ');
}
