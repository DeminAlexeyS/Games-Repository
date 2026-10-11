// ============================================================================
//  render.js — all drawing. Reads the Game object; never changes it.
//
//  Draw order each frame:
//    sky & stands → pitch (stripes, lines) → attacker (+ ball at his feet)
//    → net (faint) → keeper → posts & crossbar → ball in flight / after shot
//    → grid overlay → HUD / banners / screens
// ============================================================================

import {
  LOGICAL_WIDTH, LOGICAL_HEIGHT, PITCH, PROJECTION, GOAL_MOUTH, GOAL_IMAGE, GOAL_PLACEHOLDER,
  TIMING, COLORS, LAYOUT, SPRITES, DEBUG, RULES,
} from './config.js';
import { projectDL } from './projection.js';
import { cellRect, digitForCell } from './geometry.js';
import { drawSprite } from './sprites.js';
import { drawText, measureText } from './text.js';
import { drawHeatmap } from './heatmap.js';
import { STATE } from './game.js';

const W = LOGICAL_WIDTH;
const H = LOGICAL_HEIGHT;

/** Build a renderer bound to a set of sprites. Returns render(ctx, game). */
export function createRenderer(sprites) {
  const crowd = buildCrowd();

  function render(ctx, game) {
    ctx.imageSmoothingEnabled = false;
    drawBackground(ctx, crowd);
    drawPitch(ctx);

    const shake = game.shakeOffset();

    if (game.inRound()) {
      drawAttackerAndBall(ctx, game, 'behind');
    }

    // Goal net (behind the keeper), keeper, then the posts in front.
    drawGoalNet(ctx, shake);
    if (game.inRound()) drawKeeper(ctx, game);
    drawGoalFrame(ctx, shake);

    if (game.inRound()) {
      drawAttackerAndBall(ctx, game, 'front');
      drawGrid(ctx, game);
    }

    if (DEBUG.showGoalMouth) {
      ctx.strokeStyle = '#ff00ff';
      ctx.lineWidth = 1;
      ctx.strokeRect(GOAL_MOUTH.x + 0.5, GOAL_MOUTH.y + 0.5, GOAL_MOUTH.w, GOAL_MOUTH.h);
    }

    switch (game.state) {
      case STATE.LOADING: drawLoading(ctx, game); break;
      case STATE.TITLE: drawTitle(ctx, game); break;
      case STATE.GAME_OVER: drawGameOver(ctx, game); break;
      default:
        drawHUD(ctx, game);
        if (game.state === STATE.RESULT) drawBanner(ctx, game);
        break;
    }

    if (game.state !== STATE.LOADING) drawMuteButton(ctx, game);
    if (DEBUG.showShotInfo && game.round) drawShotInfo(ctx, game);
  }

  // -------------------------------------------------------------------------
  //  Background: sky, stands and crowd
  // -------------------------------------------------------------------------

  function buildCrowd() {
    // A band of random coloured 2×2 blocks, pre-rendered once.
    const top = 22;
    const c = document.createElement('canvas');
    c.width = W;
    c.height = PROJECTION.horizonY - top;
    const g = c.getContext('2d');
    g.fillStyle = COLORS.standsDark;
    g.fillRect(0, 0, c.width, c.height);
    for (let y = 0; y < c.height; y += 2) {
      // alternate tiers of seats
      const tierDark = Math.floor(y / 8) % 2 === 0;
      for (let x = 0; x < c.width; x += 2) {
        const r = Math.random();
        if (r < 0.55) {
          g.fillStyle = COLORS.crowd[Math.floor(Math.random() * COLORS.crowd.length)];
        } else {
          g.fillStyle = tierDark ? COLORS.standsDark : COLORS.standsLight;
        }
        g.fillRect(x, y, 2, 2);
      }
    }
    return { canvas: c, top };
  }

  function drawBackground(ctx, crowd) {
    ctx.fillStyle = COLORS.sky;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = COLORS.skyLow;
    ctx.fillRect(0, crowd.top - 10, W, 10);
    ctx.drawImage(crowd.canvas, 0, crowd.top);
    // Stand edge / advertising board line at the horizon
    ctx.fillStyle = '#1b1f33';
    ctx.fillRect(0, PROJECTION.horizonY - 2, W, 3);
  }

  // -------------------------------------------------------------------------
  //  Pitch
  // -------------------------------------------------------------------------

  function drawPitch(ctx) {
    const { horizonY, goalLineY } = PROJECTION;

    // Grass between the horizon and the goal line, striped by depth.
    ctx.fillStyle = COLORS.grassA;
    ctx.fillRect(0, horizonY, W, goalLineY - horizonY);
    let stripe = 0;
    for (let depth = 0; depth < PITCH.width; depth += PITCH.stripeDepth) {
      const near = projectDL(depth, 0).sy;
      const far = projectDL(depth + PITCH.stripeDepth, 0).sy;
      ctx.fillStyle = stripe % 2 === 0 ? COLORS.grassA : COLORS.grassB;
      ctx.fillRect(0, Math.round(far), W, Math.round(near) - Math.round(far));
      stripe++;
    }
    // Grass between the goal line and the camera.
    ctx.fillStyle = COLORS.grassNear;
    ctx.fillRect(0, goalLineY, W, H - goalLineY);

    // Pitch markings
    ctx.strokeStyle = COLORS.pitchLine;
    ctx.fillStyle = COLORS.pitchLine;
    ctx.lineWidth = 1;
    const half = PITCH.height / 2;

    // Goal line (depth 0) and the far end.
    line(ctx, projectDL(0, -half), projectDL(0, half));
    line(ctx, projectDL(PITCH.width, -half), projectDL(PITCH.width, half));
    // Touchlines
    line(ctx, projectDL(0, -half), projectDL(PITCH.width, -half));
    line(ctx, projectDL(0, half), projectDL(PITCH.width, half));
    // Halfway line and centre circle
    line(ctx, projectDL(PITCH.halfwayDepth, -half), projectDL(PITCH.halfwayDepth, half));
    circle(ctx, PITCH.halfwayDepth, 0, PITCH.centreCircle, 0, Math.PI * 2);
    // Six-yard box
    box(ctx, PITCH.sixYardDepth, PITCH.sixYardHalf);
    // Penalty box
    box(ctx, PITCH.boxDepth, PITCH.boxHalf);
    // Penalty spot
    const spot = projectDL(PITCH.penaltySpot, 0);
    ctx.fillRect(Math.round(spot.sx) - 1, Math.round(spot.sy) - 1, 2, 2);
    // The "D": the part of the circle around the spot that lies outside the box.
    const dAngle = Math.acos((PITCH.boxDepth - PITCH.penaltySpot) / PITCH.arcRadius);
    circle(ctx, PITCH.penaltySpot, 0, PITCH.arcRadius, -dAngle, dAngle);
    // Far-end boxes, drawn for completeness (tiny near the horizon).
    farBox(ctx, PITCH.boxDepth, PITCH.boxHalf);
  }

  function line(ctx, a, b) {
    ctx.beginPath();
    ctx.moveTo(Math.round(a.sx) + 0.5, Math.round(a.sy) + 0.5);
    ctx.lineTo(Math.round(b.sx) + 0.5, Math.round(b.sy) + 0.5);
    ctx.stroke();
  }

  /** Rectangle from the goal line to `depth`, ±`halfWidth` lateral. */
  function box(ctx, depth, halfWidth) {
    const a = projectDL(0, -halfWidth);
    const b = projectDL(depth, -halfWidth);
    const c = projectDL(depth, halfWidth);
    const d = projectDL(0, halfWidth);
    line(ctx, a, b);
    line(ctx, b, c);
    line(ctx, c, d);
  }

  function farBox(ctx, depth, halfWidth) {
    const a = projectDL(PITCH.width, -halfWidth);
    const b = projectDL(PITCH.width - depth, -halfWidth);
    const c = projectDL(PITCH.width - depth, halfWidth);
    const d = projectDL(PITCH.width, halfWidth);
    line(ctx, a, b);
    line(ctx, b, c);
    line(ctx, c, d);
  }

  /** A circle (or arc) on the pitch, centred at (depth, lateral), projected point by point. */
  function circle(ctx, depth, lateral, radius, from, to) {
    ctx.beginPath();
    const steps = 32;
    for (let i = 0; i <= steps; i++) {
      const a = from + (to - from) * (i / steps);
      // angle 0 points away from the goal (toward greater depth)
      const p = projectDL(depth + Math.cos(a) * radius, lateral + Math.sin(a) * radius);
      if (i === 0) ctx.moveTo(p.sx, p.sy);
      else ctx.lineTo(p.sx, p.sy);
    }
    ctx.stroke();
  }

  // -------------------------------------------------------------------------
  //  Goal
  // -------------------------------------------------------------------------

  function drawGoalNet(ctx, shake) {
    ctx.save();
    ctx.translate(Math.round(shake.x), Math.round(shake.y));
    if (sprites.goal) {
      // Real art: drawn as one image behind the keeper.
      const s = GOAL_IMAGE.scale * SPRITES.goal.scale;
      ctx.drawImage(sprites.goal.image, GOAL_IMAGE.x, GOAL_IMAGE.y,
        Math.round(sprites.goal.width * s), Math.round(sprites.goal.height * s));
    } else {
      const m = GOAL_MOUTH;
      const d = GOAL_PLACEHOLDER.netDepth;
      const sp = GOAL_PLACEHOLDER.netSpacing;
      ctx.globalAlpha = GOAL_PLACEHOLDER.netAlpha;
      ctx.strokeStyle = COLORS.net;
      ctx.lineWidth = 1;
      // Back panel of the net: a smaller rectangle "behind" the mouth.
      const bx = m.x + d, by = m.y + d * 0.6, bw = m.w - d * 2, bh = m.h - d * 0.6;
      ctx.beginPath();
      for (let x = 0; x <= bw; x += sp) {
        ctx.moveTo(bx + x + 0.5, by);
        ctx.lineTo(bx + x + 0.5, by + bh);
      }
      for (let y = 0; y <= bh; y += sp) {
        ctx.moveTo(bx, by + y + 0.5);
        ctx.lineTo(bx + bw, by + y + 0.5);
      }
      // Side panels: lines from the posts to the back panel.
      for (let y = 0; y <= m.h; y += sp) {
        const t = y / m.h;
        ctx.moveTo(m.x, m.y + y + 0.5);
        ctx.lineTo(bx, by + t * bh + 0.5);
        ctx.moveTo(m.x + m.w, m.y + y + 0.5);
        ctx.lineTo(bx + bw, by + t * bh + 0.5);
      }
      // Roof panel: lines from the crossbar to the back top edge.
      for (let x = 0; x <= m.w; x += sp) {
        const t = x / m.w;
        ctx.moveTo(m.x + x + 0.5, m.y);
        ctx.lineTo(bx + t * bw + 0.5, by);
      }
      ctx.stroke();
      // Net floor shading
      ctx.globalAlpha = 0.12;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(m.x, m.y, m.w, m.h);
    }
    ctx.restore();
  }

  function drawGoalFrame(ctx, shake) {
    if (sprites.goal) return; // the image already includes the posts
    const m = GOAL_MOUTH;
    const t = GOAL_PLACEHOLDER.postWidth;
    ctx.save();
    ctx.translate(Math.round(shake.x), Math.round(shake.y));
    // Posts and crossbar, with a shaded edge
    ctx.fillStyle = COLORS.post;
    ctx.fillRect(m.x - t, m.y - t, t, m.h + t + 2);          // left post
    ctx.fillRect(m.x + m.w, m.y - t, t, m.h + t + 2);        // right post
    ctx.fillRect(m.x - t, m.y - t, m.w + t * 2, t);          // crossbar
    ctx.fillStyle = COLORS.postShade;
    ctx.fillRect(m.x - 1, m.y - t, 1, m.h + t + 2);
    ctx.fillRect(m.x + m.w + t - 1, m.y - t, 1, m.h + t + 2);
    ctx.fillRect(m.x - t, m.y - 1, m.w + t * 2, 1);
    ctx.restore();
  }

  // -------------------------------------------------------------------------
  //  Attacker, ball and keeper
  // -------------------------------------------------------------------------

  /**
   * layer = 'behind': the attacker, and the ball while it is at his feet.
   * layer = 'front':  the ball once it is in the air or in the goal.
   */
  function drawAttackerAndBall(ctx, game, layer) {
    const r = game.round;
    const a = r.attacker;
    const b = r.ball;
    if (layer === 'behind') {
      const frameSprite = a.frame === 'kick' ? sprites.attackerKick
        : a.frame === 'run2' ? sprites.attackerRun2 : sprites.attackerRun1;
      // Shadow
      const scale = SPRITES.attacker.scale * a.s;
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(Math.round(a.sx - 8 * scale), Math.round(a.sy - 1), Math.round(16 * scale), 2);
      drawSprite(ctx, frameSprite, a.sx, a.sy, scale, { anchor: 'bottom' });
      if (b.phase === 'feet') {
        drawSprite(ctx, sprites.ball, b.x, b.y, b.scale, { anchor: 'centre' });
      }
    } else if (b.phase !== 'feet') {
      drawSprite(ctx, sprites.ball, b.x, b.y, b.scale, { anchor: 'centre' });
    }
  }

  function drawKeeper(ctx, game) {
    const k = game.round.keeper;
    let sprite = sprites.keeperIdle;
    let scale = SPRITES.keeperIdle.scale;
    if (k.pose === 'dive') { sprite = sprites.keeperDive; scale = SPRITES.keeperDive.scale; }
    if (k.pose === 'jump') { sprite = sprites.keeperJump; scale = SPRITES.keeperJump.scale; }
    drawSprite(ctx, sprite, k.x, k.y, scale, { anchor: 'bottom', flip: k.flip });
  }

  // -------------------------------------------------------------------------
  //  3×3 grid overlay
  // -------------------------------------------------------------------------

  function drawGrid(ctx, game) {
    const r = game.round;
    const alpha = r.gridAlpha;
    if (alpha <= 0) return;
    ctx.save();
    ctx.globalAlpha = alpha;

    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 3; col++) {
        const c = cellRect(col, row);
        const selected = r.choice && r.choice.col === col && r.choice.row === row;
        const hovered = r.hover && r.hover.col === col && r.hover.row === row;
        ctx.fillStyle = selected ? COLORS.gridSelected : hovered ? COLORS.gridHover : COLORS.gridFill;
        ctx.fillRect(Math.round(c.x), Math.round(c.y), Math.round(c.w), Math.round(c.h));
        // Keypad digit, faint, in the corner
        drawText(ctx, String(digitForCell(col, row)), c.x + 3, c.y + 3,
          { size: 6, color: COLORS.gridNumber, shadow: false });
      }
    }
    // Grid lines
    ctx.fillStyle = COLORS.gridLine;
    for (let i = 0; i <= 3; i++) {
      const x = Math.round(GOAL_MOUTH.x + i * GOAL_MOUTH.w / 3);
      const y = Math.round(GOAL_MOUTH.y + i * GOAL_MOUTH.h / 3);
      ctx.fillRect(x, GOAL_MOUTH.y, 1, GOAL_MOUTH.h);
      ctx.fillRect(GOAL_MOUTH.x, y, GOAL_MOUTH.w, 1);
    }
    // Strong outline on the selected cell
    if (r.choice) {
      const c = cellRect(r.choice.col, r.choice.row);
      ctx.strokeStyle = COLORS.gridSelectedLine;
      ctx.lineWidth = 2;
      ctx.strokeRect(Math.round(c.x) + 1, Math.round(c.y) + 1, Math.round(c.w) - 2, Math.round(c.h) - 2);
    }
    ctx.restore();
  }

  // -------------------------------------------------------------------------
  //  HUD
  // -------------------------------------------------------------------------

  function drawHUD(ctx, game) {
    const m = LAYOUT.hudMargin;

    // Dark strip behind the HUD so the text reads over the crowd.
    ctx.fillStyle = COLORS.hudBand;
    ctx.fillRect(0, 0, W, LAYOUT.hudBandHeight);

    // Score (top-left) and streak / multiplier line under it
    drawText(ctx, `SCORE ${game.score}`, m, m, { size: LAYOUT.scoreSize });
    const mult = game.nextMultiplier();
    const hot = mult > 1;
    drawText(ctx, `STREAK ${game.streak} x${mult}`, m, m + LAYOUT.scoreSize + 4,
      { size: LAYOUT.streakSize, color: hot ? COLORS.multiplierHot : COLORS.hudDim });

    // Countdown (top-centre)
    const r = game.round;
    const showCountdown = game.state === STATE.ROUND_SETUP || game.state === STATE.APPROACH;
    if (showCountdown) {
      const remaining = game.state === STATE.ROUND_SETUP ? r.countdown : r.remaining;
      const warn = remaining <= TIMING.warning;
      const color = warn ? COLORS.countdownWarning : COLORS.countdown;
      drawText(ctx, remaining.toFixed(1), W / 2, m, { size: LAYOUT.countdownSize, color, align: 'center' });
      const bar = LAYOUT.countdownBar;
      const frac = r.countdown > 0 ? remaining / r.countdown : 0;
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(W / 2 - bar.w / 2 - 1, bar.y - 1, bar.w + 2, bar.h + 2);
      ctx.fillStyle = color;
      ctx.fillRect(W / 2 - bar.w / 2, bar.y, Math.round(bar.w * frac), bar.h);
    }

    // Lives (top-right): one ball icon per life
    const icon = LAYOUT.lifeIcon;
    for (let i = 0; i < RULES.lives; i++) {
      const x = W - m - icon.size - i * (icon.size + icon.gap);
      const alive = i < game.lives;
      drawLifeIcon(ctx, x, m, icon.size, alive);
    }
  }

  function drawLifeIcon(ctx, x, y, size, alive) {
    const cx = x + size / 2, cy = y + size / 2, rad = size / 2;
    ctx.fillStyle = COLORS.hudShadow;
    ctx.beginPath();
    ctx.arc(cx + 1, cy + 1, rad, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = alive ? COLORS.lifeFull : COLORS.lifeLost;
    ctx.beginPath();
    ctx.arc(cx, cy, rad, 0, Math.PI * 2);
    ctx.fill();
    if (alive) {
      ctx.fillStyle = '#2a2a2a';
      ctx.fillRect(Math.round(cx) - 1, Math.round(cy) - 1, 2, 2);
    }
  }

  function drawBanner(ctx, game) {
    const r = game.round;
    const pop = Math.min(1, game.stateTime / TIMING.bannerPop);
    const scale = 0.6 + 0.4 * (1 - Math.pow(1 - pop, 3));
    const isSave = r.result === 'save';
    const text = isSave ? `SAVE! +${r.points}` : 'GOAL!';
    const color = isSave ? COLORS.save : COLORS.goal;
    const size = LAYOUT.bannerSize;
    const width = measureText(ctx, text, size) * scale + 24;
    const height = size * scale + 16;
    const x = W / 2, y = LAYOUT.bannerY;
    ctx.fillStyle = COLORS.bannerShadow;
    ctx.fillRect(Math.round(x - width / 2), Math.round(y - height / 2), Math.round(width), Math.round(height));
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    drawText(ctx, text, 0, 0, { size, color, align: 'center', baseline: 'middle' });
    ctx.restore();
  }

  // -------------------------------------------------------------------------
  //  Buttons
  // -------------------------------------------------------------------------

  function drawButton(ctx, game, b, size = 8) {
    const pressed = game.pressedButton === b.id;
    const hovered = game.hoverButton === b.id && game.pointerIsMouse;
    const face = pressed ? COLORS.buttonPressed : hovered ? COLORS.buttonHover : COLORS.buttonFace;
    const lift = pressed ? 0 : 2;
    // Edge (drawn as a block under the face for a chunky 3D look)
    ctx.fillStyle = COLORS.buttonEdge;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = face;
    ctx.fillRect(b.x, b.y - lift, b.w, b.h - 2 + (pressed ? 2 : 0));
    // Highlight line
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillRect(b.x + 2, b.y - lift + 2, b.w - 4, 1);
    drawText(ctx, b.label, b.x + b.w / 2, b.y - lift + (b.h - 2) / 2,
      { size, color: COLORS.buttonText, align: 'center', baseline: 'middle' });
  }

  function drawMuteButton(ctx, game) {
    const b = game.buttons.find((x) => x.id === 'mute');
    if (!b) return;
    const pressed = game.pressedButton === 'mute';
    const hovered = game.hoverButton === 'mute' && game.pointerIsMouse;
    ctx.fillStyle = COLORS.buttonEdge;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = pressed ? COLORS.buttonPressed : hovered ? COLORS.buttonHover : COLORS.buttonFace;
    ctx.fillRect(b.x + 1, b.y + 1, b.w - 2, b.h - 2);
    // Speaker icon
    const cx = b.x + b.w / 2 - 3, cy = b.y + b.h / 2;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(cx - 5, cy - 2, 3, 4);
    ctx.fillRect(cx - 2, cy - 4, 2, 8);
    ctx.fillRect(cx, cy - 5, 1, 10);
    if (game.audio.muted) {
      ctx.fillStyle = COLORS.goal;
      for (let i = 0; i < 6; i++) {
        ctx.fillRect(cx + 3 + i, cy - 3 + i, 1, 1);
        ctx.fillRect(cx + 8 - i, cy - 3 + i, 1, 1);
      }
    } else {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(cx + 3, cy - 2, 1, 4);
      ctx.fillRect(cx + 5, cy - 4, 1, 8);
      ctx.fillRect(cx + 7, cy - 6, 1, 12);
    }
  }

  // -------------------------------------------------------------------------
  //  Screens
  // -------------------------------------------------------------------------

  function drawPanel(ctx, x, y, w, h) {
    ctx.fillStyle = COLORS.panel;
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = COLORS.panelEdge;
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  }

  function drawLoading(ctx, game) {
    drawPanel(ctx, 40, 90, W - 80, 90);
    if (game.error) {
      drawText(ctx, 'COULD NOT LOAD SHOT DATA', W / 2, 104, { size: 8, color: COLORS.goal, align: 'center' });
      wrapText(ctx, game.error, W / 2, 124, W - 110, 6, COLORS.hudText);
    } else {
      const dots = '.'.repeat(1 + Math.floor(game.time * 3) % 3);
      drawText(ctx, 'LOADING' + dots, W / 2, 128, { size: 12, align: 'center' });
    }
  }

  /** Simple word wrap for the error message. */
  function wrapText(ctx, text, cx, y, maxWidth, size, color) {
    const words = text.split(' ');
    let lineText = '';
    const lines = [];
    for (const w of words) {
      const test = lineText ? lineText + ' ' + w : w;
      if (measureText(ctx, test, size) > maxWidth && lineText) {
        lines.push(lineText);
        lineText = w;
      } else {
        lineText = test;
      }
    }
    if (lineText) lines.push(lineText);
    lines.forEach((l, i) => drawText(ctx, l, cx, y + i * (size + 4), { size, color, align: 'center' }));
  }

  function drawTitle(ctx, game) {
    const L = LAYOUT.title;
    drawPanel(ctx, 40, 50, W - 80, 170);
    // Title with a little bob
    const bob = Math.round(Math.sin(game.time * 2) * 2);
    drawText(ctx, 'LAST LINE', W / 2, L.titleY + bob, { size: L.titleSize, color: COLORS.title, align: 'center' });
    drawText(ctx, "YOU'RE THE KEEPER. READ THE SHOT. PICK A ZONE.", W / 2, L.taglineY,
      { size: L.taglineSize, align: 'center' });
    for (const b of game.buttons) {
      if (b.id === 'play') drawButton(ctx, game, b, 12);
    }
    drawText(ctx, 'TAP A ZONE  ·  KEYS 1-9  ·  M = MUTE', W / 2, L.hintY,
      { size: L.hintSize, color: COLORS.hudDim, align: 'center' });

    // StatsBomb credit
    if (sprites.statsbombLogo) {
      const logo = sprites.statsbombLogo;
      const box = SPRITES.statsbombLogo;
      const s = Math.min(box.maxWidth / logo.width, box.maxHeight / logo.height, 1);
      const lw = Math.round(logo.width * s), lh = Math.round(logo.height * s);
      drawText(ctx, 'SHOT DATA:', W / 2 - lw / 2 - 6, L.creditY + lh / 2,
        { size: 6, color: COLORS.hudDim, align: 'right', baseline: 'middle' });
      ctx.drawImage(logo.image, Math.round(W / 2 - lw / 2 + 24), Math.round(L.creditY), lw, lh);
    } else {
      drawText(ctx, 'DATA: STATSBOMB', W / 2, L.creditY + 8, { size: 6, color: COLORS.hudDim, align: 'center' });
    }
  }

  function drawGameOver(ctx, game) {
    const L = LAYOUT.gameOver;
    drawPanel(ctx, 12, 8, W - 24, H - 16);
    drawText(ctx, 'GAME OVER', W / 2, L.titleY, { size: L.titleSize, color: COLORS.goal, align: 'center' });

    const rows = [
      ['SCORE', String(game.score), COLORS.title],
      ['BEST STREAK', String(game.longestStreak), COLORS.hudText],
      ['SHOTS FACED', String(game.shotsFaced), COLORS.hudText],
      ['SAVES', String(game.saves), COLORS.save],
      ['GOALS', String(game.goals), COLORS.goal],
    ];
    rows.forEach(([label, value, color], i) => {
      const y = L.statsY + i * L.statsGap;
      drawText(ctx, label, L.statsX, y, { size: L.statsSize, color: COLORS.hudDim });
      drawText(ctx, value, L.statsX + 190, y, { size: L.statsSize, color, align: 'right' });
    });

    drawText(ctx, 'WHERE THE SHOTS WENT', L.heatmap.x + L.heatmap.w / 2, L.heatmap.y - 12,
      { size: 6, color: COLORS.hudDim, align: 'center' });
    drawHeatmap(ctx, L.heatmap, game.history);

    for (const b of game.buttons) {
      if (b.id === 'playAgain') drawButton(ctx, game, b, 10);
    }
  }

  function drawShotInfo(ctx, game) {
    const s = game.round.shot;
    drawText(ctx, `x ${s.x} y ${s.y} d ${s.distance.toFixed(1)} col ${s.col} row ${s.row} u ${s.u} v ${s.v}`,
      4, H - 10, { size: 6 });
  }

  return render;
}
