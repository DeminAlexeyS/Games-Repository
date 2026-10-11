// ============================================================================
//  config.js — every tunable number in one place.
//
//  Edit freely. Each value has a short comment. Times are in SECONDS, sizes in
//  LOGICAL PIXELS (the game is drawn at 480×270 and then scaled to the window),
//  and pitch positions are in StatsBomb units (120 × 80, goal centred at
//  x = 120, y = 40).
// ============================================================================

// ---------------------------------------------------------------------------
//  Screen
// ---------------------------------------------------------------------------
export const LOGICAL_WIDTH = 480;   // logical canvas width in pixels
export const LOGICAL_HEIGHT = 270;  // logical canvas height in pixels (16:9)

// When true, the canvas is only enlarged by whole numbers (×1, ×2, ×3 …),
// which keeps every pixel perfectly square at the cost of some unused border.
// When false, the canvas fills the window as far as the aspect ratio allows.
export const SNAP_INTEGER_SCALE = false;

// Largest frame step the game will simulate. If the browser pauses the tab
// and comes back later, the next frame is capped to this many seconds so the
// animations don't jump.
export const MAX_DELTA = 0.1;

// ---------------------------------------------------------------------------
//  Pitch (StatsBomb coordinates)
// ---------------------------------------------------------------------------
export const PITCH = {
  width: 120,        // pitch length in StatsBomb units (the attacker shoots toward x = 120)
  height: 80,        // pitch width
  goalX: 120,        // x of the goal line
  goalY: 40,         // y of the goal centre
  goalWidth: 8,      // posts are at y = 36 and y = 44
  sixYardDepth: 6,   // 6-yard box: 6 units deep …
  sixYardHalf: 10,   // … and ±10 units either side of the centre
  boxDepth: 18,      // penalty box: 18 units deep …
  boxHalf: 22,       // … and ±22 units either side of the centre
  penaltySpot: 12,   // penalty spot: 12 units from the goal line
  arcRadius: 10,     // radius of the "D" around the penalty spot
  halfwayDepth: 60,  // halfway line
  centreCircle: 10,  // radius of the centre circle
  stripeDepth: 6,    // one grass stripe every N units of depth
};

// ---------------------------------------------------------------------------
//  Perspective projection (fake 3D)
//
//  depth   = 120 − x   (distance from the goal line along the pitch)
//  lateral = 40 − y    (positive = screen-RIGHT; a shot from y = 70 is screen-LEFT)
//  s       = F / (F + depth)             (1 at the goal line, smaller further away)
//  screenY = horizonY + (goalLineY − horizonY) · s
//  screenX = centreX + lateral · K · s
//  sprite scale = baseScale · s
// ---------------------------------------------------------------------------
export const PROJECTION = {
  F: 20,            // "focal length": smaller = stronger perspective, things shrink faster
  K: 8,             // horizontal pixels per pitch unit at the goal line. Smaller = narrower view
  horizonY: 60,     // screen y of the horizon (very far away)
  goalLineY: 196,   // screen y of the goal line (depth 0)
  centreX: 240,     // screen x of the pitch centre line
  edgeMargin: 14,   // the attacker is kept at least this far inside the screen edge
                    // (only matters for the handful of shots taken from the corner flag)
};

// ---------------------------------------------------------------------------
//  Goal mouth — the INSIDE of the goal frame, in logical pixels.
//
//  The 3×3 grid, the ball's landing points and the keeper's dive positions are
//  all derived from this rectangle, so it must line up with the goal art.
//
//  With the placeholder goal (no goal.png) the posts are drawn around this
//  rectangle automatically, so nothing needs adjusting.
//
//  When the real goal.png arrives:
//   1. Open goal.png in an image editor and note the pixel rectangle of the
//      inside of the posts/crossbar: left px, top py, width pw, height ph.
//   2. Choose where to draw the image with GOAL_IMAGE below (top-left corner
//      x, y and a scale; whole numbers look best for pixel art).
//   3. Set GOAL_MOUTH = {
//        x: GOAL_IMAGE.x + px · GOAL_IMAGE.scale,
//        y: GOAL_IMAGE.y + py · GOAL_IMAGE.scale,
//        w: pw · GOAL_IMAGE.scale,
//        h: ph · GOAL_IMAGE.scale }
//   Tip: set DEBUG.showGoalMouth = true to see the rectangle drawn on screen
//   while you line it up.
// ---------------------------------------------------------------------------
export const GOAL_MOUTH = { x: 84, y: 66, w: 312, h: 156 };

