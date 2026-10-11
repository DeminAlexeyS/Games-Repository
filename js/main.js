// ============================================================================
//  main.js — boot: load the font, sprites and shot data, size the canvas,
//  wire up input and run the game loop.
// ============================================================================

import {
  LOGICAL_WIDTH, LOGICAL_HEIGHT, SNAP_INTEGER_SCALE, MAX_DELTA, FONT, SPRITES,
} from './config.js';
import { loadShots, ShotSampler } from './data.js';
import { loadSprites } from './sprites.js';
import { AudioManager } from './audio.js';
import { Game } from './game.js';
import { createRenderer } from './render.js';
import { attachInput } from './input.js';

// ---------------------------------------------------------------------------
//  Canvas setup
//
//  The game draws into an offscreen 480×270 "buffer" canvas, which is then
//  copied onto the visible canvas with image smoothing off. That keeps the
//  pixels crisp at any window size and device pixel ratio.
// ---------------------------------------------------------------------------
const screen = document.getElementById('game');
const screenCtx = screen.getContext('2d');
const buffer = document.createElement('canvas');
buffer.width = LOGICAL_WIDTH;
buffer.height = LOGICAL_HEIGHT;
const ctx = buffer.getContext('2d');

const overlay = document.getElementById('overlay');

// Current mapping from CSS pixels to logical pixels.
let view = { left: 0, top: 0, cssWidth: LOGICAL_WIDTH, cssHeight: LOGICAL_HEIGHT };

function resize() {
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const winW = window.innerWidth;
  const winH = window.innerHeight;
  let scale = Math.min(winW / LOGICAL_WIDTH, winH / LOGICAL_HEIGHT);
  if (SNAP_INTEGER_SCALE && scale >= 1) scale = Math.floor(scale);

  const cssWidth = Math.floor(LOGICAL_WIDTH * scale);
  const cssHeight = Math.floor(LOGICAL_HEIGHT * scale);
  screen.style.width = cssWidth + 'px';
  screen.style.height = cssHeight + 'px';
  screen.width = Math.round(cssWidth * dpr);
  screen.height = Math.round(cssHeight * dpr);
  screenCtx.imageSmoothingEnabled = false;

  const rect = screen.getBoundingClientRect();
  view = { left: rect.left, top: rect.top, cssWidth, cssHeight };
}

/** Convert a client (CSS pixel) position to logical game coordinates. */
function toLogical(clientX, clientY) {
  const rect = screen.getBoundingClientRect();
  return {
    x: (clientX - rect.left) / rect.width * LOGICAL_WIDTH,
    y: (clientY - rect.top) / rect.height * LOGICAL_HEIGHT,
  };
}

window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 100));
resize();

// ---------------------------------------------------------------------------
//  Boot
// ---------------------------------------------------------------------------
async function boot() {
  const audio = new AudioManager();

  // Wait briefly for the pixel font so the first frame uses it; start anyway
  // if it is slow or blocked.
  await Promise.race([
    (document.fonts && document.fonts.load ? document.fonts.load('8px "Press Start 2P"') : Promise.resolve()).catch(() => {}),
    new Promise((resolve) => setTimeout(resolve, FONT.loadTimeout * 1000)),
  ]);

  const sprites = await loadSprites();
  const render = createRenderer(sprites);

  // Drawn sprite heights, needed by the game to aim the keeper's dive/jump.
  const metrics = {
    keeperIdleH: sprites.keeperIdle.height * SPRITES.keeperIdle.scale,
    keeperDiveH: sprites.keeperDive.height * SPRITES.keeperDive.scale,
    keeperJumpH: sprites.keeperJump.height * SPRITES.keeperJump.scale,
  };

  // The sampler gets its shots once the data arrives; the game starts in
  // LOADING and shows a loading screen until then.
  const sampler = new ShotSampler([]);
  const game = new Game(sampler, audio, metrics);
  attachInput(screen, game, toLogical);

  // Expose for debugging in the browser console (harmless in production).
  window.lastLine = { game, sampler, audio, sprites };

  // ---- game loop --------------------------------------------------------
  let last = performance.now();
  let paused = false;

  function frame(now) {
    const dt = Math.min(MAX_DELTA, Math.max(0, (now - last) / 1000));
    last = now;
    if (!paused) {
      game.update(dt);
      render(ctx, game);
      screenCtx.imageSmoothingEnabled = false;
      screenCtx.drawImage(buffer, 0, 0, screen.width, screen.height);
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // Pause when the tab is hidden; on return, skip the time that passed.
  document.addEventListener('visibilitychange', () => {
    paused = document.hidden;
    if (!paused) last = performance.now();
  });

  // ---- data -------------------------------------------------------------
  try {
    const shots = await loadShots();
    sampler.shots = shots;
    sampler.reset();
    game.dataReady();
    overlay.hidden = true;
  } catch (err) {
    console.error(err);
    game.dataFailed(err.message);
    overlay.hidden = false;
    overlay.innerHTML = '';
    const h = document.createElement('p');
    h.className = 'overlay-title';
    h.textContent = 'Could not load the shot data';
    const p = document.createElement('p');
    p.textContent = err.message;
    const hint = document.createElement('p');
    hint.className = 'overlay-hint';
    hint.textContent = 'Serve the folder over HTTP (e.g. "python3 -m http.server 8000", then open http://localhost:8000). Opening index.html as a file will not work.';
    overlay.append(h, p, hint);
  }
}

boot().catch((err) => {
  console.error(err);
  overlay.hidden = false;
  overlay.textContent = 'Something went wrong while starting the game: ' + err.message;
});
