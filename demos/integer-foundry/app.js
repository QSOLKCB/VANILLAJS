// SPDX-License-Identifier: Apache-2.0
import {IntegerClock} from '../../modules/integer-time/index.js';
import {toNumber} from '../../modules/integer-math/index.js';
import {integerChecksum} from '../../modules/integer-engine/index.js';
import {Actions, attachKeyboard} from '../../modules/input/index.js';
import {Renderer, boxVertices} from '../../modules/render-webgl/index.js';
import {createFoundry, stepFoundry, verifyFoundry, CELLS, MAX_TICKS} from './world.js';
const $ = id => document.getElementById(id), canvas = $('foundry');
let game = createFoundry(), running = false, failed = false, renderer, staticMesh, movingMesh, previousUs = null;
const clock = new IntegerClock(), keys = new Actions(), touch = new Actions(), pointers = new Map();
clock.setPaused(true);
const keyboard = attachKeyboard(window, keys, {bindings: {KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right', Space: 'jump'}, enabled: () => running});
function clearInput() { keyboard.clear(); touch.clear(); pointers.clear(); }
function pause(label = 'PAUSED') {
  running = false; clock.setPaused(true); previousUs = null; clearInput();
  $('status').textContent = label; $('launch').disabled = failed || game.complete || game.engine.tick >= MAX_TICKS; $('pause').disabled = true;
  $('launch').innerHTML = 'Resume machine <span>▶</span>';
}
function fail(error) { failed = true; pause('GRAPHICS UNAVAILABLE'); $('error').hidden = false; $('error').textContent = error.message; }
function launch() {
  if (failed || game.complete || game.engine.tick >= MAX_TICKS) return;
  clearInput(); running = true; previousUs = null; clock.setPaused(false); $('status').textContent = 'RUNNING';
  $('launch').disabled = true; $('pause').disabled = false; canvas.focus({preventScroll: true});
}
function stats() {
  const body = game.engine.bodies[0];
  $('tick').textContent = String(game.engine.tick).padStart(6, '0');
  $('position').textContent = body.position.join(' · ');
  $('checksum').textContent = integerChecksum(game.engine);
  $('cells').textContent = `${[0, 1, 2, 3].filter(i => game.cells & (1 << i)).length} / 4`;
}
function draw() {
  if (!renderer || failed) return;
  const body = game.engine.bodies[0], data = [];
  boxVertices(body.position.map(toNumber), body.halfSize.map(v => toNumber(v) * 2), [.72, .96, .73], data);
  // Paint only: fixed-point positions leave the simulation here.
  for (let i = 0; i < CELLS.length; i++) if (!(game.cells & (1 << i))) {
    boxVertices(CELLS[i].map(toNumber), [.42, .65, .42], [1, .68, .3], data);
  }
  renderer.update(movingMesh, data);
  const x = Math.max(5, Math.min(24, toNumber(body.position[0]) + 3));
  renderer.begin([x, 7, 17], [-.10, 0, 0, .99498743710662], {fog: .009});
  renderer.draw(staticMesh); renderer.draw(movingMesh);
}
$('launch').addEventListener('click', launch);
$('pause').addEventListener('click', () => pause());
$('reset').addEventListener('click', () => {
  game = createFoundry(); clock.reset(); pause('READY'); $('launch').innerHTML = 'Start machine <span>▶</span>';
  $('replay').textContent = 'Run the course, then verify your recorded inputs. Verification compares the complete game state.'; stats(); draw();
});
$('verify').addEventListener('click', () => {
  pause(); const result = verifyFoundry(game);
  $('replay').textContent = `${result.match ? 'REPLAY MATCH' : 'REPLAY MISMATCH'} · ${result.ticks} ticks · ${result.checksum}. Complete game state compared.`;
});
window.addEventListener('blur', () => { if (running) pause(); });
document.addEventListener('visibilitychange', () => { if (document.hidden && running) pause(); });
window.addEventListener('keydown', e => {
  if (e.code === 'Escape' && !e.repeat) { e.preventDefault(); if (running) pause(); else launch(); }
});
for (const button of document.querySelectorAll('[data-action]')) {
  const action = button.dataset.action;
  button.addEventListener('pointerdown', e => {
    if (!running || e.button !== 0) return;
    e.preventDefault(); pointers.set(e.pointerId, action); touch.set(action, true);
    try { button.setPointerCapture(e.pointerId); } catch { /* Pointer may have been cancelled by the host. */ }
  });
  const release = e => {
    const action = pointers.get(e.pointerId); pointers.delete(e.pointerId);
    if (action) touch.set(action, [...pointers.values()].includes(action));
  };
  button.addEventListener('pointerup', release);
  button.addEventListener('pointercancel', () => { pointers.clear(); touch.clear(); });
  button.addEventListener('lostpointercapture', release);
  // Keyboard activation is one tick, while pointer holds last until released.
  button.addEventListener('click', e => { if (running && e.detail === 0) { touch.set(action, true); touch.set(action, false); } });
}
canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); fail(new Error('Graphics context lost. Reload to restart the renderer.')); });
try {
  renderer = new Renderer(canvas); const data = [];
  for (const box of game.engine.boxes) {
    const min = box.min.map(toNumber), max = box.max.map(toNumber);
    boxVertices(min.map((v, k) => (v + max[k]) / 2), min.map((v, k) => max[k] - v), box.id < 4 ? [.15, .22, .27] : [.28, .38, .42], data);
    if (box.id >= 4) boxVertices([(min[0] + max[0]) / 2, max[1] + .025, 1.9], [max[0] - min[0], .05, .15], [.86, .55, .22], data);
  }
  for (let x = 0; x < 30; x += 2) {
    boxVertices([x, -.01, 2.1], [.04, .03, .3], [.4, .53, .6], data);
    boxVertices([x, 5, -2.5], [.05, 14, .06], [.13, .23, .29], data);
  }
  staticMesh = renderer.mesh(data); movingMesh = renderer.mesh([]);
} catch (error) { fail(error); }
stats();
function frame(nowMs) {
  // Quantise absolute timestamps before differencing, avoiding per-frame rounding drift.
  const nowUs = Math.floor(nowMs * 1000), elapsedUs = previousUs === null ? 0 : Math.min(2147483647, Math.max(0, nowUs - previousUs)); previousUs = nowUs;
  if (running) {
    try {
      clock.advance(elapsedUs, () => {
        const leftTap = touch.consume('left'), rightTap = touch.consume('right');
        const move = Number(Boolean(keys.value('right') || touch.value('right') || rightTap)) - Number(Boolean(keys.value('left') || touch.value('left') || leftTap));
        const keyJump = keys.consume('jump'), touchJump = touch.consume('jump');
        stepFoundry(game, {move, jump: keyJump || touchJump});
        if (game.complete) pause('COMPLETE');
        else if (game.engine.tick >= MAX_TICKS) pause('RECORDING FULL');
      });
    } catch (error) { pause('SIMULATION STOPPED'); $('error').hidden = false; $('error').textContent = error.message; }
  }
  stats(); draw(); requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
