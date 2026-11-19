import { useNodes, useReactFlow, useViewport, useViewportStore, type Node } from '@xyflow/react';
import { useMemo, useRef } from 'react';
import type { Band } from '../lib/timeline.ts';

/** Years shown at once: a long guide is cut into pages of this many years. */
const PAGE_YEARS = 20;
const WIDTH = 200;
const HEIGHT = 240;
const PAD = 6;

/** Box colours: the same kinds as on the map. */
function colorOf(node: Node): string {
  if (node.type === 'sagaRef') return '#6B3FA0';
  const data = node.data as { history?: boolean; optional?: boolean };
  if (data.history) return '#B38F00';
  if (data.optional) return '#C8006A';
  return '#16171A';
}

interface Page {
  first: number;
  last: number;
  top: number;
  bottom: number;
}

/** 20-year pages (1960–1979, 1980–1999, ...) with their vertical extent in flow coordinates. */
function pagesOf(bands: Band[]): Page[] {
  const pages = new Map<number, Page>();
  for (const band of bands) {
    const year = parseInt(band.label, 10);
    if (Number.isNaN(year)) continue;
    const key = Math.floor(year / PAGE_YEARS) * PAGE_YEARS;
    const page = pages.get(key) ?? { first: key, last: key + PAGE_YEARS - 1, top: band.top, bottom: band.top };
    page.top = Math.min(page.top, band.top);
    page.bottom = Math.max(page.bottom, band.top + band.height);
    pages.set(key, page);
  }
  return [...pages.values()].sort((a, b) => a.top - b.top);
}

/**
 * Overview of the 20 years around the current position (bottom left of the
 * map): the boxes in their colours and the visible area outlined in blue.
 * Click or drag in it to move there; the arrows jump 20 years.
 */
export function GuideMinimap({ bands, left }: { bands: Band[]; left: number }) {
  const nodes = useNodes();
  const { x, y, zoom } = useViewport();
  const width = useViewportStore((s) => s.width);
  const height = useViewportStore((s) => s.height);
  const flow = useReactFlow();
  const dragging = useRef(false);

  const pages = useMemo(() => pagesOf(bands), [bands]);
  // The whole guide's width, so the horizontal scale doesn't jump between pages.
  const xs = useMemo(() => {
    if (nodes.length === 0) return { min: 0, max: 1 };
    let min = Infinity;
    let max = -Infinity;
    for (const n of nodes) {
      min = Math.min(min, n.position.x);
      max = Math.max(max, n.position.x + (n.measured?.width ?? 240));
    }
    return { min, max };
  }, [nodes]);

  if (pages.length === 0) return null;

  // Visible area in flow coordinates; the page is the one at its centre.
  const view = { x: -x / zoom, y: -y / zoom, w: width / zoom, h: height / zoom };
  const centre = view.y + view.h / 2;
  let index = 0;
  pages.forEach((p, i) => {
    if (p.top <= centre) index = i;
  });
  const page = pages[index]!;
  const prev = pages[index - 1];
  const next = pages[index + 1];

  const spanX = Math.max(1, xs.max - xs.min);
  const spanY = Math.max(1, page.bottom - page.top);
  const scale = Math.min((WIDTH - 2 * PAD) / spanX, (HEIGHT - 2 * PAD) / spanY);
  const offX = PAD + (WIDTH - 2 * PAD - spanX * scale) / 2;
  const offY = PAD;
  const toX = (fx: number) => offX + (fx - xs.min) * scale;
  const toY = (fy: number) => offY + (fy - page.top) * scale;

  const moveTo = (e: React.PointerEvent<SVGSVGElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const fx = xs.min + (e.clientX - box.left - offX) / scale;
    const fy = page.top + (e.clientY - box.top - offY) / scale;
    void flow.setCenter(fx, fy, { zoom });
  };
  const jump = (to: Page) => void flow.setCenter(view.x + view.w / 2, to.top + view.h / 2, { zoom, duration: 300 });

  const shown = nodes.filter((n) => {
    const top = n.position.y;
    const bottom = top + (n.measured?.height ?? 96);
    return bottom >= page.top && top <= page.bottom;
  });

  return (
    <div className="guide-minimap" style={{ left }}>
      <div className="guide-minimap__head">
        <button
          type="button"
          className="guide-minimap__step"
          disabled={!prev}
          onClick={() => prev && jump(prev)}
          aria-label="Previous 20 years"
          title="Previous 20 years"
        >
          ▲
        </button>
        <span className="guide-minimap__years">
          {page.first}–{page.last}
        </span>
        <button
          type="button"
          className="guide-minimap__step"
          disabled={!next}
          onClick={() => next && jump(next)}
          aria-label="Next 20 years"
          title="Next 20 years"
        >
          ▼
        </button>
      </div>
      <svg
        width={WIDTH}
        height={HEIGHT}
        role="img"
        aria-label={`Overview of ${page.first}–${page.last}`}
        onPointerDown={(e) => {
          dragging.current = true;
          e.currentTarget.setPointerCapture(e.pointerId);
          moveTo(e);
        }}
        onPointerMove={(e) => dragging.current && moveTo(e)}
        onPointerUp={() => {
          dragging.current = false;
        }}
      >
        {shown.map((n) => (
          <rect
            key={n.id}
            x={toX(n.position.x)}
            y={toY(n.position.y)}
            width={Math.max(1.5, (n.measured?.width ?? 240) * scale)}
            height={Math.max(1.5, (n.measured?.height ?? 96) * scale)}
            fill={colorOf(n)}
          />
        ))}
        <rect
          className="guide-minimap__view"
          x={toX(view.x)}
          y={toY(view.y)}
          width={view.w * scale}
          height={view.h * scale}
        />
      </svg>
    </div>
  );
}
