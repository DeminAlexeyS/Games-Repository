// ============================================================================
//  sprites.js — loads the PNG sprites and draws code placeholders for any
//  that are missing. The game is fully playable with zero image files.
//
//  Every sprite ends up as { image, width, height, placeholder } where image
//  is either the loaded <img> or an offscreen canvas with a placeholder
//  drawing. Rendering code treats both the same way.
// ============================================================================

import { ASSET_PATHS, SPRITES, COLORS } from './config.js';

/** Load one image. Never rejects: a missing file resolves to null. */
function loadImage(url) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

/** Create a transparent offscreen canvas of the given size. */
function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

/** Tiny helper: fill a rectangle in a colour. */
function px(ctx, color, x, y, w, h) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

// ---------------------------------------------------------------------------
//  Placeholder drawings. Each draws on a fresh canvas at the sprite's
//  placeholder size from config, so the code works at any size.
// ---------------------------------------------------------------------------

/** Attacker facing the camera. pose: 'run1' | 'run2' | 'kick'. */
function drawAttackerPlaceholder(pose) {
  const { placeholderW: W, placeholderH: H } = SPRITES.attacker;
  const c = makeCanvas(W, H);
  const ctx = c.getContext('2d');
  const u = W / 24; // horizontal unit, so the drawing scales with the config size
  const v = H / 64; // vertical unit
  const r = (x, y, w, h, col) => px(ctx, col, Math.round(x * u), Math.round(y * v), Math.round(w * u), Math.round(h * v));

  // Head and hair
  r(8, 0, 8, 3, COLORS.attackerHair);
  r(8, 3, 8, 7, COLORS.attackerSkin);
  r(7, 1, 1, 4, COLORS.attackerHair);
  r(16, 1, 1, 4, COLORS.attackerHair);
  // Eyes (facing the camera)
  r(10, 5, 1, 1, '#222');
  r(13, 5, 1, 1, '#222');
  // Neck
  r(11, 10, 2, 2, COLORS.attackerSkin);
  // Shirt
  r(6, 12, 12, 16, COLORS.attackerShirt);
  // Shirt number
  r(11, 16, 2, 6, '#ffffff');
  // Shorts
  r(6, 28, 12, 9, COLORS.attackerShorts);

  if (pose === 'kick') {
    // Arms out for balance
    r(2, 12, 4, 3, COLORS.attackerShirt);
    r(0, 10, 3, 4, COLORS.attackerSkin);
    r(18, 12, 4, 3, COLORS.attackerShirt);
    r(21, 10, 3, 4, COLORS.attackerSkin);
    // Standing leg (left on screen)
    r(6, 37, 5, 14, COLORS.attackerSkin);
    r(6, 51, 5, 9, COLORS.attackerSocks);
    r(5, 60, 7, 4, COLORS.attackerBoots);
    // Kicking leg swung forward and up (to the right)
    r(13, 37, 5, 8, COLORS.attackerSkin);
    r(16, 42, 6, 6, COLORS.attackerSkin);
    r(19, 46, 5, 8, COLORS.attackerSocks);
    r(19, 54, 5, 4, COLORS.attackerBoots);
  } else {
    const swing = pose === 'run1' ? 1 : -1;
    // Arms pumping
    r(3, 12 + (swing > 0 ? 0 : 4), 3, 9, COLORS.attackerShirt);
    r(3, 21 + (swing > 0 ? 0 : 4), 3, 3, COLORS.attackerSkin);
    r(18, 12 + (swing > 0 ? 4 : 0), 3, 9, COLORS.attackerShirt);
    r(18, 21 + (swing > 0 ? 4 : 0), 3, 3, COLORS.attackerSkin);
    // Legs: one forward (long), one trailing (short, bent)
    const lf = swing > 0 ? 6 : 13;  // forward leg x
    const lb = swing > 0 ? 13 : 6;  // back leg x
    r(lf, 37, 5, 14, COLORS.attackerSkin);
    r(lf, 51, 5, 9, COLORS.attackerSocks);
    r(lf - 1, 60, 7, 4, COLORS.attackerBoots);
    r(lb, 37, 5, 9, COLORS.attackerSkin);
    r(lb, 46, 5, 7, COLORS.attackerSocks);
    r(lb - 1, 53, 7, 4, COLORS.attackerBoots);
  }
  return c;
}

