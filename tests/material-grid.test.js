// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {createMaterialGrid, restoreMaterialGrid, MATERIAL, MATERIAL_FORMAT, MATERIAL_LIMITS} from '../modules/material-grid/index.js';
import {createChamber} from '../demos/material-lab/chambers.js';
import {FixedClock} from '../modules/time/index.js';

function fixture(rows, seed = 1, tick = 0) {
  return restoreMaterialGrid(JSON.stringify({
    format: MATERIAL_FORMAT, width: rows[0].length, height: rows.length, seed, tick, cells: rows.join('')
  }));
}
const contents = grid => JSON.parse(grid.snapshot()).cells;

test('gravity, impermeable walls, closed edges and two-particle density exchange', () => {
  const falling = fixture(['s', 'w', '.', '.']);
  falling.step();
  assert.equal(contents(falling), '.sw.');
  const shaft = fixture(['s', 'w', 'w', '#']);
  shaft.step();
  assert.equal(contents(shaft), 'wsw#');
  shaft.step();
  assert.equal(contents(shaft), 'wws#');
  const isolated = fixture(['#s#', '###', '.w.']);
  isolated.step();
  assert.ok(['#s####w..', '#s####..w'].includes(contents(isolated)));
  for (const char of '.sw#') {
    const single = fixture([char]);
    assert.equal(single.step(), 0);
    assert.equal(contents(single), char);
  }
  for (const seed of [0, 2, 17, 0xffffffff]) {
    const one = fixture(['...w...'], seed);
    one.step();
    assert.ok([2, 4].includes(contents(one).indexOf('w')), 'water crossed exactly one cell');
  }
});

// Independent labelled-particle model. Track each grain's identity across a
// tick, enumerate neighbours as coordinates, and calculate the row word in BigInt.
function reference(rows, seed, tick) {
  const width = rows[0].length, height = rows.length;
  const board = rows.map(row => Array.from(row, kind => ({kind, moved: false})));
  let word = (BigInt(seed) + BigInt(tick) * 0x9e3779b9n) & 0xffffffffn;
  for (let y = height - 1; y >= 0; y--) {
    word = (word * 1664525n + 1013904223n) & 0xffffffffn;
    const indices = Array.from({length: width}, (_, x) => x);
    if (word < 0x80000000n) indices.reverse();
    for (const x of indices) {
      const particle = board[y][x];
      if (particle.moved || !['s', 'w'].includes(particle.kind)) continue;
      const side = (word >> BigInt(x % 31)) & 1n ? 1 : -1;
      const candidates = [[x, y + 1], [x + side, y + 1], [x - side, y + 1]];
      if (particle.kind === 'w') candidates.push([x + side, y], [x - side, y]);
      const accepted = candidates.find(([cx, cy]) => {
        const other = board[cy]?.[cx];
        return other && (other.kind === '.' || (particle.kind === 's' && other.kind === 'w' && !other.moved));
      });
      if (!accepted) continue;
      const [cx, cy] = accepted, other = board[cy][cx];
      particle.moved = true;
      other.moved = other.kind !== '.';
      board[y][x] = other;
      board[cy][cx] = particle;
    }
  }
  return board.map(row => row.map(cell => cell.kind).join('')).join('');
}

test('all 256 two-by-two worlds match an independent labelled reference at two seeds/ticks', () => {
  for (let state = 0; state < 256; state++) {
    const cells = Array.from({length: 4}, (_, i) => '.sw#'[(state >> (2 * i)) & 3]);
    const rows = [cells.slice(0, 2).join(''), cells.slice(2).join('')];
    for (const [seed, tick] of [[17, 0], [0xffffffff, 0xfffffffe]]) {
      const grid = fixture(rows, seed, tick);
      grid.step();
      assert.equal(contents(grid), reference(rows, seed, tick));
    }
  }
});

