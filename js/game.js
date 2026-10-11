// ============================================================================
//  game.js — state machine and rules. No drawing happens here; render.js
//  reads the public fields of Game every frame and draws them.
//
//  States: LOADING → TITLE → ROUND_SETUP → APPROACH → SHOT → RESULT →
//          (ROUND_SETUP | GAME_OVER) → ROUND_SETUP (play again)
// ============================================================================

import {
  LOGICAL_WIDTH, LOGICAL_HEIGHT, PITCH, PROJECTION, TIMING, RULES, STREAK_TIERS, ATTACKER,
  BALL, KEEPER, GOAL_MOUTH, LAYOUT, SPRITES,
} from './config.js';
import { project } from './projection.js';
import {
  cellCentre, cellFromPoint, cellFromDigit, landingPoint, keeperHome, pointInRect,
} from './geometry.js';

export const STATE = {
  LOADING: 'LOADING',
  TITLE: 'TITLE',
  ROUND_SETUP: 'ROUND_SETUP',
  APPROACH: 'APPROACH',
  SHOT: 'SHOT',
  RESULT: 'RESULT',
  GAME_OVER: 'GAME_OVER',
};

// ---- small maths helpers -------------------------------------------------
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const lerp = (a, b, t) => a + (b - a) * t;
const easeOutQuad = (t) => 1 - (1 - t) * (1 - t);
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

/** Countdown length for a shot taken `d` units from the goal centre. */
export function countdownFor(d) {
  const span = TIMING.distanceFar - TIMING.distanceNear;
  const f = clamp((d - TIMING.distanceNear) / span, 0, 1);
  return TIMING.countdownMin + (TIMING.countdownMax - TIMING.countdownMin) * f;
}

/** Points awarded for a save that brings the streak to `streak`. */
export function pointsForStreak(streak) {
  for (const tier of STREAK_TIERS) {
    if (streak >= tier.from) return tier.points;
  }
  return 0;
}

/**
 * Where the attacker starts his run: `extra` units further from the goal
 * along the line goal-centre → shot spot, clamped so he stays on the pitch.
 */
export function runStartFor(shot, extra = ATTACKER.extraRunDistance) {
  const dx = shot.x - PITCH.goalX;
  const dy = shot.y - PITCH.goalY;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;

  // Shrink the extension until the start point is inside the pitch.
  let e = extra;
  const inside = (x, y) => x >= 0 && x <= PITCH.width && y >= 0 && y <= PITCH.height;
  for (let i = 0; i < 20 && !inside(shot.x + ux * e, shot.y + uy * e); i++) {
    e *= 0.85;
  }
  if (!inside(shot.x + ux * e, shot.y + uy * e)) e = 0;
  return { x: shot.x + ux * e, y: shot.y + uy * e };
}

export class Game {
  /**
   * @param sampler  ShotSampler from data.js
   * @param audio    AudioManager from audio.js
   * @param metrics  { keeperIdleH, keeperDiveH, keeperJumpH } drawn sprite heights (pixels)
   */
  constructor(sampler, audio, metrics) {
    this.sampler = sampler;
    this.audio = audio;
    this.metrics = metrics;

    this.state = STATE.LOADING;
    this.stateTime = 0;       // seconds spent in the current state
    this.error = null;        // loading error message, if any
    this.time = 0;            // total running time (for small animations)

    this.resetStats();
    this.round = null;

    // UI
    this.buttons = [];        // [{ id, x, y, w, h, label }]
    this.hoverButton = null;
    this.pressedButton = null;
    this.pointerIsMouse = false;

    this.updateButtons();
  }

  // -------------------------------------------------------------------------
  //  Game-level flow
  // -------------------------------------------------------------------------

  resetStats() {
    this.score = 0;
    this.streak = 0;
    this.longestStreak = 0;
    this.lives = RULES.lives;
    this.shotsFaced = 0;
    this.saves = 0;
    this.goals = 0;
    this.history = [];        // one entry per shot faced: { u, v, col, row, saved }
  }

  /** Called by main.js once the data is loaded. */
  dataReady() {
    if (this.state === STATE.LOADING) this.setState(STATE.TITLE);
  }

  /** Called by main.js if the data failed to load. */
  dataFailed(message) {
    this.error = message;
  }

  /** Start a brand-new game (from the title screen or "Play again"). */
  startGame() {
    this.resetStats();
    this.sampler.reset();
    this.startRound();
  }

  setState(state) {
    this.state = state;
    this.stateTime = 0;
    this.updateButtons();
  }

  // -------------------------------------------------------------------------
  //  Rounds
  // -------------------------------------------------------------------------

