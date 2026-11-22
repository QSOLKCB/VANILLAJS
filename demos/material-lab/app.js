// SPDX-License-Identifier: Apache-2.0
import {MATERIAL, MATERIAL_LIMITS, restoreMaterialGrid} from '../../modules/material-grid/index.js';
import {FixedClock} from '../../modules/time/index.js';
import {createChamber} from './chambers.js';
import {chamberView} from './view.js';

const byId = id => document.getElementById(id);
const field = byId('field'), chamber = byId('chamber'), radius = byId('radius');
const run = byId('run'), step = byId('step'), status = byId('status');
const clock = new FixedClock({step: 1 / 30, maxFrame: 0.2, maxSteps: 6});
let grid, view, baseline, cursor, showCursor = false, pointer = null, lastPoint = null;
let running = false, frameId = 0, previousTime = null, importGeneration = 0;

function draw() {
  view.draw(showCursor ? cursor : null, Number(radius.value));
  byId('tick').textContent = String(grid.tick);
  const counts = grid.population();
  for (const name of ['sand', 'water', 'stone']) byId(name + '-count').textContent = String(counts[name]);
}

function cancelStroke() {
  if (pointer !== null && field.hasPointerCapture(pointer)) field.releasePointerCapture(pointer);
  pointer = null;
  lastPoint = null;
}

function transport(play) {
  running = play && grid.tick < MATERIAL_LIMITS.tick;
  if (!running) cancelStroke();
  clock.setPaused(!running);
  previousTime = null;
  cancelAnimationFrame(frameId);
  if (running) frameId = requestAnimationFrame(frame);
  run.textContent = running ? 'Pause' : 'Run';
  run.disabled = grid.tick === MATERIAL_LIMITS.tick;
  step.disabled = running || run.disabled;
}

function advance() {
  grid.step();
  if (grid.tick === MATERIAL_LIMITS.tick) {
    transport(false);
    status.textContent = 'Tick limit reached. Save the chamber or reset it.';
  }
}

function frame(time) {
  const elapsed = previousTime === null ? 0 : (time - previousTime) / 1000;
  previousTime = time;
  if (clock.advance(elapsed, advance).steps) draw();
  if (running) frameId = requestAnimationFrame(frame);
}

function install(next) {
  cancelStroke();
  grid = next;
  view = chamberView(field, grid);
  cursor = {x: Math.floor(grid.width / 2), y: Math.floor(grid.height / 2)};
  showCursor = false;
  byId('dimensions').textContent = grid.width + ' × ' + grid.height;
  transport(false);
  draw();
}

function usePreset() {
  importGeneration++;
  const next = createChamber(chamber.value);
  baseline = next.snapshot();
  install(next);
  status.textContent = 'Paused at the starting layout.';
}

function paintAt(point) {
  importGeneration++;
  const material = MATERIAL[document.querySelector('input[name="material"]:checked').value];
  const size = Number(radius.value);
  const start = lastPoint ?? point;
  const dx = point.x - start.x, dy = point.y - start.y;
  const span = Math.max(1, Math.abs(dx), Math.abs(dy));
  for (let i = 1; i <= span; i++) {
    grid.paint(start.x + Math.round(dx * i / span), start.y + Math.round(dy * i / span), material, size);
  }
  cursor = point;
  showCursor = true;
  draw();
}

field.addEventListener('pointerdown', event => {
  if (!event.isPrimary || event.button !== 0 || pointer !== null) return;
  const point = view.locate(event.clientX, event.clientY);
  if (!point) return;
  field.focus({preventScroll: true});
  field.setPointerCapture(event.pointerId);
  pointer = event.pointerId;
  paintAt(point);
  lastPoint = point;
});
field.addEventListener('pointermove', event => {
  if (!event.isPrimary || (pointer !== null && pointer !== event.pointerId)) return;
  const point = view.locate(event.clientX, event.clientY);
  if (point && pointer !== null) {
    paintAt(point);
    lastPoint = point;
  } else {
    lastPoint = null;
    if (point) cursor = point;
    showCursor = Boolean(point);
    draw();
  }
});
for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
  field.addEventListener(type, event => { if (event.pointerId === pointer) cancelStroke(); });
}
field.addEventListener('pointerleave', () => { showCursor = false; draw(); });
field.addEventListener('focus', () => { showCursor = true; draw(); });
field.addEventListener('blur', () => { cancelStroke(); showCursor = false; draw(); });
field.addEventListener('keydown', event => {
  if (event.altKey || event.ctrlKey || event.metaKey || pointer !== null) return;
  const arrows = {ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1]};
  if (event.key === ' ') {
    event.preventDefault();
    paintAt(cursor);
  } else if (Object.hasOwn(arrows, event.key)) {
    event.preventDefault();
    const [dx, dy] = arrows[event.key];
    cursor.x = Math.max(0, Math.min(grid.width - 1, cursor.x + dx));
    cursor.y = Math.max(0, Math.min(grid.height - 1, cursor.y + dy));
    showCursor = true;
    draw();
    status.textContent = 'Brush at column ' + (cursor.x + 1) + ', row ' + (cursor.y + 1) + '.';
  }
});

chamber.addEventListener('change', usePreset);
radius.addEventListener('change', draw);
run.addEventListener('click', () => {
  importGeneration++;
  transport(!running);
  status.textContent = running ? 'Running at 30 simulation ticks per second.' : 'Paused.';
});
step.addEventListener('click', () => {
  importGeneration++;
  advance();
  draw();
  if (!run.disabled) status.textContent = 'Advanced one tick.';
});
byId('reset').addEventListener('click', () => {
  importGeneration++;
  install(restoreMaterialGrid(baseline));
  status.textContent = 'Restored the starting layout.';
});
function suspend() {
  cancelStroke();
  if (running) {
    transport(false);
    status.textContent = 'Paused when the lab lost focus.';
  }
}
window.addEventListener('blur', suspend);
document.addEventListener('visibilitychange', () => { if (document.hidden) suspend(); });

byId('save').addEventListener('click', () => {
  importGeneration++;
  const url = URL.createObjectURL(new Blob([grid.snapshot()], {type: 'application/json'}));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'sediment-tick-' + grid.tick + '.json';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
byId('load').addEventListener('change', async event => {
  const file = event.target.files[0];
  event.target.value = '';
  if (!file) return;
  const generation = ++importGeneration;
  transport(false);
  try {
    if (file.size > MATERIAL_LIMITS.snapshotBytes) throw new RangeError('Snapshot exceeds 16 KiB');
    const text = await file.text();
    if (generation !== importGeneration) return;
    const next = restoreMaterialGrid(text);
    baseline = next.snapshot();
    chamber.value = 'file';
    install(next);
    status.textContent = 'Opened snapshot at tick ' + grid.tick + '.';
  } catch (error) {
    if (generation === importGeneration) status.textContent = 'Snapshot rejected. ' + error.message;
  }
});
usePreset();