/** Goalkeeper seen from behind, standing. */
function drawKeeperIdlePlaceholder() {
  const { placeholderW: W, placeholderH: H } = SPRITES.keeperIdle;
  const c = makeCanvas(W, H);
  const ctx = c.getContext('2d');
  const u = W / 30, v = H / 72;
  const r = (x, y, w, h, col) => px(ctx, col, Math.round(x * u), Math.round(y * v), Math.round(w * u), Math.round(h * v));

  // Head: hair only (we see the back)
  r(11, 0, 8, 8, COLORS.keeperHair);
  r(11, 7, 8, 3, COLORS.keeperSkin);
  // Shirt
  r(8, 10, 14, 20, COLORS.keeperShirt);
  // Number on the back
  r(13, 14, 2, 8, '#ffffff');
  r(16, 14, 2, 8, '#ffffff');
  // Arms slightly out, gloves at the ends
  r(2, 12, 6, 4, COLORS.keeperShirt);
  r(22, 12, 6, 4, COLORS.keeperShirt);
  r(0, 15, 5, 12, COLORS.keeperSkin);
  r(25, 15, 5, 12, COLORS.keeperSkin);
  r(0, 26, 5, 6, COLORS.keeperGloves);
  r(25, 26, 5, 6, COLORS.keeperGloves);
  // Shorts
  r(8, 30, 14, 10, COLORS.keeperShorts);
  // Legs, socks, boots
  r(9, 40, 5, 16, COLORS.keeperSkin);
  r(16, 40, 5, 16, COLORS.keeperSkin);
  r(9, 56, 5, 12, COLORS.keeperShirt);
  r(16, 56, 5, 12, COLORS.keeperShirt);
  r(8, 68, 7, 4, '#222222');
  r(15, 68, 7, 4, '#222222');
  return c;
}

/** Goalkeeper diving to the RIGHT (mirrored in code for left cells). */
function drawKeeperDivePlaceholder() {
  const { placeholderW: W, placeholderH: H } = SPRITES.keeperDive;
  const c = makeCanvas(W, H);
  const ctx = c.getContext('2d');
  const u = W / 80, v = H / 40;
  const r = (x, y, w, h, col) => px(ctx, col, Math.round(x * u), Math.round(y * v), Math.round(w * u), Math.round(h * v));

  // Body lying horizontally, head to the right, feet to the left
  // Boots and legs (left side)
  r(0, 22, 6, 6, '#222222');
  r(0, 30, 6, 6, '#222222');
  r(6, 22, 12, 5, COLORS.keeperShirt);
  r(6, 30, 12, 5, COLORS.keeperShirt);
  r(18, 21, 12, 6, COLORS.keeperSkin);
  r(18, 29, 12, 6, COLORS.keeperSkin);
  // Shorts
  r(30, 18, 10, 18, COLORS.keeperShorts);
  // Torso
  r(40, 16, 20, 18, COLORS.keeperShirt);
  r(45, 20, 8, 2, '#ffffff');
  r(45, 26, 8, 2, '#ffffff');
  // Head
  r(60, 17, 8, 10, COLORS.keeperHair);
  r(61, 27, 6, 3, COLORS.keeperSkin);
  // Arms stretched up-right with gloves
  r(58, 6, 6, 12, COLORS.keeperSkin);
  r(64, 2, 6, 8, COLORS.keeperSkin);
  r(70, 0, 10, 8, COLORS.keeperGloves);
  r(62, 30, 8, 6, COLORS.keeperSkin);
  r(70, 30, 10, 8, COLORS.keeperGloves);
  return c;
}

/** Goalkeeper jumping straight up, arms raised. */
function drawKeeperJumpPlaceholder() {
  const { placeholderW: W, placeholderH: H } = SPRITES.keeperJump;
  const c = makeCanvas(W, H);
  const ctx = c.getContext('2d');
  const u = W / 30, v = H / 88;
  const r = (x, y, w, h, col) => px(ctx, col, Math.round(x * u), Math.round(y * v), Math.round(w * u), Math.round(h * v));

  // Gloves at the top
  r(1, 0, 6, 8, COLORS.keeperGloves);
  r(23, 0, 6, 8, COLORS.keeperGloves);
  // Arms straight up
  r(2, 8, 4, 18, COLORS.keeperSkin);
  r(24, 8, 4, 18, COLORS.keeperSkin);
  r(4, 24, 6, 6, COLORS.keeperShirt);
  r(20, 24, 6, 6, COLORS.keeperShirt);
  // Head
  r(11, 14, 8, 8, COLORS.keeperHair);
  r(11, 21, 8, 3, COLORS.keeperSkin);
  // Shirt
  r(8, 24, 14, 20, COLORS.keeperShirt);
  r(13, 28, 2, 8, '#ffffff');
  r(16, 28, 2, 8, '#ffffff');
  // Shorts
  r(8, 44, 14, 10, COLORS.keeperShorts);
  // Legs tucked a little (bent knees)
  r(8, 54, 5, 12, COLORS.keeperSkin);
  r(17, 54, 5, 12, COLORS.keeperSkin);
  r(7, 66, 6, 12, COLORS.keeperShirt);
  r(17, 66, 6, 12, COLORS.keeperShirt);
  r(5, 78, 8, 5, '#222222');
  r(17, 78, 8, 5, '#222222');
  return c;
}

