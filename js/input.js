// ============================================================================
//  input.js — pointer (mouse, touch, pen) and keyboard input.
//
//  Pointer Events give one code path for every input type. Screen coordinates
//  are converted to logical 480×270 coordinates before the game sees them.
// ============================================================================

/**
 * Attach input handlers.
 * @param canvas     the visible <canvas>
 * @param game       Game instance
 * @param toLogical  (clientX, clientY) → { x, y } in logical pixels
 */
export function attachInput(canvas, game, toLogical) {
  const isMouse = (e) => e.pointerType === 'mouse';

  canvas.addEventListener('pointermove', (e) => {
    const p = toLogical(e.clientX, e.clientY);
    game.pointerMove(p.x, p.y, isMouse(e));
  });

  canvas.addEventListener('pointerdown', (e) => {
    // Only the main button (left click / first finger).
    if (e.button !== undefined && e.button !== 0) return;
    e.preventDefault();
    const p = toLogical(e.clientX, e.clientY);
    try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* not supported */ }
    game.pointerMove(p.x, p.y, isMouse(e));
    game.pointerDown(p.x, p.y, isMouse(e));
  });

  canvas.addEventListener('pointerup', (e) => {
    e.preventDefault();
    const p = toLogical(e.clientX, e.clientY);
    game.pointerUp(p.x, p.y);
    try { canvas.releasePointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    // Touch pointers vanish after lifting, so clear hover state.
    if (!isMouse(e)) game.pointerLeave();
  });

  canvas.addEventListener('pointercancel', () => game.pointerLeave());
  canvas.addEventListener('pointerleave', (e) => {
    if (isMouse(e)) game.pointerLeave();
  });

  // Belt and braces against mobile zoom/scroll: touch-action: none in CSS
  // does most of the work, these stop the few browsers that ignore it.
  const block = (e) => e.preventDefault();
  canvas.addEventListener('touchstart', block, { passive: false });
  canvas.addEventListener('touchmove', block, { passive: false });
  canvas.addEventListener('touchend', block, { passive: false });
  canvas.addEventListener('contextmenu', block);
  document.addEventListener('gesturestart', block, { passive: false });
  document.addEventListener('dblclick', block, { passive: false });

  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (game.keyDown(e.key)) e.preventDefault();
  });
}
