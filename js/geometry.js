// ============================================================================
//  geometry.js — the 3×3 goal grid, derived from GOAL_MOUTH in config.js.
//  Shared by the game logic, the input code and the renderer.
// ============================================================================

import { GOAL_MOUTH, GRID_HIT_MARGIN, KEEPER } from './config.js';

/** Rectangle of one cell. col 0 = screen-left, row 0 = top. */
export function cellRect(col, row) {
  const w = GOAL_MOUTH.w / 3;
  const h = GOAL_MOUTH.h / 3;
  return { x: GOAL_MOUTH.x + col * w, y: GOAL_MOUTH.y + row * h, w, h };
}

/** Centre point of one cell. */
export function cellCentre(col, row) {
  const r = cellRect(col, row);
  return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
}

/**
 * Which cell is under a logical-pixel point, or null if it is too far from
 * the goal. Points slightly outside the mouth (within GRID_HIT_MARGIN) snap
 * to the nearest cell, which helps on small touch screens.
 */
export function cellFromPoint(x, y) {
  const m = GRID_HIT_MARGIN;
  if (x < GOAL_MOUTH.x - m || x > GOAL_MOUTH.x + GOAL_MOUTH.w + m) return null;
  if (y < GOAL_MOUTH.y - m || y > GOAL_MOUTH.y + GOAL_MOUTH.h + m) return null;
  const fx = (x - GOAL_MOUTH.x) / GOAL_MOUTH.w;
  const fy = (y - GOAL_MOUTH.y) / GOAL_MOUTH.h;
  const col = Math.min(2, Math.max(0, Math.floor(fx * 3)));
  const row = Math.min(2, Math.max(0, Math.floor(fy * 3)));
  return { col, row };
}

/** Where the ball lands for a shot, from its real (u, v). */
export function landingPoint(u, v) {
  return {
    x: GOAL_MOUTH.x + u * GOAL_MOUTH.w,
    y: GOAL_MOUTH.y + (1 - v) * GOAL_MOUTH.h,
  };
}

/** The keeper's resting spot: feet on the goal line, centre of the goal. */
export function keeperHome() {
  return {
    x: GOAL_MOUTH.x + GOAL_MOUTH.w / 2,
    y: GOAL_MOUTH.y + GOAL_MOUTH.h + KEEPER.feetBelowMouth,
  };
}

/** Keypad mapping: key digit (1–9) → cell. 7-8-9 top, 4-5-6 middle, 1-2-3 bottom. */
export function cellFromDigit(digit) {
  if (digit < 1 || digit > 9) return null;
  const col = (digit - 1) % 3;
  const row = 2 - Math.floor((digit - 1) / 3);
  return { col, row };
}

/** Reverse of cellFromDigit, for labelling the grid. */
export function digitForCell(col, row) {
  return (2 - row) * 3 + col + 1;
}

/** Does a point fall inside a rectangle (optionally padded)? */
export function pointInRect(x, y, r, pad = 0) {
  return x >= r.x - pad && x <= r.x + r.w + pad && y >= r.y - pad && y <= r.y + r.h + pad;
}
