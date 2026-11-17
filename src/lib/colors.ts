/**
 * Line colours for lanes, like lines on a transit map. Picked to stay
 * distinguishable from each other and readable on the light paper background.
 */
const LANE_COLORS = [
  '#0089BF', // cyan
  '#C8006A', // magenta
  '#138A52', // green
  '#5A3DA0', // violet
  '#D35400', // orange
  '#A67C00', // ochre
  '#2E3A46', // slate
];

export function laneColor(laneIndex: number): string {
  return LANE_COLORS[laneIndex % LANE_COLORS.length]!;
}
