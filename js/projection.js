// ============================================================================
//  projection.js — fake 3D: pitch coordinates → screen coordinates.
//
//  The camera sits behind the goalkeeper looking up the pitch, so:
//    depth   = 120 − x   (0 at the goal line, bigger further away)
//    lateral = 40 − y    (positive = screen-RIGHT, negative = screen-LEFT)
//
//  High StatsBomb y (toward 80) is therefore on the LEFT of the screen and low
//  y (toward 0) on the RIGHT. See docs/DATA_METHODOLOGY.md §5.
// ============================================================================

import { PITCH, PROJECTION } from './config.js';

/** Convert StatsBomb (x, y) to { depth, lateral }. */
export function toDepthLateral(x, y) {
  return { depth: PITCH.goalX - x, lateral: PITCH.goalY - y };
}

/**
 * Project a point given as depth (units from the goal line) and lateral
 * offset (units right of the centre). Returns screen x, y and the scale
 * factor s (1 at the goal line).
 */
export function projectDL(depth, lateral) {
  const { F, K, horizonY, goalLineY, centreX } = PROJECTION;
  const s = F / (F + Math.max(depth, 0));
  return {
    sx: centreX + lateral * K * s,
    sy: horizonY + (goalLineY - horizonY) * s,
    s,
  };
}

/** Project a StatsBomb pitch position (x, y). */
export function project(x, y) {
  const { depth, lateral } = toDepthLateral(x, y);
  return projectDL(depth, lateral);
}