test('paint clips a disk, accounts for replacements, and rejects invalid edits atomically', () => {
  const grid = createMaterialGrid(5, 4);
  assert.equal(grid.paint(0, 0, MATERIAL.sand, 2), 6);
  assert.equal(grid.paint(0, 0, MATERIAL.sand, 2), 0);
  assert.equal(grid.paint(1, 0, MATERIAL.water), 1);
  assert.equal(grid.paint(2, 0, MATERIAL.air), 1);
  assert.deepEqual(grid.population(), {air: 15, sand: 4, water: 1, stone: 0});
  const before = grid.snapshot();
  for (const args of [[5, 0, 1], [0, -1, 1], [1.5, 1, 1], [0, 0, 'sand'], [0, 0, 4], [2, 1, 1, 4], [0, 1, 1, NaN]]) {
    assert.throws(() => grid.paint(...args));
    assert.equal(grid.snapshot(), before);
  }
  const pixels = new Uint8Array(20);
  grid.copyCells(pixels);
  assert.equal(pixels[1], MATERIAL.water);
  pixels.fill(0);
  grid.population().sand = 100;
  assert.equal(grid.snapshot(), before);
  assert.throws(() => grid.copyCells(new Uint8Array(19)));
});

test('maximum size bounds typed storage and conserves each material during dense flow', () => {
  const {width, height} = MATERIAL_LIMITS;
  const symbols = '.sw#';
  const rows = Array.from({length: height}, (_, y) =>
    Array.from({length: width}, (_, x) => symbols[(x * 11 + y * 7 + (x ^ y)) % 7 % 4]).join(''));
  const grid = fixture(rows);
  const initial = contents(grid), counts = grid.population();
  assert.equal(grid.bufferBytes, 24592);
  assert.ok(Buffer.byteLength(grid.snapshot()) <= MATERIAL_LIMITS.snapshotBytes);
  for (let i = 0; i < 256; i++) grid.step();
  const final = contents(grid);
  assert.notEqual(final, initial);
  for (const [name, id] of Object.entries(MATERIAL)) {
    assert.equal([...final].filter(value => value === symbols[id]).length, counts[name]);
  }
  assert.deepEqual(grid.population(), counts);
  assert.equal(grid.bufferBytes, 24592);
  for (let i = 0; i < final.length; i++) assert.equal(final[i] === '#', initial[i] === '#');
  const packed = fixture(Array(height).fill('s'.repeat(width)));
  assert.equal(packed.population().sand, 12288);
  assert.equal(packed.step(), 0);
  for (const args of [[129, 1], [128, 97], [0, 1], [1, NaN], [1, 1, -1], [1, 1, 2 ** 32]]) {
    assert.throws(() => createMaterialGrid(...args));
  }
});

test('snapshots strictly admit complete v1 state and resume at the accepted tick', () => {
  assert.equal(createMaterialGrid(1, 1, -0).seed, 0);
  const grid = createChamber('spillway');
  for (let i = 0; i < 19; i++) grid.step();
  const saved = grid.snapshot(), source = JSON.parse(saved);
  const copy = restoreMaterialGrid(saved);
  assert.equal(copy.snapshot(), saved);
  for (const change of [{format: 'v2'}, {cells: null}, {cells: '.'}, {cells: 'x' + source.cells.slice(1)},
    {seed: 2 ** 32}, {tick: -1}, {tick: 2 ** 32}, {width: 1}, {future: true}]) {
    assert.throws(() => restoreMaterialGrid(JSON.stringify({...source, ...change})));
  }
  for (const bad of [null, {}, 'null', '[]', '{', ' '.repeat(16385), 'é', '{}']) {
    assert.throws(() => restoreMaterialGrid(bad));
  }
  assert.equal(grid.snapshot(), saved);
  for (let i = 0; i < 100; i++) {
    grid.step();
    copy.step();
    assert.equal(copy.snapshot(), grid.snapshot());
  }
  const terminal = fixture(['s.'], 0, MATERIAL_LIMITS.tick);
  const last = terminal.snapshot();
  assert.throws(() => terminal.step(), /tick limit/);
  assert.equal(terminal.snapshot(), last);
});

test('real chamber, tick-addressed edits and fixed clock agree at 30, 60 and 144 presentations/s', () => {
  function run(rate) {
    const grid = createChamber('hoppers');
    const clock = new FixedClock({step: 1 / 30, maxFrame: 0.2, maxSteps: 6});
    for (let frame = 0; frame < rate * 4; frame++) {
      clock.advance(1 / rate, () => {
        if (grid.tick === 26) grid.paint(23, 26, MATERIAL.stone, 2);
        if (grid.tick === 54) grid.paint(72, 26, MATERIAL.air, 3);
        grid.step();
      });
    }
    assert.equal(grid.tick, 120);
    return grid.snapshot();
  }
  assert.equal(run(30), run(60));
  assert.equal(run(60), run(144));
});