  startRound() {
    const shot = this.sampler.next();
    const start = runStartFor(shot);
    const countdown = countdownFor(shot.distance);
    const home = keeperHome();

    this.round = {
      shot,
      start,
      countdown,
      elapsed: 0,                       // time since the approach began
      remaining: countdown,             // countdown value shown on the HUD
      attacker: { x: start.x, y: start.y, sx: 0, sy: 0, s: 1, frame: 'run1' },
      runClock: 0,
      choice: null,                     // { col, row } chosen by the player
      hover: null,                      // cell under the mouse
      locked: false,                    // true after the kick
      kicked: false,
      target: landingPoint(shot.u, shot.v),
      ball: { x: 0, y: 0, scale: 1, phase: 'feet', vx: 0, vy: 0, from: null, dir: null, visible: true },
      keeper: {
        x: home.x, y: home.y, pose: 'idle', flip: false,
        from: { x: home.x, y: home.y }, to: { x: home.x, y: home.y },
      },
      result: null,                     // 'save' | 'goal'
      points: 0,
      gridAlpha: 1,
      shakeTime: -1,                    // ≥ 0 while the goal frame shakes
      resultCell: null,                 // the cell the keeper actually went to
    };

    this.placeAttacker();
    this.setState(STATE.ROUND_SETUP);
  }

  /** Project the attacker's pitch position to the screen and park the ball at his feet. */
  placeAttacker() {
    const r = this.round;
    const p = project(r.attacker.x, r.attacker.y);
    // Keep the rare corner-flag shots on screen.
    p.sx = clamp(p.sx, PROJECTION.edgeMargin, LOGICAL_WIDTH - PROJECTION.edgeMargin);
    r.attacker.sx = p.sx;
    r.attacker.sy = p.sy;
    r.attacker.s = p.s;
    if (r.ball.phase === 'feet') {
      const scale = SPRITES.attacker.scale * p.s;
      r.ball.x = p.sx + ATTACKER.ballFootOffsetX * scale;
      r.ball.y = p.sy - ATTACKER.ballFootOffsetY * scale;
      r.ball.scale = SPRITES.ball.scale * p.s;
    }
  }

  /** True while the player may still pick a cell. */
  canChoose() {
    return (this.state === STATE.ROUND_SETUP || this.state === STATE.APPROACH) && !this.round.locked;
  }

  choose(cell) {
    if (!cell || !this.canChoose()) return;
    this.round.choice = { col: cell.col, row: cell.row };
  }

  /** The kick: lock input, launch the ball, start the keeper's dive. */
  kick() {
    const r = this.round;
    r.locked = true;
    r.kicked = true;
    r.attacker.x = r.shot.x;
    r.attacker.y = r.shot.y;
    r.attacker.frame = 'kick';
    this.placeAttacker();

    // Resolve the choice: no choice counts as bottom-centre.
    const cell = r.choice || { ...RULES.defaultCell };
    r.resultCell = cell;
    r.result = (cell.col === r.shot.col && cell.row === r.shot.row) ? 'save' : 'goal';

    // Ball launch: from the foot to the real landing point.
    r.ball.from = { x: r.ball.x, y: r.ball.y, scale: r.ball.scale };
    r.ball.phase = 'flight';

    // Keeper: pick a pose and a destination.
    const home = keeperHome();
    const k = r.keeper;
    k.from = { x: home.x, y: home.y };
    if (cell.col === 1 && cell.row === 2) {
      k.pose = 'idle';                  // bottom-centre: stays put
      k.to = { x: home.x, y: home.y };
    } else if (cell.col === 1) {
      k.pose = 'jump';                  // middle/top centre: straight up
      const c = cellCentre(cell.col, cell.row);
      const h = this.metrics.keeperJumpH;
      let y = c.y + h * (1 - KEEPER.jumpReach);
      y = Math.min(y, home.y - KEEPER.minJump);
      k.to = { x: home.x, y };
    } else {
      k.pose = 'dive';                  // any left or right cell
      k.flip = cell.col === 0;          // dive sprite faces right; mirror for left
      const c = cellCentre(cell.col, cell.row);
      const h = this.metrics.keeperDiveH;
      k.to = { x: c.x, y: c.y + h * (1 - KEEPER.diveReach) };
    }

    this.audio.play('kick');
    this.setState(STATE.SHOT);
  }

