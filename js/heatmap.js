// ============================================================================
//  heatmap.js — the end-of-game heatmap: a goal mouth with the 3×3 grid,
//  cell fills by shot count, ✓ saves / ✕ goals per cell, one dot per shot at
//  its real landing point, and a legend. Everything is drawn in code.
// ============================================================================

import { COLORS } from './config.js';
import { drawText } from './text.js';

/** Count shots, saves and goals per cell. */
export function summarise(history) {
  const cells = [];
  for (let row = 0; row < 3; row++) {
    cells.push([]);
    for (let col = 0; col < 3; col++) cells[row].push({ shots: 0, saves: 0, goals: 0 });
  }
  for (const h of history) {
    const c = cells[h.row][h.col];
    c.shots++;
    if (h.saved) c.saves++;
    else c.goals++;
  }
  return cells;
}

/** Blend two RGB arrays. */
function mix(a, b, t) {
  const r = Math.round(a[0] + (b[0] - a[0]) * t);
  const g = Math.round(a[1] + (b[1] - a[1]) * t);
  const bl = Math.round(a[2] + (b[2] - a[2]) * t);
  return `rgb(${r},${g},${bl})`;
}

/** A pixel tick mark drawn in code (the font may lack ✓). */
function drawCheck(ctx, x, y, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y + 3, 1, 1);
  ctx.fillRect(x + 1, y + 4, 1, 1);
  ctx.fillRect(x + 2, y + 5, 1, 1);
  ctx.fillRect(x + 3, y + 4, 1, 1);
  ctx.fillRect(x + 4, y + 3, 1, 1);
  ctx.fillRect(x + 5, y + 2, 1, 1);
  ctx.fillRect(x + 6, y + 1, 1, 1);
}

/** A pixel cross drawn in code (the font may lack ✕). */
function drawCross(ctx, x, y, color) {
  ctx.fillStyle = color;
  for (let i = 0; i < 6; i++) {
    ctx.fillRect(x + i, y + 1 + i, 1, 1);
    ctx.fillRect(x + 5 - i, y + 1 + i, 1, 1);
  }
}

/** A 3×3 dot with a dark outline so it shows on any cell colour. */
function drawDot(ctx, x, y, color) {
  const px = Math.round(x), py = Math.round(y);
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(px - 2, py - 2, 5, 5);
  ctx.fillStyle = color;
  ctx.fillRect(px - 1, py - 1, 3, 3);
}

/**
 * Draw the heatmap for `history` (from Game) inside `rect` = { x, y, w, h }.
 * The rect is the goal mouth; the legend is drawn just below it.
 */
export function drawHeatmap(ctx, rect, history) {
  const cells = summarise(history);
  let most = 0;
  for (const row of cells) for (const c of row) most = Math.max(most, c.shots);

  const cw = rect.w / 3;
  const ch = rect.h / 3;

  // Cell fills
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      const c = cells[row][col];
      const t = most > 0 ? c.shots / most : 0;
      ctx.fillStyle = mix(COLORS.heatLow, COLORS.heatHigh, t);
      ctx.fillRect(Math.round(rect.x + col * cw), Math.round(rect.y + row * ch), Math.ceil(cw), Math.ceil(ch));
    }
  }

  // Grid lines and frame
  ctx.fillStyle = COLORS.heatGrid;
  for (let i = 0; i <= 3; i++) {
    ctx.fillRect(Math.round(rect.x + i * cw), rect.y, 1, rect.h + 1);
    ctx.fillRect(rect.x, Math.round(rect.y + i * ch), rect.w + 1, 1);
  }
  // Posts and crossbar, a little thicker
  ctx.fillStyle = COLORS.post;
  ctx.fillRect(rect.x - 2, rect.y - 2, rect.w + 4, 2);
  ctx.fillRect(rect.x - 2, rect.y - 2, 2, rect.h + 2);
  ctx.fillRect(rect.x + rect.w, rect.y - 2, 2, rect.h + 2);

  // Counts per cell: "✓ 3  ✕ 1"
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      const c = cells[row][col];
      const cx = rect.x + col * cw + cw / 2;
      const cy = rect.y + row * ch + ch / 2;
      // Layout: [check][num]  [cross][num], centred.
      const total = 7 + 2 + 8 + 6 + 7 + 2 + 8; // icon, gap, digit, gap, icon, gap, digit
      let x = Math.round(cx - total / 2);
      const y = Math.round(cy - 4);
      drawCheck(ctx, x, y, COLORS.save);
      x += 9;
      drawText(ctx, String(c.saves), x, y, { size: 8, color: COLORS.save, shadow: true });
      x += 8 + 6;
      drawCross(ctx, x, y, COLORS.goal);
      x += 9;
      drawText(ctx, String(c.goals), x, y, { size: 8, color: COLORS.goal, shadow: true });
    }
  }

  // One dot per shot at its real landing point (u from the left, v from the ground)
  for (const h of history) {
    const x = rect.x + h.u * rect.w;
    const y = rect.y + (1 - h.v) * rect.h;
    drawDot(ctx, x, y, h.saved ? COLORS.save : COLORS.goal);
  }

  // Legend
  const ly = rect.y + rect.h + 8;
  let lx = rect.x;
  drawDot(ctx, lx + 1, ly + 4, COLORS.save);
  drawText(ctx, 'SAVED', lx + 6, ly, { size: 6, color: COLORS.save });
  lx += 6 + 5 * 6 + 10;
  drawDot(ctx, lx + 1, ly + 4, COLORS.goal);
  drawText(ctx, 'CONCEDED', lx + 6, ly, { size: 6, color: COLORS.goal });
  drawText(ctx, 'ONE DOT PER SHOT', rect.x, ly + 10, { size: 6, color: COLORS.hudDim });
}
