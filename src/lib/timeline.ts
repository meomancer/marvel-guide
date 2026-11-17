/**
 * Timeline layout: places items on a grid where rows are time (year, then
 * month) and columns are lanes (e.g. one lane per series).
 *
 * Years with no items are compressed into a single short "gap" band.
 */

export interface TimelineItem {
  id: string;
  year: number;
  month?: number;
  /** Items with the same lane share a column. */
  lane: string;
  /**
   * Extra height stacked on top of the box (e.g. title or keypoint bars).
   * Its row gets that much more room above, so lines still have space to turn.
   */
  header?: number;
}

export interface Band {
  kind: 'year' | 'gap';
  /** "1963" for a year band, "1966–1995" for a gap band. */
  label: string;
  top: number;
  height: number;
}

export interface TimelineLayout {
  positions: Map<string, { x: number; y: number }>;
  bands: Band[];
  /** Lane names in column order. */
  lanes: string[];
  width: number;
  height: number;
}

export const NODE_WIDTH = 240;
export const NODE_HEIGHT = 96;
const COLUMN_GAP = 48;
/** Vertical gap between rows: room for lines to turn and for the arrowhead. */
const ROW_GAP = 56;
const BAND_PADDING = 32;
/** Tall enough for a vertical one-line "1942–1961" label on phones. */
const GAP_BAND_HEIGHT = 120;

export const COLUMN_WIDTH = NODE_WIDTH + COLUMN_GAP;
const ROW_HEIGHT = NODE_HEIGHT + ROW_GAP;

/**
 * Reading order can disagree with cover dates (an annual dated before the
 * issue you read just before it). Within one lane a box must never sit above
 * a box that leads into it, so such items are moved down to their
 * predecessor's month, and ordered after it. Returns items with these
 * effective dates plus a depth used to order items within the same month.
 */
function respectReadingOrder(
  items: TimelineItem[],
  links: { source: string; target: string }[],
): { items: TimelineItem[]; depth: Map<string, number> } {
  const byId = new Map(items.map((i) => [i.id, i]));
  // 13 slots per year: month 0 means "unknown", 1-12 are real months.
  const when = new Map(items.map((i) => [i.id, i.year * 13 + (i.month ?? 0)]));
  const depth = new Map(items.map((i) => [i.id, 0]));
  const sameLane = links.filter((l) => {
    const s = byId.get(l.source);
    const t = byId.get(l.target);
    return s && t && s.lane === t.lane;
  });

  // Relax until stable (reading order has no cycles; the cap is a safeguard).
  for (let pass = 0; pass < items.length; pass++) {
    let changed = false;
    for (const { source, target } of sameLane) {
      const s = when.get(source)!;
      const t = when.get(target)!;
      if (t < s) {
        when.set(target, s);
        changed = true;
      }
      if (when.get(target) === s && depth.get(target)! <= depth.get(source)!) {
        depth.set(target, depth.get(source)! + 1);
        changed = true;
      }
    }
    if (!changed) break;
  }

  return {
    items: items.map((i) => {
      const w = when.get(i.id)!;
      return { ...i, year: Math.floor(w / 13), month: w % 13 || undefined };
    }),
    depth,
  };
}

/**
 * @param laneOrder Lanes listed here come first, in this order, so e.g. the
 *   main timeline is the leftmost column. Lanes with no items are skipped.
 *   Other lanes follow in order of first appearance.
 * @param links Reading-order lines. Within a lane they win over cover dates,
 *   so lines never have to run upward.
 */
export function layoutTimeline(
  rawItems: TimelineItem[],
  laneOrder: string[] = [],
  links: { source: string; target: string }[] = [],
): TimelineLayout {
  const { items, depth } = respectReadingOrder(rawItems, links);

  // Chronological order; reading order, then input order, break ties.
  const sorted = items
    .map((item, index) => ({ item, index }))
    .sort(
      (a, b) =>
        a.item.year - b.item.year ||
        (a.item.month ?? 0) - (b.item.month ?? 0) ||
        depth.get(a.item.id)! - depth.get(b.item.id)! ||
        a.index - b.index,
    )
    .map(({ item }) => item);

  // Fixed lanes first, then the rest in order of first appearance.
  const present = new Set(sorted.map((item) => item.lane));
  const lanes: string[] = laneOrder.filter((lane) => present.has(lane));
  for (const item of sorted) {
    if (!lanes.includes(item.lane)) lanes.push(item.lane);
  }

  // Group by year, then by month.
  const byYear = new Map<number, Map<number, TimelineItem[]>>();
  for (const item of sorted) {
    const months = byYear.get(item.year) ?? new Map<number, TimelineItem[]>();
    const month = item.month ?? 0;
    months.set(month, [...(months.get(month) ?? []), item]);
    byYear.set(item.year, months);
  }

  const positions = new Map<string, { x: number; y: number }>();
  const bands: Band[] = [];
  let top = 0;
  let previousYear: number | undefined;

  for (const [year, months] of byYear) {
    if (previousYear !== undefined && year - previousYear > 1) {
      const from = previousYear + 1;
      const to = year - 1;
      bands.push({
        kind: 'gap',
        label: from === to ? String(from) : `${from}–${to}`,
        top,
        height: GAP_BAND_HEIGHT,
      });
      top += GAP_BAND_HEIGHT;
    }

    // Each month gets as many rows as its busiest lane needs, so items from
    // the same month line up across lanes. A row is pushed down by the
    // tallest header (bars above the box) among its items.
    let y = top + BAND_PADDING;
    for (const monthItems of months.values()) {
      const rows: TimelineItem[][] = [];
      const perLane = new Map<string, number>();
      for (const item of monthItems) {
        const stack = perLane.get(item.lane) ?? 0;
        perLane.set(item.lane, stack + 1);
        (rows[stack] ??= []).push(item);
      }
      for (const rowItems of rows) {
        y += Math.max(0, ...rowItems.map((item) => item.header ?? 0));
        for (const item of rowItems) {
          positions.set(item.id, { x: lanes.indexOf(item.lane) * COLUMN_WIDTH, y });
        }
        y += ROW_HEIGHT;
      }
    }

    const height = y - ROW_GAP + BAND_PADDING - top;
    bands.push({ kind: 'year', label: String(year), top, height });
    top += height;
    previousYear = year;
  }

  return {
    positions,
    bands,
    lanes,
    width: lanes.length * COLUMN_WIDTH - COLUMN_GAP,
    height: top,
  };
}