/** Ball: a white circle with a few dark patches. */
function drawBallPlaceholder() {
  const { placeholderW: W, placeholderH: H } = SPRITES.ball;
  const c = makeCanvas(W, H);
  const ctx = c.getContext('2d');
  const cx = W / 2, cy = H / 2, rad = Math.min(W, H) / 2;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(cx, cy, rad, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#2a2a2a';
  const p = rad * 0.28;
  ctx.fillRect(cx - p / 2, cy - p / 2, p, p);
  ctx.fillRect(cx - rad * 0.75, cy - p * 0.2, p * 0.8, p * 0.8);
  ctx.fillRect(cx + rad * 0.35, cy - rad * 0.55, p * 0.8, p * 0.8);
  ctx.fillRect(cx + rad * 0.2, cy + rad * 0.4, p * 0.8, p * 0.8);
  ctx.fillRect(cx - rad * 0.55, cy + rad * 0.45, p * 0.8, p * 0.8);
  // Outline
  ctx.strokeStyle = '#8a8a8a';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(cx, cy, rad - 0.5, 0, Math.PI * 2);
  ctx.stroke();
  return c;
}

/** Wrap an image or canvas in the common sprite record. */
function record(image, placeholder) {
  return { image, width: image.width, height: image.height, placeholder };
}

/**
 * Load every sprite. Missing files get placeholders. Resolves to an object
 * keyed by sprite name. `goal` and `statsbombLogo` are null when missing (the
 * renderer draws the goal in code and shows a text credit instead).
 */
export async function loadSprites() {
  const names = ['attackerRun1', 'attackerRun2', 'attackerKick', 'keeperIdle',
    'keeperDive', 'keeperJump', 'ball', 'goal', 'statsbombLogo'];

  const images = await Promise.all(names.map((n) => loadImage(ASSET_PATHS[n])));
  const got = {};
  names.forEach((n, i) => { got[n] = images[i]; });

  const sprites = {
    attackerRun1: got.attackerRun1 ? record(got.attackerRun1, false) : record(drawAttackerPlaceholder('run1'), true),
    attackerRun2: got.attackerRun2 ? record(got.attackerRun2, false) : record(drawAttackerPlaceholder('run2'), true),
    attackerKick: got.attackerKick ? record(got.attackerKick, false) : record(drawAttackerPlaceholder('kick'), true),
    keeperIdle: got.keeperIdle ? record(got.keeperIdle, false) : record(drawKeeperIdlePlaceholder(), true),
    keeperDive: got.keeperDive ? record(got.keeperDive, false) : record(drawKeeperDivePlaceholder(), true),
    keeperJump: got.keeperJump ? record(got.keeperJump, false) : record(drawKeeperJumpPlaceholder(), true),
    ball: got.ball ? record(got.ball, false) : record(drawBallPlaceholder(), true),
    goal: got.goal ? record(got.goal, false) : null,
    statsbombLogo: got.statsbombLogo ? record(got.statsbombLogo, false) : null,
  };

  const missing = names.filter((n) => !got[n]);
  if (missing.length) {
    console.info('[Last Line] Using placeholders for missing images: ' + missing.join(', '));
  }
  return sprites;
}

/**
 * Draw a sprite record. anchor = 'bottom' (bottom-centre) or 'centre'.
 * `scale` multiplies the image size; `flip` mirrors it horizontally.
 */
export function drawSprite(ctx, sprite, x, y, scale, { anchor = 'bottom', flip = false, alpha = 1 } = {}) {
  if (!sprite) return;
  const w = sprite.width * scale;
  const h = sprite.height * scale;
  const left = x - w / 2;
  const top = anchor === 'bottom' ? y - h : y - h / 2;

  ctx.save();
  if (alpha !== 1) ctx.globalAlpha = alpha;
  if (flip) {
    ctx.translate(Math.round(left + w), Math.round(top));
    ctx.scale(-1, 1);
    ctx.drawImage(sprite.image, 0, 0, Math.round(w), Math.round(h));
  } else {
    ctx.drawImage(sprite.image, Math.round(left), Math.round(top), Math.round(w), Math.round(h));
  }
  ctx.restore();
}