// Where goal.png is drawn (ignored when the placeholder goal is used).
export const GOAL_IMAGE = {
  x: 74,     // top-left x of the image on screen
  y: 54,      // top-left y of the image on screen
  scale: 1,   // image scale (1 = one image pixel per logical pixel)
};

// Placeholder goal look (used only when goal.png is missing).
export const GOAL_PLACEHOLDER = {
  postWidth: 5,       // thickness of posts and crossbar
  netDepth: 22,       // how far the back of the net is drawn "behind" the mouth
  netSpacing: 8,      // spacing of the net mesh lines
  netAlpha: 0.35,     // transparency of the net
};

// Taps/clicks this many logical pixels OUTSIDE the goal mouth still pick the
// nearest cell. Makes the edge cells easier to hit on small phones.
export const GRID_HIT_MARGIN = 14;

// ---------------------------------------------------------------------------
//  Timings (seconds)
// ---------------------------------------------------------------------------
export const TIMING = {
  setup: 0.5,            // pause at the start of a round while the attacker appears
  countdownMin: 1.0,     // countdown for close shots
  countdownMax: 3.0,     // countdown for long-range shots
  distanceNear: 12,      // d ≤ this → countdownMin
  distanceFar: 30,       // d ≥ this → countdownMax (linear in between)
  warning: 1.0,          // the countdown turns red with this many seconds left
  runFrame: 0.12,        // time between attacker run frames
  flight: 0.55,          // ball flight time from foot to goal
  dive: 0.5,             // keeper dive/jump time (starts at the kick)
  saveDrop: 0.6,         // how long the ball drops/deflects after a save
  goalSettle: 0.45,      // how long the ball keeps going into the net after a goal
  goalShake: 0.35,       // duration of the goal-frame shake after a goal
  result: 1.2,           // how long the SAVE!/GOAL! banner stays before the next round
  bannerPop: 0.15,       // banner "pop in" animation time
  gridFade: 0.3,         // grid overlay fade-out time after the kick
  gameOverDelay: 0.6,    // extra pause before the game-over screen appears
};

// ---------------------------------------------------------------------------
//  Rules and scoring
// ---------------------------------------------------------------------------
export const RULES = {
  lives: 3,                // lives at the start of a game
  defaultCell: { col: 1, row: 2 },  // cell counted when the player makes no choice (bottom-centre)
};

// Points per save by streak value AFTER the save. Checked from the top down:
// the first tier whose `from` is ≤ the streak wins.
export const STREAK_TIERS = [
  { from: 11, points: 3 },
  { from: 6, points: 2 },
  { from: 1, points: 1 },
];

// ---------------------------------------------------------------------------
//  Attacker
// ---------------------------------------------------------------------------
export const ATTACKER = {
  extraRunDistance: 10,  // the run starts this many units behind the shot spot (clamped to the pitch)
  ballFootOffsetX: 6,    // ball position relative to the attacker's feet, in sprite pixels at scale 1
  ballFootOffsetY: 2,
};

// ---------------------------------------------------------------------------
//  Ball
// ---------------------------------------------------------------------------
export const BALL = {
  arcHeight: 26,         // height of the flight arc in pixels (at the goal line)
  netTravel: 18,         // how far the ball continues past the goal mouth on a goal (pixels)
  netScale: 1.15,        // the ball grows to this × its goal-line size as it enters the net
  dropGravity: 420,      // gravity for the drop after a save (pixels / s²)
  deflectSpeed: 40,      // sideways speed of the ball after a save (pixels / s)
  bounce: 0.35,          // how much of the speed survives bouncing on the ground
};