  /** The ball has arrived: decide, score and show the result. */
  resolveShot() {
    const r = this.round;
    this.shotsFaced++;
    if (r.result === 'save') {
      this.streak++;
      this.longestStreak = Math.max(this.longestStreak, this.streak);
      r.points = pointsForStreak(this.streak);
      this.score += r.points;
      this.saves++;
      this.audio.play('save');
      // Ball drops off the gloves and deflects away from the centre.
      const b = r.ball;
      b.phase = 'drop';
      const side = b.x === GOAL_MOUTH.x + GOAL_MOUTH.w / 2 ? (Math.random() < 0.5 ? -1 : 1)
        : Math.sign(b.x - (GOAL_MOUTH.x + GOAL_MOUTH.w / 2));
      b.vx = side * BALL.deflectSpeed;
      b.vy = -BALL.deflectSpeed * 0.6;
    } else {
      this.streak = 0;
      this.lives--;
      this.goals++;
      this.audio.play('goal');
      // The ball keeps going "into the net": on screen that means a short
      // drift toward the back of the net (which converges toward the middle
      // of the goal in perspective) while it grows a little.
      const b = r.ball;
      b.phase = 'net';
      const backX = GOAL_MOUTH.x + GOAL_MOUTH.w / 2;
      const backY = GOAL_MOUTH.y + GOAL_MOUTH.h * 0.6;
      const dx = backX - b.x;
      const dy = backY - b.y;
      const len = Math.hypot(dx, dy) || 1;
      b.dir = { x: dx / len, y: dy / len };
      b.netStart = { x: b.x, y: b.y };
      r.shakeTime = 0;
    }
    this.history.push({
      u: r.shot.u, v: r.shot.v, col: r.shot.col, row: r.shot.row,
      saved: r.result === 'save',
      choice: r.resultCell,
    });
    this.setState(STATE.RESULT);
  }

  // -------------------------------------------------------------------------
  //  Per-frame update
  // -------------------------------------------------------------------------

  update(dt) {
    this.time += dt;
    this.stateTime += dt;
    const r = this.round;

    switch (this.state) {
      case STATE.ROUND_SETUP:
        if (this.stateTime >= TIMING.setup) {
          this.setState(STATE.APPROACH);
          r.elapsed = 0;
        }
        break;

      case STATE.APPROACH: {
        r.elapsed += dt;
        const progress = clamp(r.elapsed / r.countdown, 0, 1);
        r.remaining = Math.max(0, r.countdown - r.elapsed);
        r.attacker.x = lerp(r.start.x, r.shot.x, progress);
        r.attacker.y = lerp(r.start.y, r.shot.y, progress);
        r.runClock += dt;
        if (r.runClock >= TIMING.runFrame) {
          r.runClock -= TIMING.runFrame;
          r.attacker.frame = r.attacker.frame === 'run1' ? 'run2' : 'run1';
        }
        this.placeAttacker();
        if (r.elapsed >= r.countdown) {
          r.remaining = 0;
          this.kick();
        }
        break;
      }

      case STATE.SHOT: {
        this.updateFlight();
        this.updateKeeper();
        r.gridAlpha = clamp(1 - this.stateTime / TIMING.gridFade, 0, 1);
        if (this.stateTime >= TIMING.flight) {
          this.updateFlight(true);
          this.resolveShot();
        }
        break;
      }

      case STATE.RESULT: {
        this.updateKeeper();
        this.updateBallAfterShot(dt);
        if (r.shakeTime >= 0) {
          r.shakeTime += dt;
          if (r.shakeTime > TIMING.goalShake) r.shakeTime = -1;
        }
        const wait = this.lives <= 0 ? TIMING.result + TIMING.gameOverDelay : TIMING.result;
        if (this.stateTime >= wait) {
          if (this.lives <= 0) this.setState(STATE.GAME_OVER);
          else this.startRound();
        }
        break;
      }

      default:
        break;
    }
  }

  /** Ball in flight: a slight arc from the foot to the landing point, growing. */
  updateFlight(finish = false) {
    const r = this.round;
    const b = r.ball;
    const t = finish ? 1 : clamp(this.stateTime / TIMING.flight, 0, 1);
    b.x = lerp(b.from.x, r.target.x, t);
    b.y = lerp(b.from.y, r.target.y, t) - Math.sin(t * Math.PI) * BALL.arcHeight * lerp(b.from.scale, 1, t);
    b.scale = lerp(b.from.scale, SPRITES.ball.scale, t);
  }

  /** Keeper tween from the goal line to the chosen cell. */
  updateKeeper() {
    const k = this.round.keeper;
    const t = easeOutCubic(clamp(this.stateTime / TIMING.dive, 0, 1));
    // During RESULT, stateTime restarts, so the keeper is simply held at `to`.
    const held = this.state === STATE.RESULT;
    k.x = held ? k.to.x : lerp(k.from.x, k.to.x, t);
    k.y = held ? k.to.y : lerp(k.from.y, k.to.y, t);
  }

