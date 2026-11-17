import {
  BaseEdge,
  getSmoothStepPath,
  type Edge,
  type EdgeProps,
} from '@xyflow/react';
import { stepPathWithHops } from '../lib/hops.ts';

/** Distance from a box edge to where a line turns sideways. */
export const TURN_GAP = 26;

/**
 * Where a stepped line turns sideways:
 * - "source": just below the source box (a line leaving the main timeline,
 *   so it runs down its own branch column),
 * - "target": just above the target box (a line rejoining, so every line
 *   into the same box shares one sideways segment instead of a ladder),
 * - "middle": halfway, the default.
 */
export type TurnAt = 'source' | 'target' | 'middle';

export type TimelineEdgeType = Edge<
  {
    turnAt: TurnAt;
    /** x positions (flow coordinates) where this line hops over another. */
    hops?: number[];
  },
  'timeline'
>;

export function TimelineEdge({
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style,
  markerEnd,
  data,
}: EdgeProps<TimelineEdgeType>) {
  const turnAt = data?.turnAt ?? 'middle';
  // Only meaningful when the line runs downward with room to turn.
  const room = targetY - sourceY > TURN_GAP * 2;
  const centerY =
    room && turnAt === 'source'
      ? sourceY + TURN_GAP
      : room && turnAt === 'target'
        ? targetY - TURN_GAP
        : undefined;

  // With crossings, draw the step ourselves so it can bump over them.
  if (centerY !== undefined && data?.hops?.length) {
    const path = stepPathWithHops(sourceX, sourceY, targetX, targetY, centerY, data.hops);
    return <BaseEdge path={path} style={style} markerEnd={markerEnd} />;
  }

  const [path] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: 10,
    // Smaller than TURN_GAP, so the turn is never pushed elsewhere.
    offset: TURN_GAP / 2,
    centerY,
  });

  return <BaseEdge path={path} style={style} markerEnd={markerEnd} />;
}