// ---------------------------------------------------------------------------
//  Goalkeeper
// ---------------------------------------------------------------------------
export const KEEPER = {
  feetBelowMouth: 2,     // keeper's feet are this many pixels below the bottom of the goal mouth
  // Which part of the sprite lands on the chosen cell's centre, as a fraction
  // of the sprite height measured from the TOP (0 = top edge, 0.5 = middle).
  diveReach: 0.5,        // dive sprite: its middle lands on the cell centre
  jumpReach: 0.25,       // jump sprite: the raised gloves/head area lands on the cell centre
  minJump: 12,           // the jump always rises at least this many pixels (so it is visible)
  shakeAmplitude: 3,     // goal-frame shake amplitude in pixels on a goal
};

// ---------------------------------------------------------------------------
//  Sprites — base scale per sprite (1 = one image pixel per logical pixel).
//  `placeholderW/H` are only used when the PNG is missing. For real art, the
//  drawn size is the image size × scale (× the perspective factor s for the
//  attacker and its ball).
//
//  Anchors: attacker and keeper = bottom-centre (the feet); ball = centre.
//  keeper_dive.png must be drawn diving to the RIGHT; it is mirrored for left cells.
// ---------------------------------------------------------------------------
export const SPRITES = {
  attacker: { scale: 1, placeholderW: 24, placeholderH: 64 },
  keeperIdle: { scale: 1, placeholderW: 30, placeholderH: 72 },
  keeperDive: { scale: 1, placeholderW: 80, placeholderH: 40 },
  keeperJump: { scale: 1, placeholderW: 30, placeholderH: 88 },
  ball: { scale: 1, placeholderW: 12, placeholderH: 12 },
  goal: { scale: 1 },                 // see GOAL_IMAGE for position
  statsbombLogo: { maxWidth: 110, maxHeight: 24 }, // credit logo is shrunk to fit this box
};

// Paths are relative so the game works from a GitHub Pages sub-folder.
export const ASSET_PATHS = {
  attackerRun1: 'assets/sprites/attacker_run_1.png',
  attackerRun2: 'assets/sprites/attacker_run_2.png',
  attackerKick: 'assets/sprites/attacker_kick.png',
  keeperIdle: 'assets/sprites/keeper_idle.png',
  keeperDive: 'assets/sprites/keeper_dive.png',
  keeperJump: 'assets/sprites/keeper_jump.png',
  ball: 'assets/sprites/ball.png',
  goal: 'assets/sprites/goal.png',
  statsbombLogo: 'assets/statsbomb-logo.png',
  shots: 'data/shots.json',
  sounds: {
    kick: 'assets/sounds/kick.mp3',
    save: 'assets/sounds/save.mp3',
    goal: 'assets/sounds/goal.mp3',
  },
};

