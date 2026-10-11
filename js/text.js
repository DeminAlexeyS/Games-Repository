// ============================================================================
//  text.js — pixel-font text helper shared by the renderer and the heatmap.
// ============================================================================

import { FONT, COLORS } from './config.js';

/**
 * Draw a string. Options:
 *   size     font size in logical pixels (8 and 16 look best with the pixel font)
 *   color    fill colour
 *   align    'left' | 'center' | 'right'
 *   baseline 'top' | 'middle' | 'alphabetic' | 'bottom'
 *   shadow   draw a 1-pixel dark shadow (default true)
 *   alpha    transparency 0..1
 */
export function drawText(ctx, str, x, y, {
  size = 8, color = COLORS.hudText, align = 'left', baseline = 'top', shadow = true, alpha = 1,
} = {}) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = `${size}px ${FONT.family}`;
  ctx.textAlign = align;
  ctx.textBaseline = baseline;
  const px = Math.round(x);
  const py = Math.round(y);
  if (shadow) {
    ctx.fillStyle = COLORS.hudShadow;
    const o = Math.max(1, Math.round(size / 8));
    ctx.fillText(str, px + o, py + o);
  }
  ctx.fillStyle = color;
  ctx.fillText(str, px, py);
  ctx.restore();
}

/** Width of a string at a given size. */
export function measureText(ctx, str, size = 8) {
  ctx.save();
  ctx.font = `${size}px ${FONT.family}`;
  const w = ctx.measureText(str).width;
  ctx.restore();
  return w;
}