  /** After the save or goal: drop off the gloves, or run into the net. */
  updateBallAfterShot(dt) {
    const r = this.round;
    const b = r.ball;
    if (b.phase === 'drop') {
      b.vy += BALL.dropGravity * dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      const ground = GOAL_MOUTH.y + GOAL_MOUTH.h;
      if (b.y > ground) {
        b.y = ground;
        b.vy = -Math.abs(b.vy) * BALL.bounce;
        b.vx *= 0.7;
        if (Math.abs(b.vy) < 10) b.vy = 0;
      }
      if (this.stateTime > TIMING.saveDrop) b.phase = 'rest';
    } else if (b.phase === 'net') {
      const t = clamp(this.stateTime / TIMING.goalSettle, 0, 1);
      const e = easeOutQuad(t);
      b.x = b.netStart.x + b.dir.x * BALL.netTravel * e;
      b.y = b.netStart.y + b.dir.y * BALL.netTravel * e;
      b.scale = SPRITES.ball.scale * lerp(1, BALL.netScale, e);
      if (t >= 1) b.phase = 'rest';
    }
  }

  // -------------------------------------------------------------------------
  //  Buttons (drawn by render.js, hit-tested here)
  // -------------------------------------------------------------------------

  updateButtons() {
    const list = [];
    const cx = LOGICAL_WIDTH / 2;
    if (this.state === STATE.TITLE) {
      const p = LAYOUT.title.play;
      list.push({ id: 'play', label: 'PLAY', x: cx - p.w / 2, y: p.y, w: p.w, h: p.h });
    }
    if (this.state === STATE.GAME_OVER) {
      const p = LAYOUT.gameOver.playAgain;
      list.push({ id: 'playAgain', label: 'PLAY AGAIN', x: cx - p.w / 2, y: p.y, w: p.w, h: p.h });
    }
    if (this.state !== STATE.LOADING) {
      const m = LAYOUT.muteButton;
      list.push({
        id: 'mute', label: '',
        x: LOGICAL_WIDTH - m.w - LAYOUT.hudMargin, y: LOGICAL_HEIGHT - m.h - LAYOUT.hudMargin, w: m.w, h: m.h,
      });
    }
    this.buttons = list;
    this.hoverButton = null;
    this.pressedButton = null;
  }

  buttonAt(x, y) {
    for (const b of this.buttons) {
      if (pointInRect(x, y, b, LAYOUT.buttonHitPad)) return b;
    }
    return null;
  }

  activate(id) {
    if (id === 'play' || id === 'playAgain') {
      this.audio.unlock();
      this.startGame();
    } else if (id === 'mute') {
      this.audio.unlock();
      this.audio.toggleMute();
    }
  }

  // -------------------------------------------------------------------------
  //  Input (called by input.js with LOGICAL coordinates)
  // -------------------------------------------------------------------------

  pointerMove(x, y, isMouse) {
    this.pointerIsMouse = isMouse;
    const b = this.buttonAt(x, y);
    this.hoverButton = b ? b.id : null;
    if (this.round) {
      this.round.hover = (isMouse && this.canChoose()) ? cellFromPoint(x, y) : null;
    }
  }

  pointerDown(x, y, isMouse) {
    this.pointerIsMouse = isMouse;
    const b = this.buttonAt(x, y);
    if (b) {
      this.pressedButton = b.id;
      return;
    }
    if (this.canChoose()) {
      this.choose(cellFromPoint(x, y));
    }
  }

  pointerUp(x, y) {
    const b = this.buttonAt(x, y);
    if (b && this.pressedButton === b.id) this.activate(b.id);
    this.pressedButton = null;
  }

  pointerLeave() {
    this.hoverButton = null;
    this.pressedButton = null;
    if (this.round) this.round.hover = null;
  }

  /** Keyboard: 1–9 pick a cell (numpad layout), Enter/Space = Play, M = mute. */
  keyDown(key) {
    if (key >= '1' && key <= '9') {
      this.choose(cellFromDigit(Number(key)));
      return true;
    }
    if (key === 'Enter' || key === ' ') {
      if (this.state === STATE.TITLE) { this.activate('play'); return true; }
      if (this.state === STATE.GAME_OVER) { this.activate('playAgain'); return true; }
    }
    if (key === 'm' || key === 'M') {
      this.activate('mute');
      return true;
    }
    return false;
  }

  // -------------------------------------------------------------------------
  //  Read-only helpers for the renderer
  // -------------------------------------------------------------------------

  /** Points the NEXT save would be worth (the HUD multiplier). */
  nextMultiplier() {
    return pointsForStreak(this.streak + 1);
  }

  /** True while the countdown is shown. */
  inRound() {
    return this.round && (this.state === STATE.ROUND_SETUP || this.state === STATE.APPROACH ||
      this.state === STATE.SHOT || this.state === STATE.RESULT);
  }

  /** Current goal-frame shake offset in pixels. */
  shakeOffset() {
    const r = this.round;
    if (!r || r.shakeTime < 0) return { x: 0, y: 0 };
    const f = 1 - r.shakeTime / TIMING.goalShake;
    const a = KEEPER.shakeAmplitude * f;
    return { x: Math.sin(r.shakeTime * 60) * a, y: Math.cos(r.shakeTime * 47) * a * 0.6 };
  }
}
