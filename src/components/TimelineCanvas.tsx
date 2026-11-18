import {
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  useViewport,
  type Edge,
  type EdgeTypes,
  type Node,
  type NodeMouseHandler,
  type NodeTypes,
} from '@xyflow/react';
import { useEffect, useState } from 'react';
import type { Band } from '../lib/timeline.ts';
import { TimelineEdge } from './TimelineEdge.tsx';

const edgeTypes: EdgeTypes = { timeline: TimelineEdge };

/** Width of the year ruler on the left. Nodes start to the right of it. */
const RULER_WIDTH = 72;
/** Phones: years are written vertically, so the ruler can be narrow. */
const RULER_WIDTH_NARROW = 28;
/** Width of one column of the event rail, right of the year ruler. */
const RAIL_COLUMN_WIDTH = 28;
const RAIL_COLUMN_WIDTH_NARROW = 20;

const NARROW_QUERY = '(max-width: 720px)';

/**
 * Mouse wheel over the year ruler or the story arc rail pans the map up and
 * down instead of zooming (the wheel over the map itself still zooms).
 */
function useWheelPan() {
  const flow = useReactFlow();
  return (e: React.WheelEvent) => {
    // deltaMode 1 = lines, 2 = pages; 0 = pixels (most mice and trackpads).
    const step = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? window.innerHeight : 1;
    const { x, y, zoom } = flow.getViewport();
    void flow.setViewport({ x, y: y - e.deltaY * step, zoom });
  };
}

/** True on phone-sized screens; follows rotation and window resizes. */
function useNarrow(): boolean {
  const [narrow, setNarrow] = useState(() => window.matchMedia(NARROW_QUERY).matches);
  useEffect(() => {
    const query = window.matchMedia(NARROW_QUERY);
    const onChange = () => setNarrow(query.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);
  return narrow;
}

/** Start just right of the ruler; zoomed out further on phones. */
const startViewport = (leftInset: number, narrow: boolean) => ({
  x: leftInset + (narrow ? 12 : 32),
  y: 24,
  zoom: narrow ? 0.6 : 0.9,
});

/**
 * A labelled vertical span on the event rail, in flow coordinates.
 * Markers that overlap in time go in different columns.
 */
export interface RailMarker {
  id: string;
  label: string;
  top: number;
  height: number;
  column: number;
}

interface TimelineCanvasProps<N extends Node> {
  nodes: N[];
  edges: Edge[];
  bands: Band[];
  nodeTypes: NodeTypes;
  onNodeClick?: NodeMouseHandler<N>;
  onPaneClick?: () => void;
  /** Changing this resets the viewport to the top of the timeline. */
  resetKey: string;
  /** Node to scroll into view, e.g. when picked from the detail panel. */
  /** Node to zoom to. A new `seq` re-focuses even the same node. */
  focus?: { id: string; seq: number };
  /** Event spans shown on a rail right of the year ruler. */
  markers?: RailMarker[];
}

export function TimelineCanvas<N extends Node>(props: TimelineCanvasProps<N>) {
  const markers = props.markers ?? [];
  const railColumns = markers.length === 0 ? 0 : Math.max(...markers.map((m) => m.column)) + 1;
  const narrow = useNarrow();
  const rulerWidth = narrow ? RULER_WIDTH_NARROW : RULER_WIDTH;
  const railColumnWidth = narrow ? RAIL_COLUMN_WIDTH_NARROW : RAIL_COLUMN_WIDTH;
  const railWidth = railColumns * railColumnWidth;

  return (
    <ReactFlowProvider>
      <div className="timeline-canvas">
        <BandLayer bands={props.bands} />
        <Flow {...props} leftInset={rulerWidth + railWidth} narrow={narrow} />
        <YearRuler bands={props.bands} width={rulerWidth} />
        {railWidth > 0 && <EventRail
            markers={markers}
            left={rulerWidth}
            width={railWidth}
            columnWidth={railColumnWidth}
          />}
      </div>
    </ReactFlowProvider>
  );
}

function Flow<N extends Node>({
  nodes,
  edges,
  nodeTypes,
  onNodeClick,
  onPaneClick,
  resetKey,
  focus,
  leftInset,
  narrow,
}: TimelineCanvasProps<N> & { leftInset: number; narrow: boolean }) {
  const flow = useReactFlow();

  useEffect(() => {
    void flow.setViewport(startViewport(leftInset, narrow), { duration: 300 });
  }, [flow, resetKey, leftInset, narrow]);

  useEffect(() => {
    if (!focus) return;
    // Wait a frame so a freshly shown node has been measured.
    const frame = requestAnimationFrame(() => {
      const node = flow.getNode(focus.id);
      if (!node) return;
      const width = node.measured?.width ?? 240;
      const height = node.measured?.height ?? 96;
      void flow.setCenter(node.position.x + width / 2, node.position.y + height / 2, {
        zoom: Math.max(flow.getZoom(), 1),
        duration: 500,
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [flow, focus]);

  return (
    <ReactFlow<N>
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      onNodeClick={onNodeClick}
      onPaneClick={onPaneClick}
      defaultViewport={startViewport(leftInset, narrow)}
      nodesDraggable={false}
      nodesConnectable={false}
      minZoom={0.25}
      maxZoom={1.75}
      proOptions={{ hideAttribution: true }}
      className="timeline-canvas__flow"
    />
  );
}

/** Alternating year stripes behind the diagram, following pan and zoom. */
function BandLayer({ bands }: { bands: Band[] }) {
  const { y, zoom } = useViewport();
  return (
    <div className="band-layer" aria-hidden="true">
      {bands.map((band, i) => (
        <div
          key={`${band.label}-${i}`}
          className={`band band--${band.kind}${i % 2 ? ' band--alt' : ''}`}
          style={{ top: band.top * zoom + y, height: band.height * zoom }}
        />
      ))}
    </div>
  );
}

/** Year labels pinned to the left edge, in sync with vertical pan and zoom. */
function YearRuler({ bands, width }: { bands: Band[]; width: number }) {
  const { y, zoom } = useViewport();
  const onWheel = useWheelPan();
  return (
    <div className="year-ruler" style={{ width }} onWheel={onWheel}>
      {bands.map((band, i) => (
        <div
          key={`${band.label}-${i}`}
          className={`year-ruler__band year-ruler__band--${band.kind}`}
          style={{ top: band.top * zoom + y, height: band.height * zoom }}
        >
          {band.kind === 'year' ? (
            <span className="year-ruler__year">{band.label}</span>
          ) : (
            <span className="year-ruler__gap" title={`No issues in ${band.label}`}>
              {band.label}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

/**
 * Coloured event spans right of the year ruler, in sync with vertical pan and
 * zoom. Each label sticks to the top of the screen while its span is in view,
 * and is pushed out (clipped) when the span scrolls away.
 */
function EventRail({
  markers,
  left,
  width,
  columnWidth,
}: {
  markers: RailMarker[];
  left: number;
  width: number;
  columnWidth: number;
}) {
  const { y, zoom } = useViewport();
  const onWheel = useWheelPan();
  return (
    <div className="event-rail" style={{ left, width }} aria-hidden="true" onWheel={onWheel}>
      {markers.map((m) => {
        const top = m.top * zoom + y;
        return (
          <div
            key={m.id}
            className="event-rail__span"
            style={{
              top,
              height: m.height * zoom,
              left: m.column * columnWidth,
              width: columnWidth,
            }}
            title={m.label}
          >
            <span className="event-rail__label" style={{ top: Math.max(0, -top) }}>
              {m.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
