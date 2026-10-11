// ============================================================================
//  data.js — loads data/shots.json and hands out random shots.
//
//  File shape:
//    { "count": N, "fields": ["x","y","u","v","col","row"], "shots": [[...], ...] }
//
//    x, y     shot location in StatsBomb units (goal centred at 120, 40)
//    u, v     landing point in the goal mouth, 0..1
//             u = 0 screen-left post, u = 1 screen-right post
//             v = 0 ground, v = 1 crossbar
//    col, row target cell, 0..2 (col 0 = screen-left; row 0 = top).
//             These decide save or goal.
// ============================================================================

import { ASSET_PATHS, PITCH } from './config.js';

/**
 * Fetch the shot file once. Resolves to an array of shot objects.
 * Rejects with a readable Error if the file can't be loaded.
 */
export async function loadShots(url = ASSET_PATHS.shots) {
  let response;
  try {
    response = await fetch(url);
  } catch (err) {
    throw new Error(
      `Could not fetch ${url} (${err.message}). ` +
      'The game must be served over HTTP — for example "python3 -m http.server" — ' +
      'not opened as a file.'
    );
  }
  if (!response.ok) {
    throw new Error(`Could not load ${url}: HTTP ${response.status} ${response.statusText}.`);
  }

  const json = await response.json();
  if (!json || !Array.isArray(json.shots) || !Array.isArray(json.fields)) {
    throw new Error(`${url} does not look like a shot file.`);
  }

  // Map the compact arrays onto named objects using the "fields" list, so the
  // code does not depend on the column order.
  const index = {};
  json.fields.forEach((name, i) => { index[name] = i; });
  const required = ['x', 'y', 'u', 'v', 'col', 'row'];
  for (const name of required) {
    if (!(name in index)) throw new Error(`${url} is missing the "${name}" field.`);
  }

  const shots = json.shots.map((arr) => ({
    x: arr[index.x],
    y: arr[index.y],
    u: arr[index.u],
    v: arr[index.v],
    col: arr[index.col],
    row: arr[index.row],
  }));

  if (shots.length === 0) throw new Error(`${url} contains no shots.`);
  return shots;
}

/** Distance from the shot spot to the centre of the goal, in pitch units. */
export function shotDistance(shot) {
  return Math.hypot(PITCH.goalX - shot.x, PITCH.goalY - shot.y);
}

/**
 * Picks shots uniformly at random without repeating one within a game.
 * Call reset() at the start of each game.
 */
export class ShotSampler {
  constructor(shots) {
    this.shots = shots;
    this.used = new Set();
  }

  reset() {
    this.used.clear();
  }

  next() {
    // If every shot has been used (34,000+ saves in one game!) start over.
    if (this.used.size >= this.shots.length) this.used.clear();

    let i;
    do {
      i = Math.floor(Math.random() * this.shots.length);
    } while (this.used.has(i));
    this.used.add(i);

    const shot = this.shots[i];
    return { ...shot, index: i, distance: shotDistance(shot) };
  }
}