// ---------------------------------------------------------------------------
//  Colours
// ---------------------------------------------------------------------------
export const COLORS = {
  sky: '#5c8fd6',
  skyLow: '#9ac4ee',
  standsDark: '#2b2f45',
  standsLight: '#3d4463',
  crowd: ['#c9c3b8', '#e6b89c', '#8c6a5a', '#b73a3a', '#2f6fd1', '#f0e68c', '#6f8f4f'],
  grassA: '#3e9a44',
  grassB: '#348a3a',
  grassNear: '#2e7a33',      // grass between the camera and the goal line
  pitchLine: '#e8f3e8',
  post: '#f4f4f4',
  postShade: '#bdbdbd',
  net: '#ffffff',
  gridLine: 'rgba(255,255,255,0.55)',
  gridFill: 'rgba(255,255,255,0.08)',
  gridHover: 'rgba(255,255,255,0.22)',
  gridSelected: 'rgba(255,230,80,0.45)',
  gridSelectedLine: '#ffe650',
  gridNumber: 'rgba(255,255,255,0.45)',
  hudText: '#ffffff',
  hudShadow: '#101020',
  hudBand: 'rgba(10,14,30,0.55)',
  hudDim: '#b8c0d8',
  countdown: '#ffffff',
  countdownWarning: '#ff4040',
  multiplierHot: '#ffe650',
  lifeFull: '#ffffff',
  lifeLost: 'rgba(255,255,255,0.25)',
  save: '#3ee05a',
  goal: '#ff4040',
  bannerShadow: 'rgba(0,0,0,0.6)',
  buttonFace: '#2457c5',
  buttonHover: '#2f6ae0',
  buttonPressed: '#1a419a',
  buttonEdge: '#102a66',
  buttonText: '#ffffff',
  panel: 'rgba(10,14,30,0.78)',
  panelEdge: '#8fa3d9',
  title: '#ffe650',
  // attacker placeholder
  attackerShirt: '#d62828',
  attackerShorts: '#f5f5f5',
  attackerSkin: '#e8b48c',
  attackerHair: '#3b2a1a',
  attackerSocks: '#d62828',
  attackerBoots: '#222222',
  // keeper placeholder
  keeperShirt: '#2fb34a',
  keeperShorts: '#1e1e1e',
  keeperGloves: '#ffd400',
  keeperSkin: '#d9a57b',
  keeperHair: '#1f140c',
  // heatmap
  heatLow: [30, 40, 70],       // RGB of an empty heatmap cell
  heatHigh: [230, 120, 40],    // RGB of the busiest heatmap cell
  heatGrid: '#dde3f5',
};

// ---------------------------------------------------------------------------
//  Fonts
// ---------------------------------------------------------------------------
export const FONT = {
  family: '"Press Start 2P", "Courier New", monospace', // pixel font with monospace fallback
  loadTimeout: 2.5,   // seconds to wait for the web font before starting anyway
};

// ---------------------------------------------------------------------------
//  Layout of UI elements (logical pixels)
// ---------------------------------------------------------------------------
export const LAYOUT = {
  hudMargin: 6,                        // distance from the screen edge for HUD text
  hudBandHeight: 34,                   // dark strip across the top behind the HUD
  scoreSize: 8,                        // font size of the score
  streakSize: 8,                       // font size of the streak line
  countdownSize: 16,                   // font size of the countdown digits
  countdownBar: { w: 80, h: 4, y: 28 },// shrinking bar under the countdown
  lifeIcon: { size: 8, gap: 4 },       // lives icons at top-right
  muteButton: { w: 26, h: 22 },        // mute button, drawn in the bottom-right corner
  bannerSize: 16,                      // "SAVE! +2" / "GOAL!" font size
  bannerY: 70,                         // banner centre y
  buttonHitPad: 6,                     // extra invisible margin around buttons for touch
  title: {
    titleY: 78, titleSize: 24,
    taglineY: 110, taglineSize: 8,
    play: { w: 128, h: 36, y: 140 },
    hintY: 196, hintSize: 6,
    creditY: 246,
  },
  gameOver: {
    titleY: 22, titleSize: 16,
    statsX: 28, statsY: 56, statsSize: 8, statsGap: 18,
    heatmap: { x: 244, y: 56, w: 204, h: 102 },
    playAgain: { w: 160, h: 32, y: 222 },
  },
};

// ---------------------------------------------------------------------------
//  Audio (synthesised sounds; .mp3 files in assets/sounds/ override them)
// ---------------------------------------------------------------------------
export const AUDIO = {
  masterVolume: 0.8,       // overall volume 0..1
  storageKey: 'lastline.muted',   // localStorage key for the mute setting
};

// ---------------------------------------------------------------------------
//  Debug helpers
// ---------------------------------------------------------------------------
export const DEBUG = {
  showGoalMouth: false,    // outline GOAL_MOUTH in magenta (handy when aligning goal.png)
  showShotInfo: false,     // print the current shot's x, y, col, row on screen
};
